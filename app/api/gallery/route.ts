import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

/** 내가 생성한 이미지 목록 (최신순, ?page=1 부터) */
export async function GET(request: NextRequest) {
  const { user, serverError } = await getSessionUser();
  if (serverError) {
    return NextResponse.json({ success: false, error: '인증 서버에 연결할 수 없습니다.' }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabaseAdmin
    .from('images')
    .select('id, prompt, prompt_en, style, scripture, model, model_id, mode, width, height, image_url, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[gallery] query error:', error);
    return NextResponse.json({ success: false, error: '갤러리 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    images: data ?? [],
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    hasMore: count != null ? to + 1 < count : false,
  });
}
