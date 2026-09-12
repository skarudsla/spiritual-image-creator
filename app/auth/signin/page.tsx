'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  border: '1px solid #475569',
  borderRadius: '6px',
  background: '#0f172a',
  color: 'white',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '5px',
  fontSize: '14px',
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.6-2 15.4-5.6l-7.5-5.8c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 보호 경로에서 리다이렉트된 경우 로그인 후 원래 위치로 복귀 (내부 경로만 허용)
  const nextParam = searchParams.get('next');
  const redirectTo = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/dashboard';
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const justConfirmed = searchParams.get('confirmed') === '1';
  const oauthError = searchParams.get('oauth_error');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setNeedsConfirm(false);
    setResendMsg('');

    // ---- 클라이언트 유효성 검사 ----
    if (!formData.email || !formData.password) {
      setError('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || '로그인에 실패했습니다.');
        setNeedsConfirm(data.code === 'EMAIL_NOT_CONFIRMED');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 800);
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    try {
      const res = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      const data = await res.json();
      setResendMsg(data.success ? '✅ 인증 메일을 다시 보냈습니다. 받은 편지함을 확인해주세요.' : `❌ ${data.error}`);
    } catch {
      setResendMsg('❌ 네트워크 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(to bottom, #1e293b, #0f172a)',
      color: 'white',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: '#1e293b',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '10px', textAlign: 'center' }}>로그인</h1>
        <p style={{ textAlign: 'center', color: '#cbd5e1', marginBottom: '30px' }}>
          계정에 로그인하세요
        </p>

        {success && (
          <div style={{
            background: '#10b981',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            ✅ 로그인 성공! 이동 중...
          </div>
        )}

        {justConfirmed && !error && !success && (
          <div style={{
            background: '#10b981',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            ✅ 이메일 인증이 완료되었습니다. 로그인해주세요.
          </div>
        )}

        {oauthError && !error && (
          <div style={{ background: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
            ❌ Google 로그인에 실패했습니다. 다시 시도해주세요. ({oauthError})
          </div>
        )}

        {error && (
          <div style={{
            background: '#ef4444',
            color: 'white',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            ❌ {error}
            {needsConfirm && (
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleResend}
                  style={{ background: 'white', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '6px 10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  인증 메일 다시 보내기
                </button>
                {resendMsg && <p style={{ margin: '8px 0 0', fontSize: '12px' }}>{resendMsg}</p>}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="email" style={labelStyle}>이메일</label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="이메일을 입력하세요"
              disabled={loading}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="password" style={labelStyle}>비밀번호</label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호를 입력하세요"
              disabled={loading}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            style={{
              width: '100%',
              padding: '12px',
              background: loading || success ? '#4b5563' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading || success ? 'not-allowed' : 'pointer',
              marginBottom: '15px'
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 15px', color: '#64748b', fontSize: '12px' }}>
            <span style={{ flex: 1, height: '1px', background: '#334155' }} />또는<span style={{ flex: 1, height: '1px', background: '#334155' }} />
          </div>

          <a
            href={`/api/auth/google?next=${encodeURIComponent(redirectTo)}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              width: '100%', padding: '11px', boxSizing: 'border-box',
              background: 'white', color: '#1f2937', borderRadius: '6px',
              fontSize: '15px', fontWeight: 'bold', textDecoration: 'none', marginBottom: '20px'
            }}
          >
            <GoogleIcon /> Google 계정으로 로그인
          </a>

          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#cbd5e1', marginBottom: '10px' }}>아직 계정이 없으신가요?</p>
            <Link href="/auth/signup" style={{
              color: '#3b82f6',
              textDecoration: 'none',
              fontWeight: 'bold'
            }}>
              회원가입하기
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
