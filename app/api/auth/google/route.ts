import { NextRequest, NextResponse } from 'next/server';
import { SUPABASE_URL } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Google 로그인 시작 — Supabase Auth 의 authorize 엔드포인트로 보냄.
 * Supabase 가 Google 인증을 마치면 /auth/callback 으로 토큰(URL 해시)을 돌려주고,
 * 그 페이지가 /api/auth/session 에 토큰을 전달해 httpOnly 쿠키 세션을 만든다.
 *
 * 사전 설정:
 *  - Supabase → Authentication → Providers → Google 활성화 (Client ID/Secret)
 *  - Supabase → Authentication → URL Configuration → Redirect URLs 에 <사이트>/auth/callback 등록
 */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') ?? '/dashboard';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
  const callback = `${origin.replace(/\/$/, '')}/auth/callback?next=${encodeURIComponent(safeNext)}`;

  const url = new URL('/auth/v1/authorize', SUPABASE_URL);
  url.searchParams.set('provider', 'google');
  url.searchParams.set('redirect_to', callback);

  return NextResponse.redirect(url.toString());
}
