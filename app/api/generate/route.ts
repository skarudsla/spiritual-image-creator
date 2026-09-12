import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateImage, TogetherError } from '@/lib/together';
import { preparePrompt } from '@/lib/prompt';
import { checkGenerationAllowed } from '@/lib/limits';
import { IMAGE_STYLES, IMAGE_SIZES, type ImageStyle, type ImageSize } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BUCKET = 'generated-images';
const MAX_PROMPT = 1000;

// 기독교/성경 이미지 특화: 모든 프롬프트에 붙는 공통 컨텍스트
const BASE_CONTEXT =
  'reverent Christian biblical scene, spiritually uplifting, sacred atmosphere, purely visual illustration without any text, letters, captions, signatures or watermarks';

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
  let body: { prompt?: string; style?: string; size?: string; scripture?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const prompt = (body.prompt ?? '').trim();
  const scripture = (body.scripture ?? '').trim() || null;
  const styleKey = (body.style ?? 'painting') as ImageStyle;
  const sizeKey = (body.size ?? 'square') as ImageSize;

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

  // ---- 프롬프트 전처리: 금지어 차단 → 한→영 번역/강화 + 안전성 판정 (크레딧 차감 전) ----
  const prepared = await preparePrompt(prompt, scripture);
  if (!prepared.safe) {
    return NextResponse.json(
      { success: false, error: prepared.reason, code: 'BLOCKED' },
      { status: 422 }
    );
  }
  const fullPrompt = [prepared.english, style.suffix, BASE_CONTEXT].filter(Boolean).join(', ');

  // ---- 크레딧 차감 (원자적) ----
  const { data: consumed, error: creditErr } = await supabaseAdmin.rpc('consume_credit', {
    p_user_id: user.id,
    p_amount: 1,
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
      { success: false, error: '크레딧이 부족합니다.', code: 'NO_CREDITS' },
      { status: 402 }
    );
  }

  const refund = async () => {
    const { error } = await supabaseAdmin.rpc('refund_credit', { p_user_id: user.id, p_amount: 1 });
    if (error) console.error('[generate] refund_credit error:', error);
  };

  // ---- 이미지 생성 ----
  let generated;
  try {
    generated = await generateImage({ prompt: fullPrompt, width: size.width, height: size.height });
  } catch (err) {
    await refund();
    if (err instanceof TogetherError) {
      console.error('[generate] together error:', err.kind, err.message);
      return NextResponse.json({ success: false, error: err.message, code: err.kind }, { status: err.status });
    }
    console.error('[generate] unexpected generation error:', err);
    return NextResponse.json({ success: false, error: '이미지 생성 중 오류가 발생했습니다.' }, { status: 500 });
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
      scripture,
      model: generated.model,
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
      scripture,
      model: generated.model,
      width: size.width,
      height: size.height,
      image_url: pub.publicUrl,
      created_at: new Date().toISOString(),
    },
    credits: credit?.balance ?? null,
  });
}
