import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkSignupAllowed, clientIp } from '@/lib/limits';

export const runtime = 'nodejs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isConnectivityError(error: { name?: string; status?: number }): boolean {
  return (
    error.name === 'AuthRetryableFetchError' ||
    error.name === 'AuthUnknownError' ||
    !error.status ||
    error.status >= 500
  );
}

/** 인증 메일의 링크가 되돌아올 주소 (Supabase → Redirect URLs 에 등록 필요) */
function emailRedirectTo(request: NextRequest): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
  return `${origin.replace(/\/$/, '')}/auth/signin?confirmed=1`;
}

export async function POST(request: NextRequest) {
  // ---- IP 기준 가입 시도 제한 ----
  const limit = await checkSignupAllowed(clientIp(request));
  if (!limit.ok) {
    return NextResponse.json({ success: false, error: limit.message }, { status: 429 });
  }

  let body: { firstName?: string; lastName?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const firstName = (body.firstName ?? '').trim();
  const lastName = (body.lastName ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json({ success: false, error: '모든 필드를 입력해주세요.' }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ success: false, error: '올바른 이메일 형식을 입력해주세요.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ success: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' }, { status: 400 });
  }

  // ---- Supabase Auth 가입 (인증 메일 발송; Supabase 설정에서 "Confirm email" 이 켜져 있어야 함) ----
  try {
    const { data, error } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: { firstName, lastName },
        emailRedirectTo: emailRedirectTo(request),
      },
    });

    if (error) {
      if (isConnectivityError(error)) {
        console.error('[signup] auth server unreachable:', error.name, error.message);
        return NextResponse.json(
          { success: false, error: '인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.' },
          { status: 503 }
        );
      }
      const msg = error.message.toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || error.status === 422) {
        return NextResponse.json({ success: false, error: '이미 가입된 이메일입니다.' }, { status: 409 });
      }
      if (msg.includes('rate limit') || error.status === 429) {
        return NextResponse.json(
          { success: false, error: '인증 메일 발송 한도에 도달했습니다. 잠시 후 다시 시도해주세요.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { success: false, error: error.message || '회원가입 중 오류가 발생했습니다.' },
        { status: error.status ?? 400 }
      );
    }

    // Supabase 는 이미 가입된 이메일로 signUp 하면 (열거 방지를 위해) 에러 없이 identities=[] 를 돌려줌
    const alreadyExists = data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
    if (alreadyExists) {
      return NextResponse.json({ success: false, error: '이미 가입된 이메일입니다.' }, { status: 409 });
    }

    // 세션이 바로 발급되면 "Confirm email" 이 꺼진 상태 → 인증 없이 완료
    const needsConfirmation = !data.session;

    return NextResponse.json(
      {
        success: true,
        needsConfirmation,
        message: needsConfirmation
          ? '인증 메일을 보냈습니다. 받은 편지함에서 링크를 눌러 가입을 완료해주세요.'
          : '회원가입이 완료되었습니다.',
        user: { id: data.user?.id, email, firstName, lastName },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[signup] unexpected error:', err);
    return NextResponse.json({ success: false, error: '회원가입 처리 중 서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
