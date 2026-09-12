import { createClient } from '@supabase/supabase-js';

/** 환경변수 앞뒤 공백/따옴표 제거 (대시보드 붙여넣기 실수 방지) */
function cleanEnv(v: string | undefined): string | undefined {
  const t = v?.trim().replace(/^["']|["']$/g, '').trim();
  return t || undefined;
}

const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
}

/**
 * 서버 전용 Supabase 클라이언트 (API Route에서만 사용)
 * 서비스 롤 키를 사용하므로 절대 클라이언트 컴포넌트에서 import 하지 마세요.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

/** 세션 쿠키 이름 (로그인/로그아웃/미들웨어에서 공통 사용) */
export const ACCESS_TOKEN_COOKIE = 'sb-access-token';
export const REFRESH_TOKEN_COOKIE = 'sb-refresh-token';
