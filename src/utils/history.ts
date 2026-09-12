import type { Assignment } from '../types';

export const MAX_HISTORY_DEPTH = 25;

export interface HistoryManagerOptions {
  maxDepth?: number;
  onAssignmentsChange?: (assignments: Assignment[]) => void;
}

export interface ScheduleUndoManager {
  readonly assignments: Assignment[];
  readonly canUndo: boolean;
  readonly historyLength: number;
  readonly history: Assignment[][];
  setAssignmentsWithHistory(updater: Assignment[] | ((prev: Assignment[]) => Assignment[])): void;
  undo(): void;
  resetHistory(newAssignments?: Assignment[]): void;
}

/**
 * Pure state manager for schedule undo history.
 * Maintains an undo stack of assignment snapshots with FIFO eviction at maxDepth,
 * deep cloning via structuredClone to guarantee strict immutability.
 */
export class ScheduleHistoryManager implements ScheduleUndoManager {
  private _assignments: Assignment[];
  private _history: Assignment[][] = [];
  private _maxDepth: number;
  private _onAssignmentsChange?: (assignments: Assignment[]) => void;

  constructor(
    initialAssignments: Assignment[] = [],
    optionsOrDepth?: number | HistoryManagerOptions
  ) {
    const options: HistoryManagerOptions =
      typeof optionsOrDepth === 'number'
        ? { maxDepth: optionsOrDepth }
        : optionsOrDepth || {};

    this._maxDepth = options.maxDepth ?? MAX_HISTORY_DEPTH;
    this._onAssignmentsChange = options.onAssignmentsChange;
    this._assignments = structuredClone(initialAssignments);
  }

  get assignments(): Assignment[] {
    return this._assignments;
  }

  get canUndo(): boolean {
    return this._history.length > 0;
  }

  get historyLength(): number {
    return this._history.length;
  }

  get history(): Assignment[][] {
    return this._history;
  }

  get maxDepth(): number {
    return this._maxDepth;
  }

  /**
   * Applies an update to the current assignments while saving a deep cloned snapshot
   * to the history stack. Enforces maxDepth FIFO eviction.
   */
  setAssignmentsWithHistory(
    updater: Assignment[] | ((prev: Assignment[]) => Assignment[])
  ): void {
    // 1. Snapshot current state before update
    const snapshot = structuredClone(this._assignments);

    // 2. Compute new state
    const next = typeof updater === 'function' ? updater(this._assignments) : updater;
    const clonedNext = structuredClone(next);

    // 3. Push snapshot to history
    this._history.push(snapshot);

    // 4. FIFO eviction if exceeding maxDepth
    if (this._history.length > this._maxDepth) {
      this._history.shift();
    }

    // 5. Update current assignments
    this._assignments = clonedNext;

    // 6. Notify listener
    this._onAssignmentsChange?.(this._assignments);
  }

  /**
   * Reverts to the most recent assignment snapshot from history.
   * If history is empty, does nothing.
   */
  undo(): void {
    if (this._history.length === 0) {
      return;
    }
    const previous = this._history.pop()!;
    this._assignments = structuredClone(previous);
    this._onAssignmentsChange?.(this._assignments);
  }

  /**
   * Clears all historical snapshots.
   * Optionally resets current assignments to a new initial state.
   */
  resetHistory(newAssignments?: Assignment[]): void {
    this._history = [];
    if (newAssignments !== undefined) {
      this._assignments = structuredClone(newAssignments);
      this._onAssignmentsChange?.(this._assignments);
    }
  }
}

/**
 * Factory helper to create a new ScheduleHistoryManager.
 */
export function createScheduleHistory(
  initialAssignments: Assignment[] = [],
  optionsOrDepth?: number | HistoryManagerOptions
): ScheduleHistoryManager {
  return new ScheduleHistoryManager(initialAssignments, optionsOrDepth);
}

/**
 * Pure helper function to push a snapshot to history with maxDepth FIFO eviction.
 */
export function pushHistorySnapshot(
  history: Assignment[][],
  currentAssignments: Assignment[],
  maxDepth: number = MAX_HISTORY_DEPTH
): Assignment[][] {
  const snapshot = structuredClone(currentAssignments);
  const nextHistory = [...history, snapshot];
  return nextHistory.length > maxDepth
    ? nextHistory.slice(nextHistory.length - maxDepth)
    : nextHistory;
}

/**
 * Pure helper function to pop the latest snapshot from history.
 */
export function popHistorySnapshot(
  history: Assignment[][]
): { previous: Assignment[]; nextHistory: Assignment[][] } | null {
  if (history.length === 0) return null;
  const previous = structuredClone(history[history.length - 1]);
  const nextHistory = history.slice(0, -1);
  return { previous, nextHistory };
}
