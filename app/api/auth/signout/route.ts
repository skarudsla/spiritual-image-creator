import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 로그아웃: Supabase 세션 무효화 + 쿠키 삭제 */
export async function POST() {
  const accessToken = cookies().get(ACCESS_TOKEN_COOKIE)?.value;

  // 서버 측 세션 무효화 (실패해도 쿠키는 반드시 지움)
  if (accessToken) {
    try {
      await supabaseAdmin.auth.admin.signOut(accessToken);
    } catch (err) {
      console.warn('[signout] server-side signOut failed (ignored):', err);
    }
  }

  const res = NextResponse.json({ success: true, message: '로그아웃되었습니다.' });
  res.cookies.delete(ACCESS_TOKEN_COOKIE);
  res.cookies.delete(REFRESH_TOKEN_COOKIE);
  return res;
}
