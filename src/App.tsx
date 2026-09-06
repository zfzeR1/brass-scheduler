import { useState, useEffect, Fragment } from 'react';
import type {
  ScheduleState,
  TimeSettings,
  Room,
  Instrument,
  Song,
  DuplicateNGPair,
  Entry
} from './types';
import MasterDataTab from './components/MasterDataTab';
import ScheduleTab from './components/ScheduleTab';
import MyPageTab from './components/MyPageTab';
import { Music, Settings, Calendar, Share2, Info, ChevronRight, Copy, ExternalLink } from 'lucide-react';

// --- スケジュールデータの圧縮エンコード/デコード (Unicode対応) ---
function encodeScheduleData(data: ScheduleState): string {
  const json = JSON.stringify({
    timeSettings: data.timeSettings,
    rooms: data.rooms,
    instruments: data.instruments,
    songs: data.songs,
    entries: data.entries,
    assignments: data.assignments,
    duplicateNGPairs: data.duplicateNGPairs
  });
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary);
}

function decodeScheduleData(encoded: string): ScheduleState | null {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (parsed.rooms && parsed.songs) {
      return parsed as ScheduleState;
    }
  } catch (e) {
    console.error('Failed to decode schedule data', e);
  }
  return null;
}

// --- 初期データ ---
const INITIAL_TIME_SETTINGS: TimeSettings = {
  startTime: '09:00',
  endTime: '12:00',
  slotDuration: 45,
  intervalDuration: 5
};

const INITIAL_INSTRUMENTS: Instrument[] = [
  { id: 'perc', name: 'パーカッション', movementType: 'immovable' },
  { id: 'tuba', name: 'チューバ', movementType: 'avoid_movement' },
  { id: 'trb', name: 'トロンボーン', movementType: 'avoid_movement' },
  { id: 'hrn', name: 'ホルン', movementType: 'movable' },
  { id: 'tpt', name: 'トランペット', movementType: 'movable' },
  { id: 'fl', name: 'フルート', movementType: 'movable' }
];

const INITIAL_ROOMS: Room[] = [
  { id: 'room-perc', name: '打楽器室', capacity: 6, isPersonalPracticeCandidate: true, permanentInstrumentId: 'perc' },
  { id: 'room-music', name: '音楽室', capacity: 15, isPersonalPracticeCandidate: true },
  { id: 'room-med1', name: '中練習室1', capacity: 6, isPersonalPracticeCandidate: true },
  { id: 'room-med2', name: '中練習室2', capacity: 6, isPersonalPracticeCandidate: true }
];

const INITIAL_SONGS: Song[] = [
  {
    id: 'song-alv',
    name: 'アルヴァマー序曲',
    parts: { fl: 2, tpt: 3, hrn: 4, trb: 3, tuba: 1, perc: 4 }
  },
  {
    id: 'song-disco',
    name: 'ディスコ・キッド',
    parts: { fl: 1, tpt: 2, hrn: 2, trb: 2, tuba: 1, perc: 3 }
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
      { instrumentId: 'hrn', partIndex: 0 },
      { instrumentId: 'hrn', partIndex: 1 },
      { instrumentId: 'hrn', partIndex: 2 },
      { instrumentId: 'hrn', partIndex: 3 },
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
      { instrumentId: 'tpt', partIndex: 0 },
      { instrumentId: 'tpt', partIndex: 1 },
      { instrumentId: 'tpt', partIndex: 2 },
      { instrumentId: 'trb', partIndex: 0 },
      { instrumentId: 'trb', partIndex: 1 },
      { instrumentId: 'trb', partIndex: 2 },
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
      { instrumentId: 'tpt', partIndex: 0 },
      { instrumentId: 'tpt', partIndex: 1 },
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

  // --- 管理者モード ---
  const [activeTab, setActiveTab] = useState<TabKey>('master');
  const [shareCopied, setShareCopied] = useState(false);
  const [state, setState] = useState<ScheduleState>(() => {
    const saved = localStorage.getItem('antigravity_schedule_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.rooms && parsed.songs && parsed.entries) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved state', e);
      }
    }
    return {
      timeSettings: INITIAL_TIME_SETTINGS,
      rooms: INITIAL_ROOMS,
      instruments: INITIAL_INSTRUMENTS,
      songs: INITIAL_SONGS,
      duplicateNGPairs: INITIAL_NG_PAIRS,
      entries: INITIAL_ENTRIES,
      assignments: []
    };
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

  // URL パラメータから部員閲覧モードを検出
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const data = params.get('d');

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
      localStorage.setItem('antigravity_schedule_state', JSON.stringify(state));
    }
  }, [state, isMemberMode]);

  // 共有リンク生成
  const handleGenerateShareLink = () => {
    const encoded = encodeScheduleData(state);
    const url = `${window.location.origin}${window.location.pathname}?view=member&d=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    }).catch(() => {
      // Clipboard API非対応の場合、prompt で表示
      window.prompt('以下のURLをコピーしてください:', url);
    });
  };

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
            onClick={() => setActiveTab('master')}
          >
            <Settings size={18} />
            <span>STEP 1: 基本条件設定</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <Calendar size={18} />
            <span>STEP 2: スケジュール生成</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'share' ? 'active' : ''}`}
            onClick={() => setActiveTab('share')}
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
                onClick={() => setActiveTab(step.key)}
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
          <>
            <MasterDataTab state={state} setState={setState} />
            <div className="next-step-bar">
              <button className="btn btn-primary btn-next-step" onClick={() => setActiveTab('schedule')}>
                次へ: スケジュール生成に進む <ChevronRight size={18} />
              </button>
            </div>
          </>
        )}

        {/* ---------- STEP 2: スケジュール生成 ---------- */}
        {activeTab === 'schedule' && (
          <>
            <ScheduleTab state={state} setState={setState} />
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
                    以下のボタンを押してリンクをコピーし、LINEグループ等に貼り付けて部員に共有してください。<br />
                    部員はリンクを開くだけで、自分のパートを選択して個人時間割を確認できます。
                  </p>
                  <button className="btn btn-primary" onClick={handleGenerateShareLink} style={{ fontSize: '0.95rem', padding: '0.75rem 1.5rem' }}>
                    <Copy size={16} />
                    {shareCopied ? '✅ コピーしました！LINEに貼り付けてください' : '部員用リンクをコピー'}
                  </button>
                </div>

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
          onClick={() => setActiveTab('master')}
        >
          <Settings size={22} className="nav-icon" />
          <span>①設定</span>
        </button>
        <button
          className={`mobile-nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Calendar size={22} className="nav-icon" />
          <span>②生成</span>
        </button>
        <button
          className={`mobile-nav-btn ${activeTab === 'share' ? 'active' : ''}`}
          onClick={() => setActiveTab('share')}
        >
          <Share2 size={22} className="nav-icon" />
          <span>③共有</span>
        </button>

      </nav>
    </div>
  );
}
