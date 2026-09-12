import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 경로 보호 미들웨어
 * - 보호 경로: 세션 쿠키가 없으면 /auth/signin 으로 리다이렉트 (원래 경로는 ?next= 로 전달)
 * - 인증 페이지: 이미 세션 쿠키가 있으면 /dashboard 로 리다이렉트
 *
 * 쿠키 존재 여부만 확인합니다 (Edge 런타임). 실제 토큰 검증은 /api/auth/me 가 담당합니다.
 */
const ACCESS_TOKEN_COOKIE = 'sb-access-token';
const REFRESH_TOKEN_COOKIE = 'sb-refresh-token';

const PROTECTED_PREFIXES = ['/dashboard'];
const AUTH_PAGES = ['/auth/signin', '/auth/signup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession =
    !!request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ||
    !!request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  const isProtected = PROTECTED_PREFIXES.some(
    p => pathname === p || pathname.startsWith(p + '/')
  );
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/signin';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (isAuthPage && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/signin', '/auth/signup'],
};
