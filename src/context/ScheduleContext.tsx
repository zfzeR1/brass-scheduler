import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { ScheduleState } from '../types';
import { sanitizeScheduleState } from '../utils/scheduleIntegrity';
import { useScheduleUndo, type ScheduleUndoManager } from '../hooks/useScheduleUndo';
import {
  INITIAL_TIME_SETTINGS,
  INITIAL_ROOMS,
  INITIAL_SONGS,
  INITIAL_NG_PAIRS,
  INITIAL_ENTRIES,
  createDefaultScheduleState
} from '../constants/initialData';

// 後方互換性のための再エクスポート
export {
  INITIAL_TIME_SETTINGS,
  INITIAL_ROOMS,
  INITIAL_SONGS,
  INITIAL_NG_PAIRS,
  INITIAL_ENTRIES,
  createDefaultScheduleState
};

export const STORAGE_KEY = 'antigravity_schedule_state_v3';

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

/**
 * 状態を変更するためのディスパッチ操作型（stateを含まない）
 */
export interface ScheduleDispatchType {
  setState: React.Dispatch<React.SetStateAction<ScheduleState>>;
  undoControls: ScheduleUndoManager;
  resetState: () => void;
}

/**
 * 統合Context型（後方互換性用: state + dispatch）
 */
export type ScheduleContextType = {
  state: ScheduleState;
} & ScheduleDispatchType;

// State専用Context (状態読み取りのみ購読)
const ScheduleStateContext = createContext<ScheduleState | null>(null);

// Dispatch専用Context (操作ハンドラのみ購読し、state変更による不要再レンダリングを回避)
const ScheduleDispatchContext = createContext<ScheduleDispatchType | null>(null);

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

  // localStorage への書き込みをデバウンス (400ms) してドラッグ操作中等のUIジャンクを排除
  useEffect(() => {
    if (!persistToLocalStorage) return;
    const storage = getLocalStorage();
    if (!storage) return;

    const timer = setTimeout(() => {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error('Failed to persist schedule state to localStorage', e);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [state, persistToLocalStorage]);

  // ページ離脱時（リロード・タブ閉じ）に未保存の変更を即時フラッシュ保存
  useEffect(() => {
    if (!persistToLocalStorage) return;
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = () => {
      const storage = getLocalStorage();
      if (storage) {
        try {
          storage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
          // ignore error on window exit
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state, persistToLocalStorage]);

  const resetState = useCallback(() => {
    const defaultState = createDefaultScheduleState();
    setState(defaultState);
  }, []);

  const dispatchValue = useMemo<ScheduleDispatchType>(() => ({
    setState,
    undoControls,
    resetState,
  }), [undoControls, resetState]);

  return (
    <ScheduleDispatchContext.Provider value={dispatchValue}>
      <ScheduleStateContext.Provider value={state}>
        {children}
      </ScheduleStateContext.Provider>
    </ScheduleDispatchContext.Provider>
  );
}

/**
 * スケジュールの状態 (state) のみを取得するカスタムフック。
 * 状態が変更された時のみ再レンダリングされます。
 */
export function useScheduleState(): ScheduleState {
  const state = useContext(ScheduleStateContext);
  if (!state) {
    throw new Error('useScheduleState must be used within a ScheduleProvider');
  }
  return state;
}

/**
 * スケジュールの操作関数 (setState, undoControls, resetState) のみを取得するカスタムフック。
 * state が変更されてもこのフックを利用するコンポーネントは再レンダリングされません。
 */
export function useScheduleDispatch(): ScheduleDispatchType {
  const dispatch = useContext(ScheduleDispatchContext);
  if (!dispatch) {
    throw new Error('useScheduleDispatch must be used within a ScheduleProvider');
  }
  return dispatch;
}

/**
 * オプショナルな状態取得フック（Provider外でもnull安全）
 */
export function useOptionalScheduleState(): ScheduleState | null {
  return useContext(ScheduleStateContext);
}

/**
 * オプショナルな操作関数取得フック（Provider外でもnull安全）
 */
export function useOptionalScheduleDispatch(): ScheduleDispatchType | null {
  return useContext(ScheduleDispatchContext);
}

/**
 * ScheduleContext の状態とディスパッチ関数をまとめて取得する統合カスタムフック（後方互換性用）。
 */
export function useSchedule(): ScheduleContextType {
  const state = useOptionalScheduleState();
  const dispatch = useOptionalScheduleDispatch();
  if (!state || !dispatch) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return useMemo(() => ({
    state,
    ...dispatch
  }), [state, dispatch]);
}

/**
 * ScheduleContext の状態をオプショナルで取得するカスタムフック（後方互換性用）。
 * Provider 外（単体テストや部員閲覧モードなど）で呼ばれてもエラーを投げず null を返します。
 */
export function useOptionalSchedule(): ScheduleContextType | null {
  const state = useOptionalScheduleState();
  const dispatch = useOptionalScheduleDispatch();
  return useMemo(() => {
    if (!state || !dispatch) return null;
    return {
      state,
      ...dispatch
    };
  }, [state, dispatch]);
}
