import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: '잘못된 요청 형식입니다.' },
      { status: 400 }
    );
  }

  const firstName = (body.firstName ?? '').trim();
  const lastName = (body.lastName ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  // ---- 서버 유효성 검사 ----
  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json(
      { success: false, error: '모든 필드를 입력해주세요.' },
      { status: 400 }
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { success: false, error: '올바른 이메일 형식을 입력해주세요.' },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { success: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' },
      { status: 400 }
    );
  }

  // ---- Supabase Auth 사용자 생성 ----
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 개발 단계: 이메일 인증 없이 바로 로그인 가능
      user_metadata: { firstName, lastName },
    });

    if (error) {
      const isConnectivityError =
        error.name === 'AuthRetryableFetchError' ||
        error.name === 'AuthUnknownError' ||
        !error.status ||
        error.status >= 500;

      if (isConnectivityError) {
        console.error('[signup] auth server unreachable:', error.name, error.message);
        return NextResponse.json(
          { success: false, error: '인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.' },
          { status: 503 }
        );
      }

      const msg = error.message.toLowerCase();
      if (msg.includes('already') || error.status === 422) {
        return NextResponse.json(
          { success: false, error: '이미 가입된 이메일입니다.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message || '회원가입 중 오류가 발생했습니다.' },
        { status: error.status ?? 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: '회원가입이 완료되었습니다.',
        user: {
          id: data.user.id,
          email: data.user.email,
          firstName,
          lastName,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[signup] unexpected error:', err);
    return NextResponse.json(
      { success: false, error: '회원가입 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
