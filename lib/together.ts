/**
 * Together AI 이미지 생성 클라이언트 (서버 전용)
 * https://docs.together.ai/reference/post_images-generations
 */

/**
 * 기본 이미지 모델. .env.local 의 TOGETHER_IMAGE_MODEL 로 변경 가능.
 * 서버리스 지원 모델 목록: https://docs.together.ai/docs/serverless-models
 *  - black-forest-labs/FLUX.2-dev            ($0.0154/MP, 기본값 — 품질/가격 균형)
 *  - Rundiffusion/Juggernaut-Lightning-Flux  ($0.0017/MP, 매우 저렴·빠름)
 *  - black-forest-labs/FLUX.1.1-pro          ($0.04/MP, 고품질)
 */
/** TOGETHER_AI_API_KEY 앞뒤 공백/따옴표 제거 */
export function togetherKey(): string | undefined {
  const t = process.env.TOGETHER_AI_API_KEY?.trim().replace(/^["']|["']$/g, '').trim();
  return t || undefined;
}

export const DEFAULT_IMAGE_MODEL =
  process.env.TOGETHER_IMAGE_MODEL || 'black-forest-labs/FLUX.2-dev';

const TOGETHER_BASE = process.env.TOGETHER_BASE_URL || 'https://api.together.ai/v1';
const TOGETHER_URL = `${TOGETHER_BASE}/images/generations`;

export class TogetherError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: 'config' | 'auth' | 'rate_limit' | 'bad_request' | 'server' | 'network'
  ) {
    super(message);
    this.name = 'TogetherError';
  }
}

export function isTogetherConfigured(): boolean {
  const key = togetherKey();
  return !!key && !key.startsWith('your-');
}

export interface GenerateImageParams {
  prompt: string;
  width: number;
  height: number;
  steps?: number;
  seed?: number;
}

export interface GenerateImageResult {
  /** PNG 바이너리 */
  buffer: Buffer;
  model: string;
  seed?: number;
}

/** 프롬프트로 이미지 1장을 생성해 PNG Buffer 로 반환 */
export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  if (!isTogetherConfigured()) {
    throw new TogetherError('TOGETHER_AI_API_KEY 가 설정되지 않았습니다.', 503, 'config');
  }

  const body = {
    model: DEFAULT_IMAGE_MODEL,
    prompt: params.prompt,
    width: params.width,
    height: params.height,
    n: 1,
    ...(params.steps !== undefined ? { steps: params.steps } : {}), // 미지정 시 모델 기본값 사용
    response_format: 'base64',
    ...(params.seed !== undefined ? { seed: params.seed } : {}),
  };

  let res: Response;
  try {
    res = await fetch(TOGETHER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${togetherKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    throw new TogetherError(
      `이미지 생성 서버에 연결할 수 없습니다: ${(err as Error).message}`,
      503,
      'network'
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try {
      detail = JSON.parse(text)?.error?.message ?? text;
    } catch {
      /* plain text */
    }

    if (res.status === 401 || res.status === 403) {
      throw new TogetherError(`Together AI 인증 실패 (${res.status}): ${detail || 'API 키를 확인해주세요.'}`, 503, 'auth');
    }
    if (res.status === 402) {
      throw new TogetherError(`Together AI 잔액이 부족합니다: ${detail}`, 402, 'auth');
    }
    if (res.status === 429) {
      throw new TogetherError(`이미지 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요. ${detail}`, 429, 'rate_limit');
    }
    if (res.status >= 500) {
      throw new TogetherError(`이미지 생성 서버 오류 (${res.status})`, 502, 'server');
    }
    throw new TogetherError(`이미지 생성 요청이 거부되었습니다: ${detail}`, 400, 'bad_request');
  }

  const json = (await res.json()) as {
    model?: string;
    data?: Array<{ b64_json?: string; url?: string; seed?: number }>;
  };

  const item = json.data?.[0];
  if (!item?.b64_json) {
    throw new TogetherError('이미지 생성 응답이 비어 있습니다.', 502, 'server');
  }

  return {
    buffer: Buffer.from(item.b64_json, 'base64'),
    model: json.model ?? DEFAULT_IMAGE_MODEL,
    seed: item.seed,
  };
}
