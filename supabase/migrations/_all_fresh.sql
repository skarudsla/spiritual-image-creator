-- ============================================================
-- 실서버(신규 프로젝트)용 통합 마이그레이션: 001 + 002 + 003
-- 새 Supabase 프로젝트 SQL Editor 에서 한 번에 실행
-- ============================================================

-- >>>>>> supabase/migrations/001_images_credits.sql
-- ============================================================
-- Spiritual Image Creator — 001: images / credits
-- Supabase SQL Editor 에서 그대로 실행 (재실행 안전: IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- 이전 단계에서 만들어진 bigint 기반 credits 테이블 제거 (비어 있음, Supabase Auth UUID 구조로 교체)
-- cascade: credit_transactions 등이 참조하는 외래키도 함께 정리
drop table if exists public.credits cascade;

-- ---------- credits: 사용자별 잔여 크레딧 ----------
create table if not exists public.credits (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  balance     integer not null default 10 check (balance >= 0),
  total_used  integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- ---------- images: 생성 이력 ----------
create table if not exists public.images (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  prompt        text not null,
  style         text,
  scripture     text,                 -- 선택: 관련 성경 구절
  model         text not null,
  width         integer not null,
  height        integer not null,
  storage_path  text not null,        -- Storage 내 경로 (bucket: generated-images)
  image_url     text not null,        -- 공개 URL
  created_at    timestamptz not null default now()
);

create index if not exists images_user_created_idx
  on public.images (user_id, created_at desc);

-- ---------- RLS: 본인 데이터만 조회 (쓰기는 서버(service_role)만) ----------
alter table public.credits enable row level security;
alter table public.images  enable row level security;

drop policy if exists "credits: read own" on public.credits;
create policy "credits: read own" on public.credits
  for select using (auth.uid() = user_id);

drop policy if exists "images: read own" on public.images;
create policy "images: read own" on public.images
  for select using (auth.uid() = user_id);

-- ---------- 신규 가입 시 크레딧 자동 지급 (기본 10) ----------
create or replace function public.handle_new_user_credits()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.credits (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_credits on auth.users;
create trigger on_auth_user_created_credits
  after insert on auth.users
  for each row execute function public.handle_new_user_credits();

-- 기존 가입자에게도 크레딧 행 생성
insert into public.credits (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ---------- 크레딧 차감 (원자적) : 성공 시 true, 잔액 부족 시 false ----------
create or replace function public.consume_credit(p_user_id uuid, p_amount integer default 1)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  updated integer;
begin
  update public.credits
     set balance    = balance - p_amount,
         total_used = total_used + p_amount,
         updated_at = now()
   where user_id = p_user_id
     and balance >= p_amount;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- ---------- 크레딧 환불 (생성 실패 시) ----------
create or replace function public.refund_credit(p_user_id uuid, p_amount integer default 1)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.credits
     set balance    = balance + p_amount,
         total_used = greatest(total_used - p_amount, 0),
         updated_at = now()
   where user_id = p_user_id;
end;
$$;

-- ---------- Storage 버킷: 생성 이미지 (공개 읽기) ----------
insert into storage.buckets (id, name, public)
values ('generated-images', 'generated-images', true)
on conflict (id) do nothing;

drop policy if exists "generated-images: public read" on storage.objects;
create policy "generated-images: public read" on storage.objects
  for select using (bucket_id = 'generated-images');

-- >>>>>> supabase/migrations/002_prompt_en.sql
-- 002: 영어 변환 프롬프트 저장 컬럼 (Supabase SQL Editor 에서 실행)
alter table public.images add column if not exists prompt_en text;

-- >>>>>> supabase/migrations/003_rate_limits.sql
-- 003: 요청 횟수 제한 + 전체 사용량 상한 (Supabase SQL Editor 에서 실행)

-- ---------- 요청 기록 (rate limit 계산용) ----------
create table if not exists public.request_log (
  id          bigserial primary key,
  bucket      text not null,          -- 'user:<uuid>' | 'ip:<addr>'
  action      text not null,          -- 'generate' | 'signup' | 'signin'
  created_at  timestamptz not null default now()
);

create index if not exists request_log_bucket_action_time_idx
  on public.request_log (bucket, action, created_at desc);

alter table public.request_log enable row level security;  -- 서버(service_role)만 접근

-- ---------- 제한 확인 + 기록 (원자적) ----------
-- 최근 p_window_seconds 동안 bucket/action 횟수가 p_limit 미만이면 기록하고 true, 아니면 false
create or replace function public.check_rate_limit(
  p_bucket text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  cnt integer;
begin
  select count(*) into cnt
    from public.request_log
   where bucket = p_bucket
     and action = p_action
     and created_at > now() - make_interval(secs => p_window_seconds);

  if cnt >= p_limit then
    return false;
  end if;

  insert into public.request_log (bucket, action) values (p_bucket, p_action);
  return true;
end;
$$;

-- ---------- 전체 생성 수 (예산 상한용) ----------
create or replace function public.global_generation_count(p_window_seconds integer)
returns integer
language sql
security definer set search_path = public
stable
as $$
  select count(*)::integer
    from public.images
   where created_at > now() - make_interval(secs => p_window_seconds);
$$;

-- ---------- 오래된 기록 정리 (수동 또는 cron) ----------
create or replace function public.prune_request_log()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.request_log where created_at < now() - interval '2 days';
$$;

-- ===== 004 + 005 는 별도 파일 참고 (004_models.sql, 005_tier1_safety.sql) — 번호 순으로 이어서 실행 =====
