import { useState, useCallback, useRef, useEffect } from 'react';
import type { Assignment } from '../types';
import {
  MAX_HISTORY_DEPTH,
  type ScheduleUndoManager,
  type HistoryManagerOptions,
  ScheduleHistoryManager,
  createScheduleHistory,
  pushHistorySnapshot,
  popHistorySnapshot
} from '../utils/history';

export {
  MAX_HISTORY_DEPTH,
  type ScheduleUndoManager,
  type HistoryManagerOptions,
  ScheduleHistoryManager,
  createScheduleHistory,
  pushHistorySnapshot,
  popHistorySnapshot
};

export interface UseScheduleUndoOptions {
  maxDepth?: number;
  onAssignmentsChange?: (assignments: Assignment[]) => void;
}

/**
 * Custom React hook for managing schedule undo history.
 * Maintains an undo stack of assignment snapshots with FIFO eviction at maxDepth,
 * deep cloning via structuredClone to guarantee strict immutability.
 */
export function useScheduleUndo(
  initialAssignments: Assignment[] = [],
  optionsOrChangeHandler?: UseScheduleUndoOptions | ((assignments: Assignment[]) => void)
): ScheduleUndoManager {
  const options = typeof optionsOrChangeHandler === 'function'
    ? { onAssignmentsChange: optionsOrChangeHandler }
    : (optionsOrChangeHandler || {});

  const maxDepth = options.maxDepth ?? MAX_HISTORY_DEPTH;
  const onAssignmentsChange = options.onAssignmentsChange;

  const [assignments, setAssignments] = useState<Assignment[]>(() => structuredClone(initialAssignments));
  const [history, setHistory] = useState<Assignment[][]>([]);

  const assignmentsRef = useRef<Assignment[]>(assignments);
  assignmentsRef.current = assignments;

  const lastEmittedRef = useRef<Assignment[] | null>(null);

  useEffect(() => {
    if (initialAssignments !== lastEmittedRef.current) {
      setAssignments(structuredClone(initialAssignments));
    }
  }, [initialAssignments]);

  const setAssignmentsWithHistory = useCallback((updater: Assignment[] | ((prev: Assignment[]) => Assignment[])) => {
    const current = assignmentsRef.current;
    const snapshot = structuredClone(current);
    const next = typeof updater === 'function' ? updater(current) : updater;
    const nextCloned = structuredClone(next);

    setHistory(prev => {
      const nextHist = [...prev, snapshot];
      return nextHist.length > maxDepth ? nextHist.slice(nextHist.length - maxDepth) : nextHist;
    });

    lastEmittedRef.current = nextCloned;
    setAssignments(nextCloned);
    onAssignmentsChange?.(nextCloned);
  }, [maxDepth, onAssignmentsChange]);

  const undo = useCallback(() => {
    setHistory(prevHistory => {
      if (prevHistory.length === 0) return prevHistory;

      const previousSnapshot = prevHistory[prevHistory.length - 1];
      const nextHistory = prevHistory.slice(0, -1);

      const restored = structuredClone(previousSnapshot);
      lastEmittedRef.current = restored;
      setAssignments(restored);
      onAssignmentsChange?.(restored);

      return nextHistory;
    });
  }, [onAssignmentsChange]);

  const resetHistory = useCallback((newAssignments?: Assignment[]) => {
    setHistory([]);
    if (newAssignments !== undefined) {
      const nextCloned = structuredClone(newAssignments);
      lastEmittedRef.current = nextCloned;
      setAssignments(nextCloned);
      onAssignmentsChange?.(nextCloned);
    }
  }, [onAssignmentsChange]);

  return {
    assignments,
    setAssignmentsWithHistory,
    undo,
    canUndo: history.length > 0,
    historyLength: history.length,
    resetHistory,
    history
  };
}

export default useScheduleUndo;
