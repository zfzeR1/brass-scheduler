import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type {
  ScheduleState,
  TimeSettings,
  Room,
  Song,
  DuplicateNGPair,
  Entry,
} from '../types';
import {
  STANDARD_INSTRUMENTS,
  STANDARD_PART_COUNTS,
} from '../types';
import { sanitizeScheduleState } from '../utils/scheduleIntegrity';
import { useScheduleUndo, type ScheduleUndoManager } from '../hooks/useScheduleUndo';

export const STORAGE_KEY = 'antigravity_schedule_state_v3';

// 初期データ定義
export const INITIAL_TIME_SETTINGS: TimeSettings = {
  startTime: '09:00',
  endTime: '12:00',
  slotDuration: 45,
  intervalDuration: 5
};

export const INITIAL_ROOMS: Room[] = [
  { id: 'room-perc', name: '打楽器室', capacity: 6, isPersonalPracticeCandidate: true, permanentInstrumentId: 'timp' },
  { id: 'room-music', name: '音楽室', capacity: 20, isPersonalPracticeCandidate: true },
  { id: 'room-med1', name: '中練習室1', capacity: 8, isPersonalPracticeCandidate: true },
  { id: 'room-med2', name: '中練習室2', capacity: 8, isPersonalPracticeCandidate: true }
];

export const INITIAL_SONGS: Song[] = [
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

export const INITIAL_NG_PAIRS: DuplicateNGPair[] = [
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

export const INITIAL_ENTRIES: Entry[] = [
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

export function createDefaultScheduleState(): ScheduleState {
  return {
    timeSettings: INITIAL_TIME_SETTINGS,
    rooms: INITIAL_ROOMS,
    instruments: STANDARD_INSTRUMENTS,
    songs: INITIAL_SONGS,
    duplicateNGPairs: INITIAL_NG_PAIRS,
    entries: INITIAL_ENTRIES,
    assignments: []
  };
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function loadInitialScheduleState(): ScheduleState {
  const storage = getLocalStorage();
  if (storage) {
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.rooms && parsed.songs && parsed.entries && parsed.instruments?.length >= 19) {
          return sanitizeScheduleState(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to parse saved state from localStorage', e);
    }
  }
  return createDefaultScheduleState();
}

export interface ScheduleContextType {
  state: ScheduleState;
  setState: React.Dispatch<React.SetStateAction<ScheduleState>>;
  undoControls: ScheduleUndoManager;
  resetState: () => void;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export interface ScheduleProviderProps {
  children: React.ReactNode;
  initialState?: ScheduleState;
  persistToLocalStorage?: boolean;
}

export function ScheduleProvider({
  children,
  initialState,
  persistToLocalStorage = true,
}: ScheduleProviderProps) {
  const [state, setState] = useState<ScheduleState>(() => {
    if (initialState) return sanitizeScheduleState(initialState);
    return loadInitialScheduleState();
  });

  const undoControls = useScheduleUndo(state.assignments, (newAssignments) => {
    setState(prev => ({
      ...prev,
      assignments: newAssignments
    }));
  });

  useEffect(() => {
    const storage = getLocalStorage();
    if (persistToLocalStorage && storage) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error('Failed to persist schedule state to localStorage', e);
      }
    }
  }, [state, persistToLocalStorage]);

  const resetState = useCallback(() => {
    const defaultState = createDefaultScheduleState();
    setState(defaultState);
  }, []);

  const value = useMemo<ScheduleContextType>(() => ({
    state,
    setState,
    undoControls,
    resetState,
  }), [state, undoControls, resetState]);

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}

/**
 * ScheduleContext の状態とディスパッチ関数を取得するカスタムフック。
 * ScheduleProvider 内でのみ使用可能です。
 */
export function useSchedule(): ScheduleContextType {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}

/**
 * ScheduleContext の状態をオプショナルで取得するカスタムフック。
 * Provider 外（単体テストや部員閲覧モードなど）で呼ばれてもエラーを投げず null を返します。
 */
export function useOptionalSchedule(): ScheduleContextType | null {
  return useContext(ScheduleContext);
}
