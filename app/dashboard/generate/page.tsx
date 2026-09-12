'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDashboard } from '../DashboardShell';
import { IMAGE_STYLES, IMAGE_SIZES, type ImageStyle, type ImageSize, type GeneratedImage } from '@/lib/types';

const EXAMPLES = [
  { prompt: '갈릴리 호수 위를 걷는 예수님과 놀라는 제자들', scripture: '마태복음 14:25' },
  { prompt: '푸른 초장에서 양 떼를 돌보는 선한 목자', scripture: '시편 23:1' },
  { prompt: '홍해가 갈라지고 이스라엘 백성이 마른 땅을 건너는 장면', scripture: '출애굽기 14:21' },
  { prompt: '빈 무덤 앞 새벽빛과 굴러간 돌', scripture: '누가복음 24:2' },
];

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

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '14px' };

export default function GeneratePage() {
  const { credits, setCredits } = useDashboard();
  const [prompt, setPrompt] = useState('');
  const [scripture, setScripture] = useState('');
  const [style, setStyle] = useState<ImageStyle>('painting');
  const [size, setSize] = useState<ImageSize>('square');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GeneratedImage | null>(null);

  const noCredits = credits !== null && credits <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!prompt.trim()) {
      setError('어떤 장면을 만들지 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), scripture: scripture.trim(), style, size }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || '이미지 생성에 실패했습니다.');
        return;
      }

      setResult(data.image);
      if (typeof data.credits === 'number') setCredits(data.credits);
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const card: React.CSSProperties = {
    background: '#1e293b',
    padding: '28px',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
      {/* ---- 입력 폼 ---- */}
      <section style={card}>
        <h2 style={{ fontSize: '22px', margin: '0 0 6px' }}>이미지 생성</h2>
        <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '0 0 20px' }}>
          장면을 설명하면 성경적 분위기의 이미지를 만들어 드립니다. 1장당 1크레딧이 사용됩니다.
        </p>

        {error && (
          <div style={{ background: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            ❌ {error}
          </div>
        )}

        {noCredits && (
          <div style={{ background: '#f59e0b', color: '#1e293b', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
            ⚠️ 크레딧을 모두 사용했습니다.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="prompt" style={labelStyle}>장면 설명 *</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="예: 갈릴리 호수 위를 걷는 예수님과 놀라는 제자들"
              rows={4}
              maxLength={1000}
              disabled={loading}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>{prompt.length}/1000</div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="scripture" style={labelStyle}>관련 성경 구절 (선택)</label>
            <input
              id="scripture"
              type="text"
              value={scripture}
              onChange={e => setScripture(e.target.value)}
              placeholder="예: 마태복음 14:25"
              maxLength={100}
              disabled={loading}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label htmlFor="style" style={labelStyle}>스타일</label>
              <select id="style" value={style} onChange={e => setStyle(e.target.value as ImageStyle)} disabled={loading} style={inputStyle}>
                {Object.entries(IMAGE_STYLES).map(([key, s]) => (
                  <option key={key} value={key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="size" style={labelStyle}>크기</label>
              <select id="size" value={size} onChange={e => setSize(e.target.value as ImageSize)} disabled={loading} style={inputStyle}>
                {Object.entries(IMAGE_SIZES).map(([key, s]) => (
                  <option key={key} value={key}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || noCredits}
            style={{
              width: '100%',
              padding: '12px',
              background: loading || noCredits ? '#4b5563' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading || noCredits ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '생성 중... (10~30초)' : '✨ 이미지 생성 (1 크레딧)'}
          </button>
        </form>

        <div style={{ marginTop: '20px' }}>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 8px' }}>예시로 시작하기</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {EXAMPLES.map(ex => (
              <button
                key={ex.prompt}
                type="button"
                disabled={loading}
                onClick={() => { setPrompt(ex.prompt); setScripture(ex.scripture); }}
                style={{
                  fontSize: '12px',
                  padding: '6px 10px',
                  background: '#0f172a',
                  color: '#cbd5e1',
                  border: '1px solid #475569',
                  borderRadius: '999px',
                  cursor: 'pointer',
                }}
              >
                {ex.scripture}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---- 결과 ---- */}
      <section style={{ ...card, display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '22px', margin: '0 0 16px' }}>결과</h2>

        <div style={{
          flex: 1,
          minHeight: '320px',
          background: '#0f172a',
          border: '1px dashed #475569',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {loading ? (
            <p style={{ color: '#cbd5e1' }}>🎨 이미지를 그리는 중입니다...</p>
          ) : result ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.image_url} alt={result.prompt} style={{ maxWidth: '100%', maxHeight: '600px', display: 'block' }} />
          ) : (
            <p style={{ color: '#64748b', fontSize: '14px' }}>생성된 이미지가 여기에 표시됩니다</p>
          )}
        </div>

        {result && !loading && (
          <div style={{ marginTop: '14px', fontSize: '13px', color: '#cbd5e1' }}>
            <p style={{ margin: '0 0 4px' }}><strong>프롬프트:</strong> {result.prompt}</p>
            {result.scripture && <p style={{ margin: '0 0 4px' }}><strong>구절:</strong> {result.scripture}</p>}
            {result.prompt_en && result.prompt_en !== result.prompt && (
              <p style={{ margin: '0 0 4px', color: '#94a3b8', fontSize: '12px' }}><strong>영문 프롬프트:</strong> {result.prompt_en}</p>
            )}
            <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '12px' }}>
              {IMAGE_STYLES[result.style as ImageStyle]?.label ?? result.style} · {result.width}×{result.height} · {result.model}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a
                href={result.image_url}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '8px 14px', background: '#3b82f6', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}
              >
                원본 열기
              </a>
              <Link
                href="/dashboard/gallery"
                style={{ padding: '8px 14px', background: '#334155', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}
              >
                갤러리에서 보기
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
