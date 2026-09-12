import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 내 크레딧 잔액 조회 */
export async function GET() {
  const { user, serverError } = await getSessionUser();
  if (serverError) {
    return NextResponse.json({ success: false, error: '인증 서버에 연결할 수 없습니다.' }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('credits')
    .select('balance, total_used, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[credit] query error:', error);
    return NextResponse.json({ success: false, error: '크레딧 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  // 트리거 이전 가입자 등 행이 없으면 기본값으로 생성
  if (!data) {
    const { data: created, error: insertErr } = await supabaseAdmin
      .from('credits')
      .insert({ user_id: user.id })
      .select('balance, total_used, updated_at')
      .single();
    if (insertErr) {
      console.error('[credit] insert error:', insertErr);
      return NextResponse.json({ success: false, error: '크레딧 초기화 중 오류가 발생했습니다.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, credit: created });
  }

  return NextResponse.json({ success: true, credit: data });
}
