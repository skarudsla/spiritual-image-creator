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
