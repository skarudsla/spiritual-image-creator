/**
 * 결과 이미지 검수 (서버 전용)
 * 생성된 이미지를 비전 모델에 보여주고 성적/고어/혐오 여부를 판정합니다.
 * - OUTPUT_MODERATION=off 로 끌 수 있음 (기본 on)
 * - 모델 호출 실패 시 fail-open (차단하지 않고 로그만) — 서비스 가용성 우선
 */

const TOGETHER_BASE = process.env.TOGETHER_BASE_URL || 'https://api.together.ai/v1';
const VISION_MODEL = process.env.TOGETHER_VISION_MODEL || 'Qwen/Qwen3.5-9B';

export interface ModerationResult {
  safe: boolean;
  /** 차단 사유 (사용자에게 보여줄 한국어) */
  reason?: string;
  /** 판정 실패로 통과시킨 경우 */
  skipped: boolean;
}

const MODERATION_PROMPT = `You are a content safety reviewer for an AI image generator used by churches, families and ministries.
Look at the image and answer with ONLY a JSON object, no markdown:
{"safe": true/false, "category": "none|sexual|minor_sexual|gore|hate|other", "reason_ko": "<one short Korean sentence if unsafe, else empty>"}

Mark safe=false ONLY for: nudity or sexually explicit/suggestive content, any sexualized depiction of a minor, graphic gore or mutilation with realistic blood/organs, hate symbols (swastika etc.) or content demeaning a group.
Classical religious art conventions are SAFE: crucifixion, martyrdom, battles, angels/demons, cherubs, classical nude-adjacent statues without explicit detail, blood on wounds in a painterly style. When in doubt about artistic religious imagery, answer safe=true.`;

export function isOutputModerationEnabled(): boolean {
  return (process.env.OUTPUT_MODERATION ?? 'on').trim().toLowerCase() !== 'off';
}

export async function moderateImage(png: Buffer): Promise<ModerationResult> {
  if (!isOutputModerationEnabled()) return { safe: true, skipped: true };

  const key = process.env.TOGETHER_AI_API_KEY?.trim();
  if (!key) return { safe: true, skipped: true };

  try {
    const res = await fetch(`${TOGETHER_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 400,
        temperature: 0,
        // Qwen3 계열: 사고(thinking) 출력 비활성화 — 켜져 있으면 답이 사고 토큰에 밀려 비어버림
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: MODERATION_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.warn('[moderation] vision model error:', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return { safe: true, skipped: true };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null; reasoning_content?: string | null } }>;
    };
    const msg = json.choices?.[0]?.message;
    // <think>…</think> 가 섞여 오면 제거하고, content 가 비면 reasoning 쪽에서라도 JSON 을 찾는다
    const raw = `${msg?.content ?? ''}\n${msg?.reasoning_content ?? ''}`.replace(/<think>[\s\S]*?<\/think>/g, '');
    const match = raw.match(/\{[^{}]*"safe"[^{}]*\}/);
    if (!match) {
      console.warn('[moderation] unparseable response:', JSON.stringify(msg).slice(0, 300));
      return { safe: true, skipped: true };
    }

    const parsed = JSON.parse(match[0]) as { safe?: boolean; category?: string; reason_ko?: string };
    if (parsed.safe === false) {
      return {
        safe: false,
        skipped: false,
        reason:
          parsed.reason_ko?.trim() ||
          '생성된 이미지가 콘텐츠 정책에 맞지 않아 저장하지 않았습니다. 크레딧은 환불되었습니다.',
      };
    }
    return { safe: true, skipped: false };
  } catch (err) {
    console.warn('[moderation] failed (fail-open):', (err as Error).message);
    return { safe: true, skipped: true };
  }
}
