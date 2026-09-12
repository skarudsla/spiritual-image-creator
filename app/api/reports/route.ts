import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const REPORT_REASONS = ['sexual', 'violence', 'hate', 'religious', 'other'] as const;
type ReportReason = (typeof REPORT_REASONS)[number];

/** 이미지 신고 접수 — 접수 즉시 해당 이미지는 is_flagged 로 표시 */
export async function POST(request: NextRequest) {
  const { user, serverError } = await getSessionUser();
  if (serverError) {
    return NextResponse.json({ success: false, error: '인증 서버에 연결할 수 없습니다.' }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
  }

  let body: { imageId?: string; reason?: string; details?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청 형식입니다.' }, { status: 400 });
  }

  const imageId = (body.imageId ?? '').trim();
  const reason = (body.reason ?? '').trim() as ReportReason;
  const details = (body.details ?? '').trim().slice(0, 1000) || null;

  if (!imageId || !REPORT_REASONS.includes(reason)) {
    return NextResponse.json({ success: false, error: '신고 대상과 사유를 선택해주세요.' }, { status: 400 });
  }

  const { data: image, error: findErr } = await supabaseAdmin
    .from('images')
    .select('id, image_url')
    .eq('id', imageId)
    .maybeSingle();
  if (findErr) {
    console.error('[reports] find image error:', findErr);
    return NextResponse.json({ success: false, error: '이미지 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
  if (!image) {
    return NextResponse.json({ success: false, error: '이미지를 찾을 수 없습니다.' }, { status: 404 });
  }

  // 같은 사용자가 같은 이미지를 중복 신고하면 기존 접수로 처리
  const { data: existing } = await supabaseAdmin
    .from('image_reports')
    .select('id')
    .eq('image_id', image.id)
    .eq('reporter_id', user.id)
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ success: true, duplicate: true, message: '이미 신고가 접수된 이미지입니다.' });
  }

  const { error: insErr } = await supabaseAdmin.from('image_reports').insert({
    image_id: image.id,
    image_url: image.image_url,
    reporter_id: user.id,
    reason,
    details,
  });
  if (insErr) {
    console.error('[reports] insert error:', insErr);
    return NextResponse.json({ success: false, error: '신고 접수 중 오류가 발생했습니다.' }, { status: 500 });
  }

  await supabaseAdmin.from('images').update({ is_flagged: true }).eq('id', image.id);

  return NextResponse.json({ success: true, message: '신고가 접수되었습니다. 검토 후 조치하겠습니다.' });
}
