import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/supabase';

/** 클라이언트에 내려줄 최소한의 사용자 정보 */
export interface SessionUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface SessionResult {
  user: SessionUser | null;
  /** refresh token으로 새 세션을 발급한 경우 — 호출자가 쿠키를 갱신해야 함 */
  refreshed?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  /** 인증 서버에 연결 자체가 안 된 경우 */
  serverError?: boolean;
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email ?? null,
    firstName: user.user_metadata?.firstName ?? null,
    lastName: user.user_metadata?.lastName ?? null,
  };
}

function isConnectivityError(error: { name?: string; status?: number } | null): boolean {
  if (!error) return false;
  return (
    error.name === 'AuthRetryableFetchError' ||
    error.name === 'AuthUnknownError' ||
    !error.status ||
    error.status >= 500
  );
}

/**
 * 쿠키의 토큰으로 현재 로그인 사용자를 조회합니다.
 * access token이 만료되었으면 refresh token으로 자동 갱신을 시도합니다.
 * (API Route / Server Component 전용)
 */
export async function getSessionUser(): Promise<SessionResult> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return { user: null };
  }

  // 1) access token 검증
  if (accessToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (!error && data.user) {
      return { user: toSessionUser(data.user) };
    }
    if (isConnectivityError(error)) {
      return { user: null, serverError: true };
    }
    // 만료/무효 → 아래에서 refresh 시도
  }

  // 2) refresh token으로 갱신
  if (refreshToken) {
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (!error && data.session && data.user) {
      return {
        user: toSessionUser(data.user),
        refreshed: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresIn: data.session.expires_in,
        },
      };
    }
    if (isConnectivityError(error)) {
      return { user: null, serverError: true };
    }
  }

  return { user: null };
}

/** 세션 쿠키 옵션 (signin / me 갱신에서 공통 사용) */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}
