'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDashboard } from '../DashboardShell';
import { IMAGE_STYLES, IMAGE_SIZES, type ImageStyle, type ImageSize, type GeneratedImage } from '@/lib/types';

interface PublicModel {
  id: string;
  name: string;
  description: string | null;
  category: string;
  credit_cost: number;
  example_image_url: string | null;
  version: string;
  is_premium: boolean;
  provider: string;
}

type Mode = 'biblical' | 'general';

const EXAMPLES: Record<Mode, { label: string; prompt: string; scripture?: string }[]> = {
  biblical: [
    { label: '마태복음 14:25', prompt: '갈릴리 호수 위를 걷는 예수님과 놀라는 제자들', scripture: '마태복음 14:25' },
    { label: '시편 23:1', prompt: '푸른 초장에서 양 떼를 돌보는 선한 목자', scripture: '시편 23:1' },
    { label: '출애굽기 14:21', prompt: '홍해가 갈라지고 이스라엘 백성이 마른 땅을 건너는 장면', scripture: '출애굽기 14:21' },
    { label: '누가복음 24:2', prompt: '빈 무덤 앞 새벽빛과 굴러간 돌', scripture: '누가복음 24:2' },
  ],
  general: [
    { label: '노을 해변', prompt: '노을이 지는 해변에서 서핑보드를 든 사람의 실루엣' },
    { label: '고양이 카페', prompt: '창가에 앉아 커피를 마시는 고양이, 따뜻한 오후 햇살' },
    { label: '미래 도시', prompt: '비 오는 밤의 네온사인 가득한 미래 도시 거리' },
    { label: '유튜브 썸네일', prompt: '놀란 표정의 요리사와 불타는 프라이팬, 화려한 색감의 썸네일' },
  ],
};

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
  const [mode, setMode] = useState<Mode>('biblical');
  const [models, setModels] = useState<PublicModel[]>([]);
  const [modelId, setModelId] = useState<string>('flux2-dev');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    fetch('/api/models')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setModels(d.models);
          if (d.defaultModelId) setModelId(d.defaultModelId);
        }
      })
      .catch(() => {});
  }, []);

  const selectedModel = models.find(m => m.id === modelId);
  const cost = selectedModel?.credit_cost ?? 1;
  const noCredits = credits !== null && credits < cost;

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
        body: JSON.stringify({ prompt: prompt.trim(), scripture: scripture.trim(), style, size, modelId, mode }),
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
          {mode === 'biblical' ? '장면을 설명하면 성경적 분위기의 이미지를 만들어 드립니다.' : '어떤 이미지든 자유롭게 만들어 보세요.'} 모델에 따라 1~2크레딧이 사용됩니다.
        </p>

        {error && (
          <div style={{ background: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            ❌ {error}
          </div>
        )}

        {noCredits && (
          <div style={{ background: '#f59e0b', color: '#1e293b', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
            ⚠️ 크레딧이 부족합니다. (이 모델은 {cost}크레딧 필요)
          </div>
        )}

        {/* ---- 모드 ---- */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', background: '#0f172a', padding: '4px', borderRadius: '8px' }}>
          {([['biblical', '✝️ 성경 · 신앙'], ['general', '🎨 일반']] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              disabled={loading}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                background: mode === m ? '#334155' : 'transparent',
                color: mode === m ? 'white' : '#94a3b8',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ---- 모델 선택 ---- */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>모델</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
            {models.map(m => {
              const active = m.id === modelId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModelId(m.id)}
                  disabled={loading}
                  title={m.description ?? ''}
                  style={{
                    textAlign: 'left',
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${active ? '#10b981' : '#475569'}`,
                    background: active ? 'rgba(16,185,129,0.12)' : '#0f172a',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{m.name}</span>
                    <span style={{ fontSize: '11px', color: '#10b981', whiteSpace: 'nowrap' }}>{m.credit_cost}크레딧</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94a3b8', lineHeight: 1.4 }}>{m.description}</p>
                  {m.is_premium && (
                    <span style={{ fontSize: '10px', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: '999px', padding: '1px 6px', marginTop: '6px', display: 'inline-block' }}>프리미엄</span>
                  )}
                </button>
              );
            })}
            {models.length === 0 && <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>모델 목록을 불러오는 중...</p>}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label htmlFor="prompt" style={labelStyle}>장면 설명 *</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={mode === 'biblical' ? '예: 갈릴리 호수 위를 걷는 예수님과 놀라는 제자들' : '예: 노을이 지는 해변에서 서핑보드를 든 사람의 실루엣'}
              rows={4}
              maxLength={1000}
              disabled={loading}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#64748b' }}>{prompt.length}/1000</div>
          </div>

          {mode === 'biblical' && (
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
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label htmlFor="style" style={labelStyle}>분위기</label>
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
            {loading ? '생성 중... (10~30초)' : `✨ 이미지 생성 (${cost} 크레딧)`}
          </button>
        </form>

        <div style={{ marginTop: '20px' }}>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 8px' }}>예시로 시작하기</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {EXAMPLES[mode].map(ex => (
              <button
                key={ex.prompt}
                type="button"
                disabled={loading}
                onClick={() => { setPrompt(ex.prompt); setScripture(ex.scripture ?? ''); }}
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
                {ex.label}
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
              {models.find(m => m.id === result.model_id)?.name ?? result.model} · {IMAGE_STYLES[result.style as ImageStyle]?.label ?? result.style} · {result.width}×{result.height}
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
