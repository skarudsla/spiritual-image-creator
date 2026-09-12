import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/supabase';
import { sessionCookieOptions, toSessionUser } from '@/lib/auth';
import { hasCurrentConsent, recordConsent } from '@/lib/consent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * OAuth 콜백에서 받은 토큰으로 httpOnly 쿠키 세션 생성.
 * 토큰은 Supabase 에 검증(getUser)한 뒤에만 쿠키로 저장한다.
 */
export async function POST(request: NextRequest) {
  let body: { accessToken?: string; refreshToken?: string; expiresIn?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const accessToken = body.accessToken ?? '';
  const refreshToken = body.refreshToken ?? '';
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ success: false, error: '토큰이 없습니다.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    return NextResponse.json({ success: false, error: '유효하지 않은 로그인입니다.' }, { status: 401 });
  }

  const user = data.user;

  // 소셜 로그인 사용자: 이름 메타데이터 보정 (Google 은 full_name/name 으로 옴)
  if (!user.user_metadata?.firstName && (user.user_metadata?.full_name || user.user_metadata?.name)) {
    const full = String(user.user_metadata.full_name || user.user_metadata.name).trim();
    const hasSpace = full.includes(' ');
    const firstName = hasSpace ? full.split(' ').slice(1).join(' ') : full;
    const lastName = hasSpace ? full.split(' ')[0] : '';
    await supabaseAdmin.auth.admin
      .updateUserById(user.id, { user_metadata: { ...user.user_metadata, firstName, lastName } })
      .catch(err => console.warn('[session] name metadata update failed:', err));
    user.user_metadata = { ...user.user_metadata, firstName, lastName };
  }

  // 약관 동의 기록 ("Google 로 계속하면 동의" 문구로 고지됨)
  if (!(await hasCurrentConsent(user.id))) {
    await recordConsent(user.id, 'oauth', request);
  }

  const res = NextResponse.json({ success: true, user: toSessionUser(user) });
  const base = sessionCookieOptions();
  res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...base,
    maxAge: typeof body.expiresIn === 'number' && body.expiresIn > 0 ? body.expiresIn : 3600,
  });
  res.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, { ...base, maxAge: 60 * 60 * 24 * 30 });
  return res;
}
