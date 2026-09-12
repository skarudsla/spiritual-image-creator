import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #1e293b, #0f172a)',
      color: 'white',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: '#1e293b',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        lineHeight: 1.7
      }}>
        <nav style={{ display: 'flex', gap: '16px', marginBottom: '24px', fontSize: '14px' }}>
          <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}>← 홈</Link>
          <Link href="/legal/terms" style={{ color: '#cbd5e1', textDecoration: 'none' }}>이용약관</Link>
          <Link href="/legal/privacy" style={{ color: '#cbd5e1', textDecoration: 'none' }}>개인정보처리방침</Link>
        </nav>
        <article className="legal">{children}</article>
        <style>{`
          .legal h1 { font-size: 28px; margin: 0 0 6px; }
          .legal h2 { font-size: 18px; margin: 28px 0 8px; color: #10b981; }
          .legal p, .legal li { color: #cbd5e1; font-size: 14px; }
          .legal ul { padding-left: 20px; }
          .legal .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
        `}</style>
      </div>
    </div>
  );
}
