'use client';

import Link from 'next/link';
import { useDashboard } from './DashboardShell';

const CARDS = [
  { href: '/dashboard/generate', title: '이미지 생성', desc: '성경 말씀과 프롬프트로 이미지 만들기', icon: '🎨' },
  { href: '/dashboard/gallery', title: '갤러리', desc: '내가 만든 이미지 모아보기', icon: '🖼️' },
];

export default function DashboardHome() {
  const { user, credits } = useDashboard();
  const displayName = [user.lastName, user.firstName].filter(Boolean).join('') || user.email || '사용자';

  return (
    <section style={{
      background: '#1e293b',
      padding: '40px',
      borderRadius: '12px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
      textAlign: 'center'
    }}>
      <h2 style={{ fontSize: '28px', marginBottom: '10px' }}>환영합니다, {displayName}님 👋</h2>
      <p style={{ color: '#cbd5e1', marginBottom: '30px' }}>
        {credits === null
          ? '크레딧을 확인하는 중입니다...'
          : credits > 0
            ? `이미지를 ${credits}장 더 만들 수 있습니다.`
            : '크레딧을 모두 사용했습니다.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {CARDS.map(card => (
          <Link key={card.href} href={card.href} style={{ textDecoration: 'none', color: 'white' }}>
            <div style={{
              background: '#0f172a',
              border: '1px solid #475569',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'left',
              height: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{card.icon}</div>
              <h3 style={{ fontSize: '17px', margin: '0 0 6px' }}>{card.title}</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
