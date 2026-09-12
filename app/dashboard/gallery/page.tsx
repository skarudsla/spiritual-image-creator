'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { IMAGE_STYLES, REPORT_REASONS, type ImageStyle, type GeneratedImage, type ReportReason } from '@/lib/types';

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
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('sexual');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMsg, setReportMsg] = useState('');

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

  const openImage = (img: GalleryImage) => {
    setSelected(img);
    setReporting(false);
    setReportMsg('');
    setReportDetails('');
  };

  const handleReport = async () => {
    if (!selected) return;
    setReportBusy(true);
    setReportMsg('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: selected.id, reason: reportReason, details: reportDetails }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setReportMsg(`❌ ${data.error || '신고에 실패했습니다.'}`);
        return;
      }
      setReportMsg(`✅ ${data.message}`);
      setImages(prev => prev.map(i => (i.id === selected.id ? { ...i, is_flagged: true } : i)));
      setSelected(s => (s ? { ...s, is_flagged: true } : s));
      setReporting(false);
    } catch {
      setReportMsg('❌ 네트워크 오류가 발생했습니다.');
    } finally {
      setReportBusy(false);
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
            onClick={() => openImage(img)}
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
            <div style={{ aspectRatio: `${img.width} / ${img.height}`, background: '#0f172a', position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.image_url} alt={img.prompt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: img.is_flagged ? 'blur(8px)' : undefined }} />
              {img.is_flagged && (
                <span style={{ position: 'absolute', top: '8px', left: '8px', background: '#f59e0b', color: '#1e293b', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px' }}>
                  🚩 신고됨
                </span>
              )}
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
                  onClick={() => { setReporting(r => !r); setReportMsg(''); }}
                  disabled={selected.is_flagged}
                  title={selected.is_flagged ? '이미 신고된 이미지입니다' : '부적절한 결과물 신고'}
                  style={{ padding: '8px 14px', background: selected.is_flagged ? '#4b5563' : '#f59e0b', color: '#1e293b', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: selected.is_flagged ? 'not-allowed' : 'pointer' }}
                >
                  {selected.is_flagged ? '🚩 신고됨' : '🚩 신고'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  style={{ padding: '8px 14px', background: '#334155', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', marginLeft: 'auto' }}
                >
                  닫기
                </button>
              </div>

              {reportMsg && (
                <p style={{ marginTop: '12px', fontSize: '13px', color: reportMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{reportMsg}</p>
              )}

              {reporting && !selected.is_flagged && (
                <div style={{ marginTop: '14px', padding: '14px', background: '#0f172a', borderRadius: '8px', border: '1px solid #475569' }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 'bold', color: 'white' }}>부적절한 이미지 신고</p>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#94a3b8' }}>
                    AI 가 만든 결과물이 성적·폭력적·혐오적이거나 신앙적으로 부적절하다면 알려주세요. 신고된 이미지는 흐리게 표시되고 운영자가 검토합니다.
                  </p>
                  <select
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value as ReportReason)}
                    style={{ width: '100%', padding: '9px', marginBottom: '8px', background: '#1e293b', color: 'white', border: '1px solid #475569', borderRadius: '6px', fontSize: '13px' }}
                  >
                    {Object.entries(REPORT_REASONS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                  <textarea
                    value={reportDetails}
                    onChange={e => setReportDetails(e.target.value)}
                    placeholder="추가 설명 (선택)"
                    rows={2}
                    maxLength={1000}
                    style={{ width: '100%', padding: '9px', marginBottom: '8px', background: '#1e293b', color: 'white', border: '1px solid #475569', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleReport}
                      disabled={reportBusy}
                      style={{ padding: '8px 14px', background: reportBusy ? '#4b5563' : '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: reportBusy ? 'not-allowed' : 'pointer' }}
                    >
                      {reportBusy ? '접수 중...' : '신고 접수'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReporting(false)}
                      style={{ padding: '8px 14px', background: '#334155', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
