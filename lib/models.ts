import { supabaseAdmin } from '@/lib/supabase';

/** models 테이블 행 */
export interface ModelRow {
  id: string;
  name: string;
  description: string | null;
  provider: 'together' | 'comfyui' | string;
  provider_model: string;
  lora_path: string | null;
  category: 'biblical' | 'general' | 'artistic' | string;
  credit_cost: number;
  example_image_url: string | null;
  version: string;
  parent_id: string | null;
  replaced_by_id: string | null;
  is_visible: boolean;
  is_premium: boolean;
  sort_order: number;
  params: Record<string, unknown>;
}

/** 클라이언트에 노출하는 필드만 */
export type PublicModel = Pick<
  ModelRow,
  'id' | 'name' | 'description' | 'category' | 'credit_cost' | 'example_image_url' | 'version' | 'is_premium' | 'provider'
>;

export const DEFAULT_MODEL_ID = 'flux2-dev';

const PUBLIC_COLUMNS = 'id, name, description, category, credit_cost, example_image_url, version, is_premium, provider';

/** 노출 중인 모델 목록 (정렬 순) */
export async function listVisibleModels(): Promise<PublicModel[]> {
  const { data, error } = await supabaseAdmin
    .from('models')
    .select(PUBLIC_COLUMNS)
    .eq('is_visible', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[models] list error:', error.message);
    return [];
  }
  return (data ?? []) as PublicModel[];
}

/** 생성에 사용할 모델 1개 (숨김 모델은 선택 불가) */
export async function getModelForGeneration(id: string): Promise<ModelRow | null> {
  const { data, error } = await supabaseAdmin
    .from('models')
    .select('*')
    .eq('id', id)
    .eq('is_visible', true)
    .maybeSingle();
  if (error) {
    console.error('[models] get error:', error.message);
    return null;
  }
  return (data as ModelRow) ?? null;
}
