import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkSignupAllowed, clientIp } from '@/lib/limits';

export const runtime = 'nodejs';

/** 인증 메일 재발송 (가입과 같은 IP 제한을 공유) */
export async function POST(request: NextRequest) {
  const limit = await checkSignupAllowed(clientIp(request));
  if (!limit.ok) {
    return NextResponse.json({ success: false, error: limit.message }, { status: 429 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }
  const email = (body.email ?? '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ success: false, error: '이메일을 입력해주세요.' }, { status: 400 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
  const { error } = await supabaseAdmin.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${origin.replace(/\/$/, '')}/auth/signin?confirmed=1` },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate limit') || error.status === 429) {
      return NextResponse.json(
        { success: false, error: '메일 발송 한도에 도달했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }
    console.warn('[resend] error:', error.message);
  }

  // 계정 존재 여부를 노출하지 않기 위해 항상 같은 응답
  return NextResponse.json({ success: true, message: '가입된 이메일이라면 인증 메일을 다시 보냈습니다.' });
}
