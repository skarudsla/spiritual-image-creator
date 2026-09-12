'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * OAuth 콜백 — Supabase 가 URL 해시(#access_token=...)로 돌려준 토큰을
 * /api/auth/session 에 넘겨 httpOnly 쿠키 세션으로 바꾼 뒤 이동한다.
 * (해시는 서버로 전송되지 않으므로 클라이언트 컴포넌트가 필요)
 */
function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('로그인 처리 중...');

  useEffect(() => {
    const next = searchParams.get('next') ?? '/dashboard';
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errorDesc = hash.get('error_description') || hash.get('error') || searchParams.get('error_description');
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const expiresIn = Number(hash.get('expires_in') || 3600);

    if (errorDesc || !accessToken || !refreshToken) {
      router.replace(`/auth/signin?oauth_error=${encodeURIComponent(errorDesc || 'no_token')}`);
      return;
    }

    // 주소창의 토큰 제거
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    (async () => {
      try {
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, refreshToken, expiresIn }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          router.replace(`/auth/signin?oauth_error=${encodeURIComponent(data.error || 'session_failed')}`);
          return;
        }
        setMessage('로그인 완료! 이동 중...');
        router.replace(safeNext);
        router.refresh();
      } catch {
        router.replace('/auth/signin?oauth_error=network');
      }
    })();
  }, [router, searchParams]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(to bottom, #1e293b, #0f172a)', color: '#cbd5e1'
    }}>
      <p>{message}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
