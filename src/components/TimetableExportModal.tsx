import { useState, useEffect, useRef } from 'react';
import type { ScheduleState } from '../types';
import TimetableExportView from './TimetableExportView';
import {
  formatExportFilename,
  generateTimetableDataUrl,
  downloadDataUrl
} from '../utils/timetableExport';
import { Download, X, Loader2, Image as ImageIcon, CheckCircle } from 'lucide-react';

export interface TimetableExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: ScheduleState;
}

export function TimetableExportModal({ isOpen, onClose, state }: TimetableExportModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    if (isOpen) {
      setIsGenerating(true);
      setError(null);
      setDataUrl(null);

      // Give browser a tick to ensure the off-screen export view is rendered in DOM
      const timer = setTimeout(async () => {
        try {
          if (!exportViewRef.current) {
            throw new Error('エクスポート用のDOM要素が見つかりませんでした。');
          }

          const filename = formatExportFilename();
          const url = await generateTimetableDataUrl(exportViewRef.current, {
            pixelRatio: 2,
            cacheBust: true,
            backgroundColor: '#ffffff'
          });

          if (!isMounted) return;
          setDataUrl(url);
          setIsGenerating(false);

          // Trigger automatic browser download
          downloadDataUrl(url, filename);
        } catch (err: any) {
          if (!isMounted) return;
          console.error('Failed to export timetable PNG:', err);
          setError(err.message || '画像の生成に失敗しました。');
          setIsGenerating(false);
        }
      }, 200);

      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    } else {
      setDataUrl(null);
      setIsGenerating(false);
      setError(null);
    }
  }, [isOpen, state]);

  const handleManualDownload = () => {
    if (!dataUrl) return;
    const filename = formatExportFilename();
    downloadDataUrl(dataUrl, filename);
  };

  return (
    <>
      {/* Hidden off-screen rendered export view for capturing */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-99999px',
          top: '-99999px',
          zIndex: -999,
          pointerEvents: 'none',
          opacity: 0
        }}
      >
        <TimetableExportView ref={exportViewRef} state={state} />
      </div>

      {/* Preview / Download Modal */}
      {isOpen && (
        <div
          className="modal-overlay"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem'
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-surface-solid, #ffffff)',
              borderRadius: 'var(--radius-lg, 12px)',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              border: '1px solid var(--border-color, #e2e8f0)'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-surface, #ffffff)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={20} style={{ color: 'var(--primary, #3b82f6)' }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                  📸 タイムテーブル画像保存 (PNG)
                </h2>
              </div>
              <button
                className="btn btn-secondary btn-icon"
                onClick={onClose}
                aria-label="閉じる"
                style={{ border: 'none', background: 'transparent', padding: '6px', cursor: 'pointer', borderRadius: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: '1.25rem',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
              {isGenerating && (
                <div
                  style={{
                    padding: '3rem 1rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem'
                  }}
                >
                  <Loader2 size={36} className="spin" style={{ color: 'var(--primary, #3b82f6)' }} />
                  <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)', fontSize: '1rem' }}>
                    高解像度PNG画像をレンダリング中...
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
                    すべてのコマと部屋を高品質で画像化しています。少々お待ちください。
                  </div>
                </div>
              )}

              {error && (
                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#991b1b',
                    fontSize: '0.88rem'
                  }}
                >
                  {error}
                </div>
              )}

              {dataUrl && (
                <>
                  {/* Guidance banner */}
                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem'
                    }}
                  >
                    <CheckCircle size={18} style={{ color: '#16a34a', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ fontSize: '0.84rem', color: '#166534', lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 700 }}>画像の生成が完了しました！</span>
                      <br />
                      ブラウザのダウンロードが自動的に始まります。スマホの方は下の画像を長押しして「写真に保存」することも可能です。
                    </div>
                  </div>

                  {/* Image preview */}
                  <div
                    style={{
                      border: '1px solid var(--border-color, #cbd5e1)',
                      borderRadius: '8px',
                      overflow: 'auto',
                      maxHeight: '52vh',
                      backgroundColor: '#f8fafc',
                      padding: '8px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start'
                    }}
                  >
                    <img
                      src={dataUrl}
                      alt="タイムテーブル画像プレビュー"
                      style={{
                        maxWidth: '100%',
                        height: 'auto',
                        borderRadius: '4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                        display: 'block'
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderTop: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-surface, #ffffff)'
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
                {dataUrl ? `ファイル名: ${formatExportFilename()}` : ''}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  style={{ fontSize: '0.85rem', padding: '0.55rem 1.2rem' }}
                >
                  閉じる
                </button>

                {dataUrl && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleManualDownload}
                    style={{
                      fontSize: '0.85rem',
                      padding: '0.55rem 1.2rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <Download size={15} />
                    <span>画像をダウンロード (PNG)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TimetableExportModal;
