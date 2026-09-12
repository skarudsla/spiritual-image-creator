import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'generated-images';

/** 내 이미지 삭제 (DB 행 + Storage 파일) */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { user, serverError } = await getSessionUser();
  if (serverError) {
    return NextResponse.json({ success: false, error: '인증 서버에 연결할 수 없습니다.' }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data: row, error: findErr } = await supabaseAdmin
    .from('images')
    .select('id, storage_path')
    .eq('id', params.id)
    .eq('user_id', user.id) // 본인 소유만
    .maybeSingle();

  if (findErr) {
    console.error('[gallery:delete] find error:', findErr);
    return NextResponse.json({ success: false, error: '이미지 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ success: false, error: '이미지를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { error: delErr } = await supabaseAdmin.from('images').delete().eq('id', row.id);
  if (delErr) {
    console.error('[gallery:delete] db delete error:', delErr);
    return NextResponse.json({ success: false, error: '이미지 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }

  const { error: storageErr } = await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
  if (storageErr) console.warn('[gallery:delete] storage remove failed (ignored):', storageErr);

  return NextResponse.json({ success: true });
}
