import { useState, useEffect } from 'react';
import type { ScheduleState } from '../types';
import MyPageTab from './MyPageTab';
import TimetableExportModal from './TimetableExportModal';
import { QRCodeSVG } from 'qrcode.react';
import { encodeScheduleData, generateShareUrl } from '../utils/shareEncoding';
import {
  Share2,
  Copy,
  ExternalLink,
  Smartphone,
  MessageCircle,
  X,
  Loader2,
  Camera,
  Info,
  Calendar
} from 'lucide-react';
import { useOptionalSchedule } from '../context/ScheduleContext';

export interface ShareTabProps {
  state?: ScheduleState;
  onNavigateToSchedule: () => void;
}

export default function ShareTab(props: ShareTabProps) {
  const scheduleCtx = useOptionalSchedule();
  const state = props.state ?? scheduleCtx?.state;
  const { onNavigateToSchedule } = props;

  if (!state) {
    throw new Error('ShareTab must be used within a ScheduleProvider or provided with state prop');
  }

  const [shareCopied, setShareCopied] = useState<'url' | 'line' | false>(false);
  const [showQR, setShowQR] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [cachedShortUrl, setCachedShortUrl] = useState<string | null>(null);
  const [isGeneratingShortUrl, setIsGeneratingShortUrl] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Clear cached short URL if state changes
  useEffect(() => {
    setCachedShortUrl(null);
    setQrUrl('');
  }, [state]);

  // 短縮URLの取得・発行（失敗時はフルハッシュURLへ自動フォールバック）
  const getOrGenerateShortUrl = async (): Promise<string> => {
    if (cachedShortUrl) return cachedShortUrl;
    setIsGeneratingShortUrl(true);
    try {
      const encoded = encodeScheduleData(state);
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: encoded })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.id) {
          const shortUrl = `${window.location.origin}${window.location.pathname}#s=${json.id}`;
          setCachedShortUrl(shortUrl);
          setIsGeneratingShortUrl(false);
          return shortUrl;
        }
      }
    } catch (e) {
      console.warn('短縮URLの発行に失敗したため、ハッシュURLへフォールバックします', e);
    }
    setIsGeneratingShortUrl(false);
    return generateShareUrl(state);
  };

  // 共有URLリンクをコピー
  const handleCopyShareUrl = async () => {
    const url = await getOrGenerateShortUrl();
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied('url');
      setTimeout(() => setShareCopied(false), 3000);
    }).catch(() => {
      window.prompt('以下のURLをコピーしてください:', url);
    });
  };

  // LINE用共有メッセージをコピー
  const handleCopyLineMessage = async () => {
    const url = await getOrGenerateShortUrl();
    const message = `【Brass Scheduler 練習スケジュールのご案内】\n本日の練習スケジュールが決定しました！\n以下のリンクを開き、ご自身の担当パートを選択して時間割・練習場所をご確認ください👇\n\n${url}`;
    navigator.clipboard.writeText(message).then(() => {
      setShareCopied('line');
      setTimeout(() => setShareCopied(false), 3000);
    }).catch(() => {
      window.prompt('以下のメッセージをコピーしてください:', message);
    });
  };

  // QRコード表示を開く
  const handleOpenQR = async () => {
    setShowQR(true);
    const url = await getOrGenerateShortUrl();
    setQrUrl(url);
  };

  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">共有・個人時間割確認</h1>
        <p className="page-subtitle">部員用の共有リンクを発行し、管理者自身の個人時間割も確認できます。</p>
      </div>

      {state.assignments.length > 0 ? (
        <>
          {/* 共有リンク発行セクション */}
          <div className="glass-card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--primary)' }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Share2 size={18} style={{ color: 'var(--primary)' }} />
              部員用共有リンク
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
              以下のボタンでリンクをコピーし、LINEグループ等に貼り付けて部員に共有してください。<br />
              部員はリンクを開くだけで、自分のパートを選択して個人時間割を確認できます。
            </p>

            {/* コピーボタン群 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* LINE用メッセージをコピー (推奨) */}
              <button
                className="btn btn-primary"
                onClick={handleCopyLineMessage}
                disabled={isGeneratingShortUrl}
                style={{ fontSize: '0.92rem', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isGeneratingShortUrl ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <MessageCircle size={16} />
                )}
                {shareCopied === 'line' ? '✅ LINE用メッセージをコピーしました！' : isGeneratingShortUrl ? '短縮リンク発行中...' : 'LINE用メッセージをコピー（案内文付き）'}
              </button>

              {/* タイムテーブル画像保存 (PNG) */}
              <button
                className="btn btn-primary"
                onClick={() => setShowExportModal(true)}
                style={{
                  fontSize: '0.92rem',
                  padding: '0.75rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  background: 'linear-gradient(135deg, #059669, #10b981)'
                }}
              >
                <Camera size={16} />
                <span>📸 タイムテーブル画像保存 (PNG)</span>
              </button>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {/* URLのみコピー */}
                <button
                  className="btn btn-secondary"
                  onClick={handleCopyShareUrl}
                  disabled={isGeneratingShortUrl}
                  style={{ flex: 1, fontSize: '0.82rem', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', minWidth: '140px' }}
                >
                  {isGeneratingShortUrl ? <Loader2 size={14} className="spin" /> : <Copy size={14} />}
                  {shareCopied === 'url' ? '✅ コピー完了' : 'URLのみコピー'}
                </button>

                {/* QRコード表示 */}
                <button
                  className="btn btn-secondary"
                  onClick={handleOpenQR}
                  style={{ flex: 1, fontSize: '0.82rem', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', minWidth: '140px' }}
                >
                  <Smartphone size={14} />
                  QRコードを表示
                </button>
              </div>
            </div>

            {/* コピー成功のヒント */}
            {shareCopied && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ExternalLink size={12} />
                {shareCopied === 'line'
                  ? 'LINEグループにそのまま貼り付けてください。案内文が一緒に送信されます。'
                  : 'URLをコピーしました。LINEやメール等に貼り付けて共有してください。'
                }
              </div>
            )}
          </div>

          {/* QRコードモーダル */}
          {showQR && (
            <div
              className="modal-overlay"
              onClick={() => setShowQR(false)}
              style={{ zIndex: 1000 }}
            >
              <div
                className="modal-content"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    📱 部員用QRコード
                  </h2>
                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => setShowQR(false)}
                    style={{ border: 'none', background: 'transparent', padding: '4px' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.5rem',
                    display: 'inline-block',
                    marginBottom: '0.75rem'
                  }}
                >
                  <QRCodeSVG
                    value={qrUrl || cachedShortUrl || generateShareUrl(state)}
                    size={256}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                <div style={{ wordBreak: 'break-all', fontSize: '0.72rem', color: 'var(--primary)', marginBottom: '0.75rem', fontFamily: 'monospace' }}>
                  {qrUrl || cachedShortUrl || generateShareUrl(state)}
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  スマホのカメラをかざすだけで<br />
                  個人時間割が開けます。<br />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    iPadやプロジェクターに映すと便利です
                  </span>
                </p>

                <button
                  className="btn btn-secondary"
                  onClick={() => setShowQR(false)}
                  style={{ marginTop: '0.75rem', fontSize: '0.85rem', padding: '0.5rem 1.5rem' }}
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {/* タイムテーブルPNG画像エクスポートモーダル */}
          <TimetableExportModal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            state={state}
          />

          {/* 区切り */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '2rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>管理者用: 個人時間割プレビュー</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          </div>

          {/* 個人時間割（管理者プレビュー用） */}
          <MyPageTab state={state} />
        </>
      ) : (
        <div style={{ height: '300px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
          <Info size={36} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '0.75rem' }}>スケジュールがまだ生成されていません。</div>
            <button className="btn btn-primary" onClick={onNavigateToSchedule}>
              <Calendar size={16} /> STEP 2: スケジュール生成へ
            </button>
          </div>
        </div>
      )}
    </>
  );
}
