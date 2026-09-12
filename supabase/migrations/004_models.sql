-- 004: 모델 카탈로그 (PixAI 방식의 다중 모델 선택) + 생성 모드
-- dev(싱가포르) → 검증 → prod(도쿄) 순으로 SQL Editor 에서 실행

create table if not exists public.models (
  id              text primary key,                       -- slug: 'flux2-dev'
  name            text not null,                          -- 표시 이름
  description     text,                                   -- 한 줄 설명
  provider        text not null default 'together',       -- 'together' | 'comfyui' (추후 RunPod/로컬)
  provider_model  text not null,                          -- 제공자 모델 ID (예: black-forest-labs/FLUX.2-dev)
  lora_path       text,                                   -- 자체 LoRA 경로/ID (추후)
  category        text not null default 'general',        -- 'biblical' | 'general' | 'artistic'
  credit_cost     integer not null default 1 check (credit_cost >= 1),
  example_image_url text,
  version         text not null default '1.0',
  parent_id       text references public.models(id),      -- 업그레이드 관계 (v1.0 → v1.1)
  replaced_by_id  text references public.models(id),      -- 새 버전으로 대체된 경우
  is_visible      boolean not null default true,          -- 소프트 삭제/숨김
  is_premium      boolean not null default false,         -- 프리미엄 전용 (추후)
  sort_order      integer not null default 100,
  params          jsonb not null default '{}'::jsonb,     -- 제공자별 추가 파라미터 (steps, guidance 등)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.models enable row level security;
drop policy if exists "models: public read visible" on public.models;
create policy "models: public read visible" on public.models
  for select using (is_visible = true);

-- images 에 모델/모드 컬럼 추가
alter table public.images add column if not exists model_id text references public.models(id);
alter table public.images add column if not exists mode text not null default 'biblical'; -- 'biblical' | 'general'

-- ---------- 시드: Together 서버리스 모델 ----------
insert into public.models (id, name, description, provider, provider_model, category, credit_cost, sort_order, params) values
  ('flux2-dev',      'FLUX.2 스탠다드',   '균형 잡힌 기본 모델. 대부분의 장면에 추천',            'together', 'black-forest-labs/FLUX.2-dev',            'general', 1, 10, '{}'),
  ('flux11-pro',     'FLUX 1.1 프로',     '더 정교한 디테일과 구도. 인쇄·대형 출력용',             'together', 'black-forest-labs/FLUX.1.1-pro',          'general', 2, 20, '{}'),
  ('juggernaut-lightning', '주거넛 라이트닝', '사진처럼 사실적인 실사. 빠르고 저렴',              'together', 'Rundiffusion/Juggernaut-Lightning-Flux',  'general', 1, 30, '{}'),
  ('qwen-image',     'Qwen 이미지',       '일러스트·포스터에 강하고 글자 표현이 정확 (썸네일용)',   'together', 'Qwen/Qwen-Image',                         'artistic', 1, 40, '{}'),
  ('imagen4-fast',   'Imagen 4 패스트',   '구글 Imagen. 부드러운 색감의 삽화·동화풍',             'together', 'google/imagen-4.0-fast',                  'artistic', 2, 50, '{}')
on conflict (id) do update set
  name = excluded.name, description = excluded.description, provider = excluded.provider,
  provider_model = excluded.provider_model, category = excluded.category,
  credit_cost = excluded.credit_cost, sort_order = excluded.sort_order, updated_at = now();

-- 기존 이미지에 기본 모델 연결 (model 문자열 기준)
update public.images set model_id = 'flux2-dev' where model_id is null and model like '%FLUX.2-dev%';
