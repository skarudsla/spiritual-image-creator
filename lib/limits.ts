import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * 남용 방어 (서버 전용)
 *  - 계정/IP 기준 요청 횟수 제한 (DB 기반 → Vercel 다중 인스턴스에서도 공유)
 *  - 전체 생성 수 상한 (하루 예산) + 수동 일시정지 스위치
 *
 * 환경변수 (모두 선택, 기본값 있음):
 *   GEN_LIMIT_PER_MIN=3          계정당 분당 생성 요청
 *   GEN_LIMIT_PER_HOUR=20        계정당 시간당 생성 요청
 *   SIGNUP_LIMIT_PER_HOUR=5      IP당 시간당 가입 시도
 *   SIGNIN_LIMIT_PER_15MIN=10    IP당 15분당 로그인 시도
 *   GLOBAL_DAILY_GENERATION_CAP=300   하루 전체 생성 상한 (FLUX.2-dev 기준 약 $5)
 *   GENERATION_PAUSED=1          긴급 일시정지 (값이 있으면 모든 생성 차단)
 */

function intEnv(name: string, fallback: number): number {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const LIMITS = {
  genPerMin: intEnv('GEN_LIMIT_PER_MIN', 3),
  genPerHour: intEnv('GEN_LIMIT_PER_HOUR', 20),
  signupPerHour: intEnv('SIGNUP_LIMIT_PER_HOUR', 5),
  signinPer15Min: intEnv('SIGNIN_LIMIT_PER_15MIN', 10),
  globalDailyCap: intEnv('GLOBAL_DAILY_GENERATION_CAP', 300),
};

export function isGenerationPaused(): boolean {
  const v = process.env.GENERATION_PAUSED?.trim().toLowerCase();
  return !!v && v !== '0' && v !== 'false';
}

/** 요청자 IP (Vercel/프록시 헤더 우선) */
export function clientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? request.ip ?? 'unknown';
}

export interface LimitResult {
  ok: boolean;
  /** 사용자에게 보여줄 메시지 (ok=false 일 때) */
  message?: string;
  /** DB 오류 등으로 판단 불가 — 호출자가 통과/차단 정책 결정 */
  unavailable?: boolean;
}

async function check(bucket: string, action: string, limit: number, windowSeconds: number): Promise<boolean | null> {
  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_bucket: bucket,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[limits] check_rate_limit error:', error.message);
    return null;
  }
  return data === true;
}

/** 이미지 생성: 계정당 분/시간 제한 + 전체 일일 상한 + 일시정지 */
export async function checkGenerationAllowed(userId: string): Promise<LimitResult> {
  if (isGenerationPaused()) {
    return { ok: false, message: '이미지 생성이 잠시 중단되었습니다. 잠시 후 다시 시도해주세요.' };
  }

  // 전체 일일 상한 (예산 보호)
  const { data: globalCount, error: gErr } = await supabaseAdmin.rpc('global_generation_count', {
    p_window_seconds: 60 * 60 * 24,
  });
  if (gErr) {
    console.error('[limits] global_generation_count error:', gErr.message);
    return { ok: false, unavailable: true, message: '잠시 후 다시 시도해주세요.' };
  }
  if ((globalCount ?? 0) >= LIMITS.globalDailyCap) {
    console.warn(`[limits] GLOBAL DAILY CAP REACHED (${globalCount}/${LIMITS.globalDailyCap})`);
    return { ok: false, message: '오늘 생성 한도에 도달했습니다. 내일 다시 시도해주세요.' };
  }

  // 계정당 시간당 → 분당 순서 (둘 다 기록되므로 순서는 무관, 메시지만 구분)
  const perHour = await check(`user:${userId}`, 'generate_h', LIMITS.genPerHour, 3600);
  if (perHour === null) return { ok: false, unavailable: true, message: '잠시 후 다시 시도해주세요.' };
  if (!perHour) {
    return { ok: false, message: `시간당 최대 ${LIMITS.genPerHour}장까지 생성할 수 있습니다. 잠시 후 다시 시도해주세요.` };
  }

  const perMin = await check(`user:${userId}`, 'generate_m', LIMITS.genPerMin, 60);
  if (perMin === null) return { ok: false, unavailable: true, message: '잠시 후 다시 시도해주세요.' };
  if (!perMin) {
    return { ok: false, message: `너무 빠르게 요청하고 있습니다. 1분에 최대 ${LIMITS.genPerMin}장까지 생성할 수 있습니다.` };
  }

  return { ok: true };
}

/** 회원가입: IP당 시간당 제한 */
export async function checkSignupAllowed(ip: string): Promise<LimitResult> {
  const r = await check(`ip:${ip}`, 'signup', LIMITS.signupPerHour, 3600);
  if (r === null) return { ok: true, unavailable: true }; // 판단 불가 시 가입은 허용 (UX 우선)
  if (!r) return { ok: false, message: '가입 시도가 너무 많습니다. 1시간 후 다시 시도해주세요.' };
  return { ok: true };
}

/** 로그인: IP당 15분 제한 (비밀번호 무차별 대입 방어) */
export async function checkSigninAllowed(ip: string): Promise<LimitResult> {
  const r = await check(`ip:${ip}`, 'signin', LIMITS.signinPer15Min, 900);
  if (r === null) return { ok: true, unavailable: true };
  if (!r) return { ok: false, message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' };
  return { ok: true };
}
