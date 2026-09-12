-- 002: 영어 변환 프롬프트 저장 컬럼 (Supabase SQL Editor 에서 실행)
alter table public.images add column if not exists prompt_en text;
