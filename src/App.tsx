import { useState, useEffect, Fragment } from 'react';
import type {
  ScheduleState,
  TimeSettings,
  Room,
  Song,
  DuplicateNGPair,
  Entry
} from './types';
import {
  STANDARD_INSTRUMENTS,
  STANDARD_PART_COUNTS
} from './types';
import MasterDataTab from './components/MasterDataTab';
import ScheduleTab from './components/ScheduleTab';
import MyPageTab from './components/MyPageTab';
import { useScheduleUndo } from './hooks/useScheduleUndo';
import { Music, Settings, Calendar, Share2, Info, ChevronRight, Copy, ExternalLink, Smartphone, MessageCircle, X, Loader2, Camera } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { encodeScheduleData, decodeScheduleData, generateShareUrl } from './utils/shareEncoding';
import TimetableExportModal from './components/TimetableExportModal';

// --- 初期データ ---
const INITIAL_TIME_SETTINGS: TimeSettings = {
  startTime: '09:00',
  endTime: '12:00',
  slotDuration: 45,
  intervalDuration: 5
};

const INITIAL_ROOMS: Room[] = [
  { id: 'room-perc', name: '打楽器室', capacity: 6, isPersonalPracticeCandidate: true, permanentInstrumentId: 'timp' },
  { id: 'room-music', name: '音楽室', capacity: 20, isPersonalPracticeCandidate: true },
  { id: 'room-med1', name: '中練習室1', capacity: 8, isPersonalPracticeCandidate: true },
  { id: 'room-med2', name: '中練習室2', capacity: 8, isPersonalPracticeCandidate: true }
];

const INITIAL_SONGS: Song[] = [
  {
    id: 'song-alv',
    name: 'アルヴァマー序曲',
    parts: { ...STANDARD_PART_COUNTS }
  },
  {
    id: 'song-disco',
    name: 'ディスコ・キッド',
    parts: {
      fl: 2, picc: 1, ob: 1, bsn: 1, ebcl: 1, bbcl: 3, bcl: 1,
      asax: 2, tsax: 1, bsax: 1, trp: 3, hrn: 4, trb: 3, euph: 1, tuba: 1,
      stbs: 1, timp: 1, perc: 4
    }
  }
];

const INITIAL_NG_PAIRS: DuplicateNGPair[] = [
  {
    id: 'ng-1',
    partA: { songId: 'song-alv', instrumentId: 'perc', partIndex: 0 },
    partB: { songId: 'song-disco', instrumentId: 'perc', partIndex: 0 }
  },
  {
    id: 'ng-2',
    partA: { songId: 'song-alv', instrumentId: 'fl', partIndex: 0 },
    partB: { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }
  }
];

const INITIAL_ENTRIES: Entry[] = [
  {
    id: 'entry-1',
    songId: 'song-alv',
    section: '冒頭〜A (1-24小節)',
    priority: 'high',
    parts: [
      { instrumentId: 'fl', partIndex: 0 },
      { instrumentId: 'fl', partIndex: 1 },
      { instrumentId: 'picc', partIndex: 0 },
      { instrumentId: 'ob', partIndex: 0 },
      { instrumentId: 'bbcl', partIndex: 0 },
      { instrumentId: 'bbcl', partIndex: 1 },
      { instrumentId: 'hrn', partIndex: 0 },
      { instrumentId: 'hrn', partIndex: 1 },
      { instrumentId: 'perc', partIndex: 0 },
      { instrumentId: 'perc', partIndex: 1 }
    ]
  },
  {
    id: 'entry-2',
    songId: 'song-alv',
    section: 'C〜D (45-68小節)',
    priority: 'high',
    parts: [
      { instrumentId: 'trp', partIndex: 0 },
      { instrumentId: 'trp', partIndex: 1 },
      { instrumentId: 'trp', partIndex: 2 },
      { instrumentId: 'trb', partIndex: 0 },
      { instrumentId: 'trb', partIndex: 1 },
      { instrumentId: 'trb', partIndex: 2 },
      { instrumentId: 'euph', partIndex: 0 },
      { instrumentId: 'tuba', partIndex: 0 }
    ]
  },
  {
    id: 'entry-3',
    songId: 'song-disco',
    section: 'A〜B (17-32小節)',
    priority: 'medium',
    parts: [
      { instrumentId: 'fl', partIndex: 0 },
      { instrumentId: 'asax', partIndex: 0 },
      { instrumentId: 'asax', partIndex: 1 },
      { instrumentId: 'trp', partIndex: 0 },
      { instrumentId: 'trp', partIndex: 1 },
      { instrumentId: 'perc', partIndex: 0 },
      { instrumentId: 'perc', partIndex: 1 },
      { instrumentId: 'perc', partIndex: 2 }
    ]
  },
  {
    id: 'entry-4',
    songId: 'song-disco',
    section: '中間部 (C〜D)',
    priority: 'medium',
    parts: [
      { instrumentId: 'hrn', partIndex: 0 },
      { instrumentId: 'hrn', partIndex: 1 },
      { instrumentId: 'trb', partIndex: 0 },
      { instrumentId: 'trb', partIndex: 1 },
      { instrumentId: 'tuba', partIndex: 0 }
    ]
  }
];

// --- ステップ定義 ---
const STEPS = [
  { key: 'master' as const, num: 1, label: '基本条件設定', sub: '時間・部屋・曲の登録' },
  { key: 'schedule' as const, num: 2, label: 'スケジュール生成', sub: '自動最適化・微調整' },
  { key: 'share' as const, num: 3, label: '共有・確認', sub: 'リンク発行・時間割' },
];

type TabKey = 'master' | 'schedule' | 'share';

export default function App() {
  // --- 部員閲覧モード ---
  const [isMemberMode, setIsMemberMode] = useState(false);
  const [memberData, setMemberData] = useState<ScheduleState | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [scheduleLoadError, setScheduleLoadError] = useState<string | null>(null);

  // --- 管理者モード ---
  const [activeTab, setActiveTab] = useState<TabKey>('master');
  const [shareCopied, setShareCopied] = useState<'url' | 'line' | false>(false);
  const [showQR, setShowQR] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [cachedShortUrl, setCachedShortUrl] = useState<string | null>(null);
  const [isGeneratingShortUrl, setIsGeneratingShortUrl] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [state, setState] = useState<ScheduleState>(() => {
    const saved = localStorage.getItem('antigravity_schedule_state_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.rooms && parsed.songs && parsed.entries && parsed.instruments?.length >= 19) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved state', e);
      }
    }
    return {
      timeSettings: INITIAL_TIME_SETTINGS,
      rooms: INITIAL_ROOMS,
      instruments: STANDARD_INSTRUMENTS,
      songs: INITIAL_SONGS,
      duplicateNGPairs: INITIAL_NG_PAIRS,
      entries: INITIAL_ENTRIES,
      assignments: []
    };
  });

  const scheduleUndo = useScheduleUndo(state.assignments, (newAssignments) => {
    setState(prev => ({
      ...prev,
      assignments: newAssignments
    }));
  });

  // スケジュール変更時に短縮URLキャッシュをクリア
  useEffect(() => {
    setCachedShortUrl(null);
    setQrUrl('');
  }, [state]);

  // OSのテーマ設定（ダーク/ライト）に自動追従
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (e: MediaQueryList | MediaQueryListEvent) => {
      if (e.matches) {
        document.body.classList.remove('light-theme');
      } else {
        document.body.classList.add('light-theme');
      }
    };

    applyTheme(mediaQuery);
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, []);

  // URL ハッシュ or クエリから部員閲覧モードを検出（短縮ID・新旧形式すべてに対応）
  useEffect(() => {
    let shortId: string | null = null;
    let view: string | null = null;
    let data: string | null = null;

    // 1. ハッシュ形式 (#s=xxx or #view=member&d=xxx or #6文字ID)
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      shortId = hashParams.get('s');
      view = hashParams.get('view');
      data = hashParams.get('d');
      if (!shortId && !view && !data && hash.length === 6 && !hash.includes('=')) {
        shortId = hash;
      }
    }

    // 2. クエリ形式フォールバック (?s=xxx or ?view=member&d=xxx)
    if (!shortId && !data) {
      const queryParams = new URLSearchParams(window.location.search);
      shortId = queryParams.get('s');
      view = queryParams.get('view');
      data = queryParams.get('d');
    }

    // A. 短縮IDの場合: /api/schedule からデータを非同期取得
    if (shortId) {
      setIsLoadingSchedule(true);
      fetch(`/api/schedule?id=${encodeURIComponent(shortId)}`)
        .then(res => {
          if (!res.ok) throw new Error('スケジュールが見つかりません。期限切れ（30日経過）の可能性があります。');
          return res.json();
        })
        .then(json => {
          if (json.data) {
            const decoded = decodeScheduleData(json.data);
            if (decoded) {
              setIsMemberMode(true);
              setMemberData(decoded);
              setIsLoadingSchedule(false);
              return;
            }
          }
          throw new Error('スケジュールデータの復元に失敗しました。');
        })
        .catch(err => {
          console.error('Failed to load schedule', err);
          setScheduleLoadError(err instanceof Error ? err.message : '読み込みに失敗しました。');
          setIsLoadingSchedule(false);
        });
      return;
    }

    // B. フルデータ埋め込みURLの場合: その場で即時デコード
    if (view === 'member' && data) {
      const decoded = decodeScheduleData(data);
      if (decoded) {
        setIsMemberMode(true);
        setMemberData(decoded);
      }
    }
  }, []);

  // 状態の自動保存
  useEffect(() => {
    if (!isMemberMode) {
      localStorage.setItem('antigravity_schedule_state_v3', JSON.stringify(state));
    }
  }, [state, isMemberMode]);

  // タブ切り替え時の未入力事前チェック（ガード機能）
  const handleTabChange = (targetTab: TabKey) => {
    if (targetTab === 'schedule' || targetTab === 'share') {
      if (state.rooms.length === 0) {
        alert('⚠️ 練習室が1部屋も登録されていません。\nまずは「1-1 基本設定(時間・部屋)」で練習室を登録してください。');
        setActiveTab('master');
        return;
      }
      if (state.songs.length === 0) {
        alert('⚠️ 演奏曲が1曲も登録されていません。\n「1-2 曲・パート編成」で演奏曲を登録してください。');
        setActiveTab('master');
        return;
      }
      if (state.entries.length === 0) {
        alert('⚠️ スケジュールを作成する「セクション練習」がまだ1件も登録されていません。\n「1-4 セクション練習」で練習内容を登録してください。');
        setActiveTab('master');
        return;
      }
    }
    setActiveTab(targetTab);
  };

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
    const message = `【練習スケジュールのご案内】\n本日の練習スケジュールが決定しました！\n以下のリンクを開き、ご自身の担当パートを選択して時間割・練習場所をご確認ください👇\n\n${url}`;
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

  // ============================
  // ローディング画面 (短縮URL取得中)
  // ============================
  if (isLoadingSchedule) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-secondary)' }}>
        <Loader2 size={36} className="spin" style={{ color: 'var(--primary)' }} />
        <div style={{ fontSize: '0.95rem' }}>練習スケジュールを読み込み中...</div>
      </div>
    );
  }

  // ============================
  // エラー画面 (短縮URLが見つからない場合)
  // ============================
  if (scheduleLoadError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', padding: '1.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem' }}>⚠️</div>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>スケジュールを開けませんでした</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.6, margin: 0 }}>
          {scheduleLoadError}
        </p>
        <a href={window.location.origin + window.location.pathname} className="btn btn-primary" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
          トップ画面へ
        </a>
      </div>
    );
  }

  // ============================
  // 部員閲覧モード (共有リンクから開いた場合)
  // ============================
  if (isMemberMode && memberData) {
    return (
      <div className="member-view">
        {/* ヘッダー */}
        <div className="member-header">
          <div className="member-header-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Music size={22} style={{ color: 'var(--primary)' }} />
              <h1 className="member-title">練習スケジュール</h1>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              練習時間: {memberData.timeSettings.startTime} 〜 {memberData.timeSettings.endTime} ｜ 1コマ: {memberData.timeSettings.slotDuration}分 ｜ インターバル: {memberData.timeSettings.intervalDuration}分
            </p>
          </div>
        </div>

        {/* メインコンテンツ: MyPageTab のみ表示 */}
        <div className="member-content">
          <MyPageTab state={memberData} />
        </div>

        {/* フッター */}
        <div className="member-footer">
          <a href={window.location.origin + window.location.pathname} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <ExternalLink size={12} />
            管理者画面を開く
          </a>
        </div>
      </div>
    );
  }

  // ============================
  // 管理者モード (通常画面)
  // ============================
  return (
    <div className="app-layout">
      {/* ===== PCサイドバー ===== */}
      <aside className="sidebar">
        <div className="app-logo">
          <Music size={24} />
          <span>Section Optimizer</span>
        </div>

        <nav className="nav-links">
          <button
            className={`nav-btn ${activeTab === 'master' ? 'active' : ''}`}
            onClick={() => handleTabChange('master')}
          >
            <Settings size={18} />
            <span>STEP 1: 基本条件設定</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => handleTabChange('schedule')}
          >
            <Calendar size={18} />
            <span>STEP 2: スケジュール生成</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'share' ? 'active' : ''}`}
            onClick={() => handleTabChange('share')}
          >
            <Share2 size={18} />
            <span>STEP 3: 共有・確認</span>
          </button>
        </nav>



        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Info size={12} />
          <span>v1.1.0 (Google Antigravity)</span>
        </div>
      </aside>

      {/* ===== メインコンテンツ ===== */}
      <main className="main-content">
        {/* 進捗ステップバー */}
        <div className="stepper">
          {STEPS.map((step, idx, arr) => (
            <Fragment key={step.key}>
              <button
                className={`stepper-step ${activeTab === step.key ? 'active' : ''}`}
                onClick={() => handleTabChange(step.key)}
              >
                <div className="stepper-number">{step.num}</div>
                <div className="stepper-text">
                  <div className="stepper-label">{step.label}</div>
                  <div className="stepper-sub">{step.sub}</div>
                </div>
              </button>
              {idx < arr.length - 1 && <div className="stepper-line" />}
            </Fragment>
          ))}
        </div>

        {/* ---------- STEP 1: 基本条件設定 ---------- */}
        {activeTab === 'master' && (
          <MasterDataTab
            state={state}
            setState={setState}
            onProceedToSchedule={() => handleTabChange('schedule')}
          />
        )}

        {/* ---------- STEP 2: スケジュール生成 ---------- */}
        {activeTab === 'schedule' && (
          <>
            <ScheduleTab
              state={state}
              setState={setState}
              undoControls={scheduleUndo}
            />
            {state.assignments.length > 0 && (
              <div className="next-step-bar">
                <button className="btn btn-primary btn-next-step" onClick={() => setActiveTab('share')}>
                  次へ: 部員へ共有・個人時間割を確認 <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}

        {/* ---------- STEP 3: 共有・確認 ---------- */}
        {activeTab === 'share' && (
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

                {/* タイムテーブルPNG画像エクスポートモーダル (R2) */}
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
                  <button className="btn btn-primary" onClick={() => setActiveTab('schedule')}>
                    <Calendar size={16} /> STEP 2: スケジュール生成へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ===== スマホ用ボトムナビ ===== */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-nav-btn ${activeTab === 'master' ? 'active' : ''}`}
          onClick={() => handleTabChange('master')}
        >
          <Settings size={22} className="nav-icon" />
          <span>①設定</span>
        </button>
        <button
          className={`mobile-nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => handleTabChange('schedule')}
        >
          <Calendar size={22} className="nav-icon" />
          <span>②生成</span>
        </button>
        <button
          className={`mobile-nav-btn ${activeTab === 'share' ? 'active' : ''}`}
          onClick={() => handleTabChange('share')}
        >
          <Share2 size={22} className="nav-icon" />
          <span>③共有</span>
        </button>

      </nav>
    </div>
  );
}
