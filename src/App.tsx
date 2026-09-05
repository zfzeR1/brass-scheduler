import { useState, useEffect } from 'react';
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
import { Music, Settings, Calendar, User, Sun, Moon, Info } from 'lucide-react';

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

// 重複NG（兼任パート）の初期設定
const INITIAL_NG_PAIRS: DuplicateNGPair[] = [
  {
    id: 'ng-1',
    partA: { songId: 'song-alv', instrumentId: 'perc', partIndex: 0 }, // アルヴァマー Perc 1st
    partB: { songId: 'song-disco', instrumentId: 'perc', partIndex: 0 } // ディスコ Perc 1st
  },
  {
    id: 'ng-2',
    partA: { songId: 'song-alv', instrumentId: 'fl', partIndex: 0 }, // アルヴァマー Fl 1st
    partB: { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 } // ディスコ Fl 1st
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'master' | 'schedule' | 'mypage'>('schedule');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [state, setState] = useState<ScheduleState>(() => {
    const saved = localStorage.getItem('antigravity_schedule_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // localStorageからの復元時に必要なプロパティがあるか検証
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

  // 状態の自動保存
  useEffect(() => {
    localStorage.setItem('antigravity_schedule_state', JSON.stringify(state));
  }, [state]);

  // テーマ適用
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="app-logo">
          <Music size={24} />
          <span>Section Optimizer</span>
        </div>

        <nav className="nav-links">
          <button
            className={`nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <Calendar size={18} />
            <span>スケジュール自動生成</span>
          </button>
          
          <button
            className={`nav-btn ${activeTab === 'master' ? 'active' : ''}`}
            onClick={() => setActiveTab('master')}
          >
            <Settings size={18} />
            <span>基本条件設定</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'mypage' ? 'active' : ''}`}
            onClick={() => setActiveTab('mypage')}
          >
            <User size={18} />
            <span>個人時間割 (マイページ)</span>
          </button>
        </nav>

        {/* Theme Switch & Meta Info */}
        <div className="theme-switch">
          <button className="btn btn-secondary btn-icon" onClick={toggleTheme} title="テーマ切り替え">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {theme === 'dark' ? 'ダークモード' : 'ライトモード'}
          </span>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Info size={12} />
          <span>v1.0.0 (Google Antigravity)</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'master' && (
          <MasterDataTab state={state} setState={setState} />
        )}
        
        {activeTab === 'schedule' && (
          <ScheduleTab state={state} setState={setState} />
        )}

        {activeTab === 'mypage' && (
          <MyPageTab state={state} />
        )}
      </main>
    </div>
  );
}
