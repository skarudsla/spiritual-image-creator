import { NextResponse } from 'next/server';
import { getSessionUser, sessionCookieOptions } from '@/lib/auth';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 현재 로그인한 사용자 정보 조회 */
export async function GET() {
  try {
    const { user, refreshed, serverError } = await getSessionUser();

    if (serverError) {
      return NextResponse.json(
        { success: false, error: '인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }

    if (!user) {
      const res = NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
      // 유효하지 않은 쿠키는 정리
      res.cookies.delete(ACCESS_TOKEN_COOKIE);
      res.cookies.delete(REFRESH_TOKEN_COOKIE);
      return res;
    }

    const res = NextResponse.json({ success: true, user });

    // refresh token으로 새 세션을 발급받았으면 쿠키 갱신
    if (refreshed) {
      const base = sessionCookieOptions();
      res.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.accessToken, {
        ...base,
        maxAge: refreshed.expiresIn,
      });
      res.cookies.set(REFRESH_TOKEN_COOKIE, refreshed.refreshToken, {
        ...base,
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return res;
  } catch (err) {
    console.error('[me] unexpected error:', err);
    return NextResponse.json(
      { success: false, error: '사용자 정보 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
