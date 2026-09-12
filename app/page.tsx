import Link from 'next/link';

export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(to bottom, #1e293b, #0f172a)',
      color: 'white',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>Spiritual Image Creator</h1>
      <p style={{ fontSize: '20px', marginBottom: '40px', color: '#cbd5e1' }}>
        Create beautiful biblical and spiritual images with AI
      </p>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <Link href="/auth/signin" style={{
          background: '#3b82f6',
          color: 'white',
          padding: '12px 32px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 'bold'
        }}>
          Sign In
        </Link>
        <Link href="/auth/signup" style={{
          background: '#10b981',
          color: 'white',
          padding: '12px 32px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 'bold'
        }}>
          Sign Up
        </Link>
      </div>

      <footer style={{ marginTop: '60px', fontSize: '13px', color: '#64748b', display: 'flex', gap: '16px' }}>
        <Link href="/legal/terms" style={{ color: '#94a3b8', textDecoration: 'none' }}>이용약관</Link>
        <Link href="/legal/privacy" style={{ color: '#94a3b8', textDecoration: 'none' }}>개인정보처리방침</Link>
      </footer>
    </div>
  );
}
