import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/supabase';
import { checkSigninAllowed, clientIp } from '@/lib/limits';

export const runtime = 'nodejs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  // ---- IP 기준 로그인 시도 제한 (무차별 대입 방어) ----
  const limit = await checkSigninAllowed(clientIp(request));
  if (!limit.ok) {
    return NextResponse.json({ success: false, error: limit.message }, { status: 429 });
  }

  let body: { email?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: '잘못된 요청 형식입니다.' },
      { status: 400 }
    );
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  // ---- 서버 유효성 검사 ----
  if (!email || !password) {
    return NextResponse.json(
      { success: false, error: '이메일과 비밀번호를 모두 입력해주세요.' },
      { status: 400 }
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { success: false, error: '올바른 이메일 형식을 입력해주세요.' },
      { status: 400 }
    );
  }

  // ---- Supabase 인증 ----
  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      // 네트워크/서버 장애 (Supabase 응답 자체가 없거나 비정상) → 503
      const isConnectivityError =
        !!error &&
        (error.name === 'AuthRetryableFetchError' ||
          error.name === 'AuthUnknownError' ||
          !error.status ||
          error.status >= 500);

      if (isConnectivityError) {
        console.error('[signin] auth server unreachable:', error?.name, error?.message);
        return NextResponse.json(
          { success: false, error: '인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.' },
          { status: 503 }
        );
      }

      const status = error?.status ?? 401;
      let message = '이메일 또는 비밀번호가 올바르지 않습니다.';

      let code: string | undefined;
      if (error?.message?.toLowerCase().includes('email not confirmed')) {
        message = '이메일 인증이 완료되지 않았습니다. 받은 편지함에서 인증 링크를 눌러주세요.';
        code = 'EMAIL_NOT_CONFIRMED';
      } else if (status === 429) {
        message = '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
      }

      return NextResponse.json(
        { success: false, error: message, ...(code ? { code } : {}) },
        { status: status === 400 ? 401 : status }
      );
    }

    const { session, user } = data;

    const response = NextResponse.json({
      success: true,
      message: '로그인에 성공했습니다.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.user_metadata?.firstName ?? null,
        lastName: user.user_metadata?.lastName ?? null,
      },
    });

    // ---- 세션 관리: httpOnly 쿠키에 토큰 저장 ----
    const isProd = process.env.NODE_ENV === 'production';
    const cookieBase = {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
    };

    response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, {
      ...cookieBase,
      maxAge: session.expires_in, // 보통 3600초
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
      ...cookieBase,
      maxAge: 60 * 60 * 24 * 30, // 30일
    });

    return response;
  } catch (err) {
    console.error('[signin] unexpected error:', err);
    return NextResponse.json(
      { success: false, error: '로그인 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
