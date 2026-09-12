-- 005: Tier 1 안전장치 — 약관 동의 기록, 이미지 신고, 결과 이미지 검수 기록
-- dev(싱가포르) → 검증 → prod(도쿄) 순으로 SQL Editor 에서 실행

-- ---------- 약관/개인정보 동의 기록 ----------
create table if not exists public.user_consents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,                          -- 예: '2026-09-12'
  method        text not null default 'signup',         -- 'signup' | 'oauth' | 'reconsent'
  ip            text,
  user_agent    text,
  agreed_at     timestamptz not null default now()
);
create index if not exists user_consents_user_idx on public.user_consents(user_id, agreed_at desc);
alter table public.user_consents enable row level security;
drop policy if exists "consents: own read" on public.user_consents;
create policy "consents: own read" on public.user_consents
  for select using (auth.uid() = user_id);

-- ---------- 이미지 신고 ----------
create table if not exists public.image_reports (
  id          uuid primary key default gen_random_uuid(),
  image_id    uuid references public.images(id) on delete set null,
  image_url   text,                                     -- 이미지가 삭제돼도 근거 보존
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason      text not null,                            -- 'sexual' | 'violence' | 'hate' | 'religious' | 'other'
  details     text,
  status      text not null default 'open',             -- 'open' | 'reviewed' | 'dismissed'
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists image_reports_status_idx on public.image_reports(status, created_at desc);
alter table public.image_reports enable row level security;
drop policy if exists "reports: own read" on public.image_reports;
create policy "reports: own read" on public.image_reports
  for select using (auth.uid() = reporter_id);

-- 신고된 이미지 표시 (갤러리에서 흐리게)
alter table public.images add column if not exists is_flagged boolean not null default false;

-- ---------- 결과 이미지 검수 로그 (차단된 생성 기록; 이미지는 저장하지 않음) ----------
create table if not exists public.moderation_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  stage       text not null,                            -- 'prompt' | 'output'
  model_id    text,
  prompt      text,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists moderation_log_user_idx on public.moderation_log(user_id, created_at desc);
alter table public.moderation_log enable row level security; -- service_role 만 접근
