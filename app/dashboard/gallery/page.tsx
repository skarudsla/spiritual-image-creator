'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { IMAGE_STYLES, type ImageStyle, type GeneratedImage } from '@/lib/types';

type GalleryImage = Omit<GeneratedImage, 'user_id' | 'storage_path'>;

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<GalleryImage | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async (p: number, append: boolean) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/gallery?page=${p}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || '갤러리를 불러오지 못했습니다.');
        return;
      }
      setImages(prev => (append ? [...prev, ...data.images] : data.images));
      setHasMore(data.hasMore);
      setTotal(data.total);
      setPage(p);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1, false);
  }, [load]);

  const handleDelete = async (img: GalleryImage) => {
    setDeleting(img.id);
    try {
      const res = await fetch(`/api/gallery/${img.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || '삭제에 실패했습니다.');
        return;
      }
      setImages(prev => prev.filter(i => i.id !== img.id));
      setTotal(t => Math.max(0, t - 1));
      setSelected(null);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section style={{ background: '#1e293b', padding: '28px', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '22px', margin: '0 0 4px' }}>갤러리</h2>
          <p style={{ color: '#cbd5e1', fontSize: '13px', margin: 0 }}>내가 만든 이미지 {total}장</p>
        </div>
        <Link
          href="/dashboard/generate"
          style={{ padding: '10px 16px', background: '#10b981', color: 'white', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}
        >
          + 새 이미지 만들기
        </Link>
      </div>

      {error && (
        <div style={{ background: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          ❌ {error}
        </div>
      )}

      {!loading && images.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🖼️</div>
          <p style={{ margin: 0 }}>아직 만든 이미지가 없습니다. 첫 이미지를 만들어 보세요!</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
        {images.map(img => (
          <button
            key={img.id}
            type="button"
            onClick={() => setSelected(img)}
            style={{
              padding: 0,
              border: '1px solid #475569',
              borderRadius: '8px',
              background: '#0f172a',
              cursor: 'pointer',
              overflow: 'hidden',
              textAlign: 'left',
              color: 'white',
            }}
          >
            <div style={{ aspectRatio: `${img.width} / ${img.height}`, background: '#0f172a' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.image_url} alt={img.prompt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ padding: '10px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '12px', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {img.prompt}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                {img.scripture ? `${img.scripture} · ` : ''}{IMAGE_STYLES[img.style as ImageStyle]?.label ?? img.style}
              </p>
            </div>
          </button>
        ))}
      </div>

      {loading && <p style={{ color: '#cbd5e1', textAlign: 'center', marginTop: '20px' }}>불러오는 중...</p>}

      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => load(page + 1, true)}
            style={{ padding: '10px 20px', background: '#334155', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
          >
            더 보기
          </button>
        </div>
      )}

      {/* ---- 상세 모달 ---- */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 50 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#1e293b', borderRadius: '12px', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '20px', boxSizing: 'border-box' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.image_url} alt={selected.prompt} style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '8px', display: 'block', background: '#0f172a' }} />
            <div style={{ marginTop: '14px', fontSize: '13px', color: '#cbd5e1' }}>
              <p style={{ margin: '0 0 4px' }}><strong>프롬프트:</strong> {selected.prompt}</p>
              {selected.scripture && <p style={{ margin: '0 0 4px' }}><strong>구절:</strong> {selected.scripture}</p>}
              {selected.prompt_en && selected.prompt_en !== selected.prompt && (
                <p style={{ margin: '0 0 4px', color: '#94a3b8', fontSize: '12px' }}><strong>영문 프롬프트:</strong> {selected.prompt_en}</p>
              )}
              <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '12px' }}>
                {IMAGE_STYLES[selected.style as ImageStyle]?.label ?? selected.style} · {selected.width}×{selected.height} · {new Date(selected.created_at).toLocaleString('ko-KR')}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <a href={selected.image_url} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: '#3b82f6', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}>
                  원본 열기
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(selected)}
                  disabled={deleting === selected.id}
                  style={{ padding: '8px 14px', background: deleting === selected.id ? '#4b5563' : '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {deleting === selected.id ? '삭제 중...' : '삭제'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  style={{ padding: '8px 14px', background: '#334155', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', marginLeft: 'auto' }}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
