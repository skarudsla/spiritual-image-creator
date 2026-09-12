import { NextResponse } from 'next/server';
import { listVisibleModels, DEFAULT_MODEL_ID } from '@/lib/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 선택 가능한 모델 목록 (로그인 불필요) */
export async function GET() {
  const models = await listVisibleModels();
  return NextResponse.json({ success: true, models, defaultModelId: DEFAULT_MODEL_ID });
}
