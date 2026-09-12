/**
 * 프롬프트 전처리 (서버 전용)
 *  1) 금지어 즉시 차단 (LLM 호출 전, 비용 0)
 *  2) LLM 으로 한국어 → 영어 번역 + 이미지 프롬프트 강화 + 안전성 판정 (한 번의 호출)
 *
 * FLUX 계열 모델은 영어 프롬프트에서 품질이 크게 좋아지므로 모든 입력을 영어로 정규화합니다.
 */

const TOGETHER_BASE = process.env.TOGETHER_BASE_URL || 'https://api.together.ai/v1';
const PROMPT_MODEL =
  process.env.TOGETHER_PROMPT_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';

export interface PromptResult {
  /** 이미지 모델에 넘길 영어 프롬프트 */
  english: string;
  /** 원문이 이미 영어였는지 */
  wasEnglish: boolean;
  /** 안전성 통과 여부 */
  safe: boolean;
  /** 차단 사유 (safe=false 일 때, 사용자에게 보여줄 한국어) */
  reason?: string;
  /** LLM 호출 실패 시 원문을 그대로 사용했는지 */
  fallback: boolean;
}

// ---- 1단계: 명백한 금지어 (한/영). 부분 일치. ----
const BLOCKED_TERMS: RegExp[] = [
  // 성적 콘텐츠
  /\b(nude|naked|nsfw|porn|sex|sexual|erotic|hentai|xxx)\b/i,
  /(누드|나체|알몸|포르노|음란|성행위|섹스|야한)/,
  // 아동 관련 (성적 맥락 전 단계에서 차단)
  /\b(loli|shota|child\s*porn|underage)\b/i,
  /(아동\s*포르노|미성년.*(성적|누드|야한))/,
  // 극단적 폭력 / 고어
  /\b(gore|dismember|decapitat|mutilat|torture\s+porn)\b/i,
  /(고어|참수|사지\s*절단|시체\s*훼손)/,
  // 혐오 / 극단주의 상징
  /\b(nazi|swastika|kkk|white\s+power)\b/i,
  /(나치|하켄크로이츠|인종\s*청소)/,
];

export function quickBlockCheck(text: string): string | null {
  for (const re of BLOCKED_TERMS) {
    if (re.test(text)) {
      return '허용되지 않는 표현이 포함되어 있습니다. 성적·폭력적·혐오 표현 없이 다시 작성해주세요.';
    }
  }
  return null;
}

// ---- 2단계: LLM 번역 + 강화 + 안전성 ----
const SYSTEM_PROMPT_BIBLICAL = `You are a prompt engineer for a Christian/Biblical AI image generator used by churches, families and ministries.

Given a user's scene description (Korean or English) and an optional scripture reference, do ALL of the following and reply with ONLY a JSON object, no markdown:

{
  "english": "<a vivid, concrete English image prompt, 1-3 sentences, describing ONLY what is visible: subjects, setting, action, clothing, lighting, mood; keep the user's intent; if a scripture reference is given, use it silently to add faithful visual details (era-appropriate clothing, landscape, objects) but NEVER write the book name, chapter/verse numbers, the word 'Psalm'/'Gospel'/'Bible', quotations, captions, or any words that could be rendered as text in the image>",
  "was_english": <true if the user's input was already in English>,
  "safe": <true/false>,
  "reason_ko": "<if safe is false: one short Korean sentence telling the user why (e.g. 성적인 표현은 허용되지 않습니다). Empty string if safe>"
}

IMPORTANT: The image model literally draws any words it sees, so the "english" prompt must contain no quoted text, no verse references, no signage. Describe the scene, not the source.

Mark safe=false ONLY for: sexual or nude content, sexualized minors, graphic gore/torture, hate symbols or content demeaning a group, glorification of terrorism, or explicit instructions to depict a real living person in a defamatory way. Ordinary biblical scenes including battles, crucifixion, martyrdom, angels, demons, judgment, or illness are SAFE and common in Christian art — do not block them.`;

const SYSTEM_PROMPT_GENERAL = `You are a prompt engineer for a general-purpose AI image generator.

Given a user's scene description (Korean or English), reply with ONLY a JSON object, no markdown:

{
  "english": "<a vivid, concrete English image prompt, 1-3 sentences, describing ONLY what is visible: subjects, setting, action, clothing, lighting, mood, composition; keep the user's intent and style words; never add quoted text, captions, logos or watermarks unless the user explicitly asks for text in the image>",
  "was_english": <true if the user's input was already in English>,
  "safe": <true/false>,
  "reason_ko": "<if safe is false: one short Korean sentence telling the user why. Empty string if safe>"
}

Mark safe=false ONLY for: sexual or nude content, sexualized minors, graphic gore/torture, hate symbols or content demeaning a group, glorification of terrorism, or explicit instructions to depict a real living person in a defamatory or sexual way. Everything else (fantasy, action, horror atmosphere, portraits, products, landscapes) is SAFE.`;

export type PromptMode = 'biblical' | 'general';

interface LlmJson {
  english?: string;
  was_english?: boolean;
  safe?: boolean;
  reason_ko?: string;
}

export async function preparePrompt(userPrompt: string, scripture?: string | null, mode: PromptMode = 'biblical'): Promise<PromptResult> {
  const combined = [userPrompt, scripture].filter(Boolean).join(' ');

  // 1) 즉시 차단
  const blocked = quickBlockCheck(combined);
  if (blocked) {
    return { english: '', wasEnglish: false, safe: false, reason: blocked, fallback: false };
  }

  const apiKey = process.env.TOGETHER_AI_API_KEY;
  if (!apiKey || apiKey.startsWith('your-')) {
    return { english: userPrompt, wasEnglish: true, safe: true, fallback: true };
  }

  // 2) LLM
  try {
    const res = await fetch(`${TOGETHER_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PROMPT_MODEL,
        temperature: 0.4,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: mode === 'general' ? SYSTEM_PROMPT_GENERAL : SYSTEM_PROMPT_BIBLICAL },
          {
            role: 'user',
            content: mode === 'general'
              ? `Scene: ${userPrompt}`
              : `Scene: ${userPrompt}\nScripture: ${scripture || '(none)'}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.warn('[prompt] LLM http error', res.status, await res.text().catch(() => ''));
      return { english: userPrompt, wasEnglish: true, safe: true, fallback: true };
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(jsonText) as LlmJson;

    if (parsed.safe === false) {
      return {
        english: '',
        wasEnglish: !!parsed.was_english,
        safe: false,
        reason: parsed.reason_ko?.trim() || '허용되지 않는 내용입니다. 다른 장면으로 다시 시도해주세요.',
        fallback: false,
      };
    }

    const english = (parsed.english ?? '').trim();
    if (!english) {
      return { english: userPrompt, wasEnglish: true, safe: true, fallback: true };
    }

    return { english, wasEnglish: !!parsed.was_english, safe: true, fallback: false };
  } catch (err) {
    console.warn('[prompt] LLM failed, using raw prompt:', (err as Error).message);
    return { english: userPrompt, wasEnglish: true, safe: true, fallback: true };
  }
}
