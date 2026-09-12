/** 이미지 스타일 프리셋 */
export const IMAGE_STYLES = {
  painting: {
    label: '고전 회화',
    suffix: 'classical oil painting, Renaissance style, dramatic chiaroscuro lighting, museum quality',
  },
  watercolor: {
    label: '수채화',
    suffix: 'soft watercolor illustration, gentle pastel tones, delicate brush strokes, paper texture',
  },
  stained_glass: {
    label: '스테인드글라스',
    suffix: 'stained glass window art, vivid jewel colors, bold black leading, cathedral light',
  },
  cinematic: {
    label: '영화적 실사',
    suffix: 'cinematic photograph, epic scale, golden hour lighting, ultra detailed, 8k',
  },
  minimal: {
    label: '미니멀 일러스트',
    suffix: 'minimalist flat illustration, clean shapes, limited color palette, modern design',
  },
} as const;

export type ImageStyle = keyof typeof IMAGE_STYLES;

/** 이미지 비율 프리셋 (FLUX 권장: 16의 배수) */
export const IMAGE_SIZES = {
  square: { label: '정사각형 (1:1)', width: 1024, height: 1024 },
  portrait: { label: '세로 (3:4)', width: 768, height: 1024 },
  landscape: { label: '가로 (16:9)', width: 1024, height: 576 },
  story: { label: '스토리 (9:16)', width: 576, height: 1024 },
} as const;

export type ImageSize = keyof typeof IMAGE_SIZES;

/** images 테이블 행 */
export interface GeneratedImage {
  id: string;
  user_id: string;
  prompt: string;
  prompt_en: string | null;
  style: string | null;
  scripture: string | null;
  model: string;
  model_id: string | null;
  mode: 'biblical' | 'general' | string;
  width: number;
  height: number;
  storage_path: string;
  image_url: string;
  created_at: string;
}

/** credits 테이블 행 */
export interface CreditRow {
  user_id: string;
  balance: number;
  total_used: number;
  updated_at: string;
}
