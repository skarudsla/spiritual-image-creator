-- ============================================================
-- Spiritual Image Creator — 001: images / credits
-- Supabase SQL Editor 에서 그대로 실행 (재실행 안전: IF NOT EXISTS / OR REPLACE)
-- ============================================================

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
