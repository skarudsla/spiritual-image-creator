'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface SessionUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface DashboardContextValue {
  user: SessionUser;
  credits: number | null;
  setCredits: (n: number | null) => void;
  refreshCredits: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardShell');
  return ctx;
}

/** production | preview | development — Vercel 환경 변수로 주입, 없으면 development */
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV || 'development';

const NAV = [
  { href: '/dashboard', label: '홈' },
  { href: '/dashboard/generate', label: '이미지 생성' },
  { href: '/dashboard/gallery', label: '갤러리' },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/credit', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success) setCredits(data.credit.balance);
    } catch {
      /* 헤더 표시용이므로 조용히 무시 */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 401) {
          router.replace(`/auth/signin?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (!res.ok || !data.success) {
          setError(data.error || '사용자 정보를 불러오지 못했습니다.');
          return;
        }
        setUser(data.user);
        refreshCredits();
      } catch {
        if (!cancelled) setError('네트워크 오류가 발생했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } finally {
      router.replace('/auth/signin');
      router.refresh();
    }
  };

  const displayName = user
    ? [user.lastName, user.firstName].filter(Boolean).join('') || user.email || '사용자'
    : '';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #1e293b, #0f172a)',
      color: 'white',
      padding: '20px'
    }}>
      <header style={{
        maxWidth: '1100px',
        margin: '0 auto 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '14px 24px',
        background: '#1e293b',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <Link href="/dashboard" style={{ color: 'white', textDecoration: 'none', fontSize: '20px', fontWeight: 'bold' }}>
            Spiritual Image Creator
          </Link>
          {APP_ENV !== 'production' && (
            <span
              title="테스트 환경 — 실서버 데이터와 분리되어 있습니다"
              style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e293b', background: '#f59e0b', borderRadius: '4px', padding: '2px 8px', letterSpacing: '0.5px' }}
            >
              {APP_ENV === 'preview' ? 'PREVIEW' : 'DEV'}
            </span>
          )}
          <nav style={{ display: 'flex', gap: '4px' }}>
            {NAV.map(item => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    textDecoration: 'none',
                    color: active ? 'white' : '#cbd5e1',
                    background: active ? '#334155' : 'transparent',
                    fontWeight: active ? 'bold' : 'normal'
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span
              title="남은 크레딧"
              style={{
                fontSize: '13px',
                color: '#10b981',
                border: '1px solid #10b981',
                borderRadius: '999px',
                padding: '4px 12px',
                fontWeight: 'bold'
              }}
            >
              ✨ {credits === null ? '–' : credits} 크레딧
            </span>
            <span style={{ color: '#cbd5e1', fontSize: '14px' }}>{displayName}님</span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                padding: '8px 16px',
                background: signingOut ? '#4b5563' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: signingOut ? 'not-allowed' : 'pointer'
              }}
            >
              {signingOut ? '로그아웃 중...' : '로그아웃'}
            </button>
          </div>
        )}
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {loading && <p style={{ color: '#cbd5e1', textAlign: 'center' }}>불러오는 중...</p>}

        {error && (
          <div style={{ background: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
            ❌ {error}
          </div>
        )}

        {user && (
          <DashboardContext.Provider value={{ user, credits, setCredits, refreshCredits }}>
            {children}
          </DashboardContext.Provider>
        )}
      </main>
    </div>
  );
}
