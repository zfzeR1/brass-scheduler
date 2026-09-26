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
import ShareTab from './components/ShareTab';
import { useScheduleUndo } from './hooks/useScheduleUndo';
import { Music, Settings, Calendar, Share2, Info, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { decodeScheduleData } from './utils/shareEncoding';
import { sanitizeScheduleState } from './utils/scheduleIntegrity';
import { validateMasterDataRequirements } from './utils/validation';

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

  const [state, setState] = useState<ScheduleState>(() => {
    const saved = localStorage.getItem('antigravity_schedule_state_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.rooms && parsed.songs && parsed.entries && parsed.instruments?.length >= 19) {
          return sanitizeScheduleState(parsed);
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

  // ページタイトルをモードに応じて設定
  useEffect(() => {
    document.title = isMemberMode ? '練習スケジュール - Brass Scheduler' : 'Brass Scheduler - 吹奏楽練習スケジュール作成';
  }, [isMemberMode]);

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
              setMemberData(sanitizeScheduleState(decoded));
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
        setMemberData(sanitizeScheduleState(decoded));
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
      const validation = validateMasterDataRequirements(state);
      if (!validation.isValid) {
        if (validation.message) {
          alert(validation.message);
        }
        setActiveTab('master');
        return;
      }
    }
    setActiveTab(targetTab);
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Music size={22} style={{ color: 'var(--primary)' }} />
              <h1 className="member-title">練習スケジュール</h1>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>Brass Scheduler</span>
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
          <span>Brass Scheduler</span>
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
          <ShareTab
            state={state}
            onNavigateToSchedule={() => setActiveTab('schedule')}
          />
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
