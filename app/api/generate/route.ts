import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateImage, TogetherError } from '@/lib/together';
import { preparePrompt, type PromptMode } from '@/lib/prompt';
import { getModelForGeneration, DEFAULT_MODEL_ID } from '@/lib/models';
import { checkGenerationAllowed } from '@/lib/limits';
import { moderateImage } from '@/lib/moderation';
import { IMAGE_STYLES, IMAGE_SIZES, type ImageStyle, type ImageSize } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BUCKET = 'generated-images';
const MAX_PROMPT = 1000;
const MAX_ATTEMPTS = 3; // 일시적 오류(서버/네트워크/429) 시 자동 재시도 횟수
const RETRY_DELAYS_MS = [1500, 4000];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** 일시적 오류만 재시도 (인증/설정/잘못된 요청은 즉시 실패) */
async function generateWithRetry(params: Parameters<typeof generateImage>[0]) {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await generateImage(params);
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof TogetherError && (err.kind === 'server' || err.kind === 'network' || err.kind === 'rate_limit');
      if (!retryable || attempt === MAX_ATTEMPTS) throw err;
      console.warn(`[generate] attempt ${attempt} failed (${(err as TogetherError).kind}), retrying...`);
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 4000);
    }
  }
  throw lastErr;
}

// 모드별 공통 컨텍스트
const BASE_CONTEXT: Record<PromptMode, string> = {
  biblical:
    'reverent Christian biblical scene, spiritually uplifting, sacred atmosphere, purely visual illustration without any text, letters, captions, signatures or watermarks',
  general:
    'high quality, detailed, no watermark, no signature',
};

export async function POST(request: NextRequest) {
  // ---- 인증 ----
  const { user, serverError } = await getSessionUser();
  if (serverError) {
    return NextResponse.json(
      { success: false, error: '인증 서버에 연결할 수 없습니다.' },
      { status: 503 }
    );
  }
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // ---- 남용 방어: 일시정지 / 전체 일일 상한 / 계정당 횟수 제한 ----
  const allowed = await checkGenerationAllowed(user.id);
  if (!allowed.ok) {
    return NextResponse.json(
      { success: false, error: allowed.message, code: 'RATE_LIMITED' },
      { status: allowed.unavailable ? 503 : 429 }
    );
  }

  // ---- 입력 파싱/검증 ----
  let body: { prompt?: string; style?: string; size?: string; scripture?: string; modelId?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const prompt = (body.prompt ?? '').trim();
  const scripture = (body.scripture ?? '').trim() || null;
  const styleKey = (body.style ?? 'painting') as ImageStyle;
  const sizeKey = (body.size ?? 'square') as ImageSize;
  const mode: PromptMode = body.mode === 'general' ? 'general' : 'biblical';
  const modelId = (body.modelId ?? DEFAULT_MODEL_ID).trim();

  if (!prompt) {
    return NextResponse.json({ success: false, error: '프롬프트를 입력해주세요.' }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT) {
    return NextResponse.json(
      { success: false, error: `프롬프트는 ${MAX_PROMPT}자 이하로 입력해주세요.` },
      { status: 400 }
    );
  }
  if (!(styleKey in IMAGE_STYLES)) {
    return NextResponse.json({ success: false, error: '지원하지 않는 스타일입니다.' }, { status: 400 });
  }
  if (!(sizeKey in IMAGE_SIZES)) {
    return NextResponse.json({ success: false, error: '지원하지 않는 크기입니다.' }, { status: 400 });
  }

  const style = IMAGE_STYLES[styleKey];
  const size = IMAGE_SIZES[sizeKey];

  // ---- 모델 카탈로그 조회 ----
  const model = await getModelForGeneration(modelId);
  if (!model) {
    return NextResponse.json({ success: false, error: '선택한 모델을 사용할 수 없습니다.' }, { status: 400 });
  }
  if (model.provider !== 'together') {
    // comfyui 등은 프리미엄 인프라 연결 후 활성화
    return NextResponse.json(
      { success: false, error: '이 모델은 아직 준비 중입니다. 다른 모델을 선택해주세요.', code: 'MODEL_NOT_READY' },
      { status: 503 }
    );
  }
  const cost = model.credit_cost;

  // ---- 프롬프트 전처리: 금지어 차단 → 한→영 번역/강화 + 안전성 판정 (크레딧 차감 전) ----
  const prepared = await preparePrompt(prompt, mode === 'biblical' ? scripture : null, mode);
  if (!prepared.safe) {
    await supabaseAdmin
      .from('moderation_log')
      .insert({ user_id: user.id, stage: 'prompt', model_id: model.id, prompt, reason: prepared.reason ?? null })
      .then(({ error }) => error && console.warn('[generate] moderation_log insert failed:', error.message));
    return NextResponse.json(
      { success: false, error: prepared.reason, code: 'BLOCKED' },
      { status: 422 }
    );
  }
  const fullPrompt = [prepared.english, style.suffix, BASE_CONTEXT[mode]].filter(Boolean).join(', ');

  // ---- 크레딧 차감 (원자적) ----
  const { data: consumed, error: creditErr } = await supabaseAdmin.rpc('consume_credit', {
    p_user_id: user.id,
    p_amount: cost,
  });

  if (creditErr) {
    console.error('[generate] consume_credit error:', creditErr);
    return NextResponse.json(
      { success: false, error: '크레딧 확인 중 오류가 발생했습니다. (DB 마이그레이션이 적용되었는지 확인)' },
      { status: 500 }
    );
  }
  if (!consumed) {
    return NextResponse.json(
      { success: false, error: `크레딧이 부족합니다. (이 모델은 ${cost}크레딧)`, code: 'NO_CREDITS' },
      { status: 402 }
    );
  }

  const refund = async () => {
    const { error } = await supabaseAdmin.rpc('refund_credit', { p_user_id: user.id, p_amount: cost });
    if (error) console.error('[generate] refund_credit error:', error);
  };

  // ---- 이미지 생성 (일시적 오류 시 최대 3회 자동 재시도) ----
  let generated;
  try {
    generated = await generateWithRetry({
      prompt: fullPrompt,
      width: size.width,
      height: size.height,
      model: model.provider_model,
      loraPath: model.lora_path ?? undefined,
      extra: model.params,
    });
  } catch (err) {
    await refund();
    if (err instanceof TogetherError) {
      console.error('[generate] together error:', err.kind, err.message);
      return NextResponse.json({ success: false, error: err.message, code: err.kind }, { status: err.status });
    }
    console.error('[generate] unexpected generation error:', err);
    return NextResponse.json({ success: false, error: '이미지 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }

  // ---- 결과 이미지 검수 (부적절하면 저장하지 않고 환불) ----
  const verdict = await moderateImage(generated.buffer);
  if (!verdict.safe) {
    await refund();
    await supabaseAdmin
      .from('moderation_log')
      .insert({ user_id: user.id, stage: 'output', model_id: model.id, prompt, reason: verdict.reason ?? null })
      .then(({ error }) => error && console.warn('[generate] moderation_log insert failed:', error.message));
    return NextResponse.json(
      { success: false, error: verdict.reason, code: 'OUTPUT_BLOCKED' },
      { status: 422 }
    );
  }

  // ---- Storage 업로드 ----
  const imageId = crypto.randomUUID();
  const storagePath = `${user.id}/${imageId}.png`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, generated.buffer, { contentType: 'image/png', upsert: false });

  if (uploadErr) {
    await refund();
    console.error('[generate] storage upload error:', uploadErr);
    return NextResponse.json(
      { success: false, error: '이미지 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);

  // ---- DB 기록 ----
  const { data: row, error: insertErr } = await supabaseAdmin
    .from('images')
    .insert({
      id: imageId,
      user_id: user.id,
      prompt,
      prompt_en: prepared.english,
      style: styleKey,
      scripture: mode === 'biblical' ? scripture : null,
      model: generated.model,
      model_id: model.id,
      mode,
      width: size.width,
      height: size.height,
      storage_path: storagePath,
      image_url: pub.publicUrl,
    })
    .select()
    .single();

  if (insertErr) {
    console.error('[generate] images insert error:', insertErr);
    // 이미지는 이미 저장됐으므로 환불하지 않고 URL 은 돌려준다
  }

  // ---- 남은 크레딧 ----
  const { data: credit } = await supabaseAdmin
    .from('credits')
    .select('balance')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    success: true,
    image: row ?? {
      id: imageId,
      prompt,
      prompt_en: prepared.english,
      style: styleKey,
      scripture: mode === 'biblical' ? scripture : null,
      model: generated.model,
      model_id: model.id,
      mode,
      width: size.width,
      height: size.height,
      image_url: pub.publicUrl,
      created_at: new Date().toISOString(),
    },
    credits: credit?.balance ?? null,
  });
}
