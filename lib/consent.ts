import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { TERMS_VERSION } from '@/lib/legal';
import { clientIp } from '@/lib/limits';

/** 약관 동의 기록 (서버 전용). 실패해도 가입 흐름은 막지 않고 로그만 남김 */
export async function recordConsent(
  userId: string,
  method: 'signup' | 'oauth' | 'reconsent',
  request: NextRequest
): Promise<void> {
  const { error } = await supabaseAdmin.from('user_consents').insert({
    user_id: userId,
    terms_version: TERMS_VERSION,
    method,
    ip: clientIp(request),
    user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
  });
  if (error) console.error('[consent] insert error:', error.message);
}

/** 현재 버전 약관에 동의한 기록이 있는지 */
export async function hasCurrentConsent(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('user_consents')
    .select('id')
    .eq('user_id', userId)
    .eq('terms_version', TERMS_VERSION)
    .limit(1);
  if (error) {
    console.error('[consent] lookup error:', error.message);
    return true; // 조회 실패 시 사용자를 막지 않음
  }
  return (data?.length ?? 0) > 0;
}
