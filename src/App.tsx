import { useState, useEffect, Fragment } from 'react';
import MasterDataTab from './components/MasterDataTab';
import ScheduleTab from './components/ScheduleTab';
import MyPageTab from './components/MyPageTab';
import ShareTab from './components/ShareTab';
import { Music, Settings, Calendar, Share2, Info, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { validateMasterDataRequirements } from './utils/validation';
import { ScheduleProvider, useSchedule } from './context/ScheduleContext';
import { useScheduleUrlLoader } from './hooks/useScheduleUrlLoader';

// --- ステップ定義 ---
const STEPS = [
  { key: 'master' as const, num: 1, label: '基本条件設定', sub: '時間・部屋・曲の登録' },
  { key: 'schedule' as const, num: 2, label: 'スケジュール生成', sub: '自動最適化・微調整' },
  { key: 'share' as const, num: 3, label: '共有・確認', sub: 'リンク発行・時間割' },
];

type TabKey = 'master' | 'schedule' | 'share';

function MainAppContent() {
  const { isMemberMode, memberData, isLoadingSchedule, scheduleLoadError } = useScheduleUrlLoader();
  const { state } = useSchedule();
  const [activeTab, setActiveTab] = useState<TabKey>('master');

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
            onProceedToSchedule={() => handleTabChange('schedule')}
          />
        )}

        {/* ---------- STEP 2: スケジュール生成 ---------- */}
        {activeTab === 'schedule' && (
          <>
            <ScheduleTab />
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

export default function App() {
  return (
    <ScheduleProvider>
      <MainAppContent />
    </ScheduleProvider>
  );
}
