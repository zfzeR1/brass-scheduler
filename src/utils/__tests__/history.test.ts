import { describe, it, expect, vi } from 'vitest';
import {
  ScheduleHistoryManager,
  createScheduleHistory,
  pushHistorySnapshot,
  popHistorySnapshot,
  MAX_HISTORY_DEPTH
} from '../history';
import { useScheduleUndo } from '../../hooks/useScheduleUndo';
import type { Assignment } from '../../types';
import React from 'react';
import { renderToString } from 'react-dom/server';

function createSampleAssignment(slotIndex: number, roomId: string, entryId?: string): Assignment {
  return {
    id: `${slotIndex}_${roomId}`,
    slotIndex,
    roomId,
    entryId,
    parts: entryId
      ? [{ songId: 'song-1', instrumentId: 'fl', partIndex: 0 }]
      : [],
    isLocked: false,
    isPersonalPractice: false
  };
}

describe('history utility & undo manager', () => {
  const initialAssignments: Assignment[] = [
    createSampleAssignment(0, 'room-1', 'entry-a'),
    createSampleAssignment(0, 'room-2', 'entry-b'),
    createSampleAssignment(1, 'room-1', 'entry-c')
  ];

  describe('initial state', () => {
    it('initializes with canUndo = false and historyLength = 0', () => {
      const manager = createScheduleHistory(initialAssignments);

      expect(manager.canUndo).toBe(false);
      expect(manager.historyLength).toBe(0);
      expect(manager.history).toEqual([]);
      expect(manager.assignments).toEqual(initialAssignments);
      // Immutability: assignments should be a distinct deep clone
      expect(manager.assignments).not.toBe(initialAssignments);
      expect(manager.assignments[0]).not.toBe(initialAssignments[0]);
    });

    it('handles empty initial assignments gracefully', () => {
      const manager = createScheduleHistory([]);

      expect(manager.canUndo).toBe(false);
      expect(manager.historyLength).toBe(0);
      expect(manager.history).toEqual([]);
      expect(manager.assignments).toEqual([]);
    });

    it('defaults to MAX_HISTORY_DEPTH (25) when maxDepth is omitted', () => {
      const manager = createScheduleHistory(initialAssignments);
      expect(manager.maxDepth).toBe(MAX_HISTORY_DEPTH);
      expect(manager.maxDepth).toBe(25);
    });
  });

  describe('push changes and undo enablement', () => {
    it('records history and enables undo when setAssignmentsWithHistory is called with an array', () => {
      const manager = createScheduleHistory(initialAssignments);

      const nextAssignments: Assignment[] = [
        ...initialAssignments,
        createSampleAssignment(1, 'room-2', 'entry-d')
      ];

      manager.setAssignmentsWithHistory(nextAssignments);

      expect(manager.canUndo).toBe(true);
      expect(manager.historyLength).toBe(1);
      expect(manager.assignments).toHaveLength(4);
      expect(manager.assignments[3].entryId).toBe('entry-d');
      expect(manager.history[0]).toEqual(initialAssignments);
    });

    it('records history when updater function is provided', () => {
      const manager = createScheduleHistory(initialAssignments);

      manager.setAssignmentsWithHistory(prev => {
        return prev.map(asm =>
          asm.id === '0_room-1' ? { ...asm, isLocked: true } : asm
        );
      });

      expect(manager.canUndo).toBe(true);
      expect(manager.historyLength).toBe(1);
      expect(manager.assignments.find(a => a.id === '0_room-1')?.isLocked).toBe(true);
      expect(manager.history[0].find(a => a.id === '0_room-1')?.isLocked).toBe(false);
    });

    it('increments history length with successive modifications', () => {
      const manager = createScheduleHistory(initialAssignments);

      for (let i = 1; i <= 5; i++) {
        manager.setAssignmentsWithHistory(prev => [
          ...prev,
          createSampleAssignment(i, 'room-1', `entry-${i}`)
        ]);
        expect(manager.historyLength).toBe(i);
        expect(manager.canUndo).toBe(true);
      }

      expect(manager.historyLength).toBe(5);
    });
  });

  describe('single-step and multi-step undo restoration', () => {
    it('restores exact prior state on single-step undo', () => {
      const manager = createScheduleHistory(initialAssignments);

      const modifiedAssignments: Assignment[] = initialAssignments.map(a =>
        a.id === '0_room-1' ? { ...a, isPersonalPractice: true, parts: [] } : a
      );

      manager.setAssignmentsWithHistory(modifiedAssignments);
      expect(manager.assignments[0].isPersonalPractice).toBe(true);
      expect(manager.canUndo).toBe(true);

      manager.undo();

      expect(manager.assignments).toEqual(initialAssignments);
      expect(manager.assignments[0].isPersonalPractice).toBe(false);
      expect(manager.canUndo).toBe(false);
      expect(manager.historyLength).toBe(0);
    });

    it('restores multiple prior states in exact reverse order', () => {
      const manager = createScheduleHistory(initialAssignments);

      // State 1: lock first assignment
      const state1 = initialAssignments.map(a =>
        a.id === '0_room-1' ? { ...a, isLocked: true } : a
      );
      manager.setAssignmentsWithHistory(state1);

      // State 2: change second assignment to personal practice
      const state2 = state1.map(a =>
        a.id === '0_room-2' ? { ...a, isPersonalPractice: true } : a
      );
      manager.setAssignmentsWithHistory(state2);

      // State 3: add a new assignment
      const state3 = [...state2, createSampleAssignment(2, 'room-1', 'entry-z')];
      manager.setAssignmentsWithHistory(state3);

      expect(manager.historyLength).toBe(3);
      expect(manager.assignments).toEqual(state3);

      // Step 1 undo -> restores state2
      manager.undo();
      expect(manager.historyLength).toBe(2);
      expect(manager.canUndo).toBe(true);
      expect(manager.assignments).toEqual(state2);

      // Step 2 undo -> restores state1
      manager.undo();
      expect(manager.historyLength).toBe(1);
      expect(manager.canUndo).toBe(true);
      expect(manager.assignments).toEqual(state1);

      // Step 3 undo -> restores initial state
      manager.undo();
      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);
      expect(manager.assignments).toEqual(initialAssignments);

      // Extra undo on empty history does nothing
      manager.undo();
      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);
      expect(manager.assignments).toEqual(initialAssignments);
    });
  });

  describe('max history depth and FIFO eviction', () => {
    it('respects default maxDepth limit (25) and evicts oldest snapshots in FIFO order', () => {
      const manager = createScheduleHistory(initialAssignments);

      // Push 30 sequential states
      for (let i = 1; i <= 30; i++) {
        manager.setAssignmentsWithHistory([
          createSampleAssignment(i, 'room-1', `entry-step-${i}`)
        ]);
        expect(manager.historyLength).toBe(Math.min(i, 25));
      }

      // History should be capped at 25
      expect(manager.historyLength).toBe(25);

      // The oldest snapshot in history should now be step 5 (0 to 4 evicted)
      expect(manager.history[0][0].entryId).toBe('entry-step-5');
      // The newest snapshot in history should be step 29
      expect(manager.history[24][0].entryId).toBe('entry-step-29');
      // Current assignment is step 30
      expect(manager.assignments[0].entryId).toBe('entry-step-30');

      // Undoing 25 times should succeed and restore down to step 5
      for (let step = 29; step >= 5; step--) {
        expect(manager.canUndo).toBe(true);
        manager.undo();
        expect(manager.assignments[0].entryId).toBe(`entry-step-${step}`);
      }

      // After 25 undos, history is empty
      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);

      // Further undo is a no-op
      manager.undo();
      expect(manager.assignments[0].entryId).toBe('entry-step-5');
    });

    it('respects custom maxDepth option (e.g. 5 steps)', () => {
      const manager = createScheduleHistory(initialAssignments, { maxDepth: 5 });
      expect(manager.maxDepth).toBe(5);

      for (let i = 1; i <= 10; i++) {
        manager.setAssignmentsWithHistory([
          createSampleAssignment(i, 'room-1', `step-${i}`)
        ]);
      }

      expect(manager.historyLength).toBe(5);
      expect(manager.history[0][0].entryId).toBe('step-5');
      expect(manager.history[4][0].entryId).toBe('step-9');
      expect(manager.assignments[0].entryId).toBe('step-10');
    });
  });

  describe('deep clone immutability', () => {
    it('mutating current assignments does NOT corrupt historical snapshots', () => {
      const manager = createScheduleHistory(initialAssignments);

      // Push a new state
      manager.setAssignmentsWithHistory(prev => [
        ...prev,
        createSampleAssignment(1, 'room-2', 'entry-x')
      ]);

      // Direct in-place mutation of current assignments
      const current = manager.assignments;
      current[0].isLocked = true;
      current[0].parts.push({ songId: 'song-hack', instrumentId: 'hack', partIndex: 99 });
      current.push(createSampleAssignment(9, 'room-hack', 'entry-hack'));

      // The historical snapshot must NOT have been affected by the mutations
      const snapshot = manager.history[0];
      expect(snapshot[0].isLocked).toBe(false);
      expect(snapshot[0].parts).toHaveLength(1);
      expect(snapshot[0].parts[0].instrumentId).toBe('fl');
      expect(snapshot).toHaveLength(3);

      // Undo should restore the uncorrupted state
      manager.undo();
      expect(manager.assignments).toEqual(initialAssignments);
      expect(manager.assignments[0].isLocked).toBe(false);
      expect(manager.assignments[0].parts).toHaveLength(1);
      expect(manager.assignments).toHaveLength(3);
    });

    it('mutating original array passed to constructor does NOT corrupt history or assignments', () => {
      const mutableSource = [createSampleAssignment(0, 'room-1', 'entry-orig')];
      const manager = createScheduleHistory(mutableSource);

      // Mutate source array
      mutableSource[0].entryId = 'entry-tampered';
      mutableSource[0].parts.push({ songId: 's', instrumentId: 'tampered', partIndex: 1 });
      mutableSource.push(createSampleAssignment(1, 'room-2'));

      expect(manager.assignments[0].entryId).toBe('entry-orig');
      expect(manager.assignments[0].parts).toHaveLength(1);
      expect(manager.assignments).toHaveLength(1);
    });

    it('mutating restored assignments does not affect remaining history snapshots', () => {
      const manager = createScheduleHistory(initialAssignments);

      manager.setAssignmentsWithHistory([createSampleAssignment(1, 'room-1', 'step-1')]);
      manager.setAssignmentsWithHistory([createSampleAssignment(2, 'room-1', 'step-2')]);

      // Undo to step-1
      manager.undo();
      expect(manager.assignments[0].entryId).toBe('step-1');

      // Tamper with restored assignments
      manager.assignments[0].entryId = 'step-1-tampered';
      manager.assignments[0].parts.push({ songId: 'bad', instrumentId: 'bad', partIndex: 0 });

      // Undo to initial
      manager.undo();
      expect(manager.assignments[0].entryId).toBe('entry-a');
      expect(manager.assignments[0].parts).toEqual(initialAssignments[0].parts);
    });

    it('in-place mutations inside updater functions do not corrupt prior snapshots', () => {
      const manager = createScheduleHistory(initialAssignments);

      // Deliberately naughty updater that mutates 'prev' in-place before returning
      manager.setAssignmentsWithHistory(prev => {
        prev[0].isLocked = true;
        prev[0].parts[0].instrumentId = 'mutated';
        return prev;
      });

      // The snapshot taken before the update must remain untainted
      expect(manager.history[0][0].isLocked).toBe(false);
      expect(manager.history[0][0].parts[0].instrumentId).toBe('fl');

      manager.undo();
      expect(manager.assignments[0].isLocked).toBe(false);
      expect(manager.assignments[0].parts[0].instrumentId).toBe('fl');
    });
  });

  describe('resetHistory', () => {
    it('clears history stack and resets canUndo and historyLength', () => {
      const manager = createScheduleHistory(initialAssignments);
      manager.setAssignmentsWithHistory([createSampleAssignment(1, 'room-1')]);
      manager.setAssignmentsWithHistory([createSampleAssignment(2, 'room-1')]);

      expect(manager.historyLength).toBe(2);
      expect(manager.canUndo).toBe(true);

      manager.resetHistory();

      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);
      expect(manager.history).toEqual([]);
      // Assignments stay as current when newAssignments is not provided
      expect(manager.assignments[0].slotIndex).toBe(2);
    });

    it('resets assignments when newAssignments parameter is provided', () => {
      const manager = createScheduleHistory(initialAssignments);
      manager.setAssignmentsWithHistory([createSampleAssignment(1, 'room-1')]);

      const freshAssignments = [createSampleAssignment(5, 'room-special', 'entry-fresh')];
      manager.resetHistory(freshAssignments);

      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);
      expect(manager.assignments).toEqual(freshAssignments);
      expect(manager.assignments).not.toBe(freshAssignments); // Deep cloned
    });
  });

  describe('onAssignmentsChange listener callback', () => {
    it('triggers listener when setAssignmentsWithHistory, undo, and resetHistory are called', () => {
      const listener = vi.fn();
      const manager = createScheduleHistory(initialAssignments, {
        onAssignmentsChange: listener
      });

      const next1 = [createSampleAssignment(1, 'room-1', 'e1')];
      manager.setAssignmentsWithHistory(next1);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith(next1);

      manager.undo();
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith(initialAssignments);

      const next2 = [createSampleAssignment(2, 'room-2', 'e2')];
      manager.resetHistory(next2);
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenLastCalledWith(next2);
    });
  });

  describe('pure helper functions: pushHistorySnapshot & popHistorySnapshot', () => {
    it('pushHistorySnapshot produces new array, deep clones, and enforces maxDepth', () => {
      const emptyHistory: Assignment[][] = [];
      const history1 = pushHistorySnapshot(emptyHistory, initialAssignments, 2);

      expect(history1).toHaveLength(1);
      expect(history1[0]).toEqual(initialAssignments);
      expect(history1[0]).not.toBe(initialAssignments);
      expect(history1[0][0]).not.toBe(initialAssignments[0]);

      // Push 2nd snapshot
      const state2 = [createSampleAssignment(1, 'room-1')];
      const history2 = pushHistorySnapshot(history1, state2, 2);
      expect(history2).toHaveLength(2);

      // Push 3rd snapshot (exceeds maxDepth=2, evicts first)
      const state3 = [createSampleAssignment(2, 'room-1')];
      const history3 = pushHistorySnapshot(history2, state3, 2);
      expect(history3).toHaveLength(2);
      expect(history3[0]).toEqual(state2);
      expect(history3[1]).toEqual(state3);
    });

    it('popHistorySnapshot returns previous state and nextHistory, or null if empty', () => {
      expect(popHistorySnapshot([])).toBeNull();

      const state1 = [createSampleAssignment(1, 'room-1')];
      const state2 = [createSampleAssignment(2, 'room-1')];
      const history = [state1, state2];

      const popped = popHistorySnapshot(history);
      expect(popped).not.toBeNull();
      expect(popped?.previous).toEqual(state2);
      expect(popped?.nextHistory).toEqual([state1]);
    });
  });

  describe('useScheduleUndo React Hook rendering', () => {
    it('executes in React rendering context with expected initial contract', () => {
      let capturedState: ReturnType<typeof useScheduleUndo> | null = null;

      function HookTestComponent() {
        capturedState = useScheduleUndo(initialAssignments);
        return React.createElement(
          'div',
          { 'data-testid': 'undo-status' },
          `canUndo:${capturedState.canUndo};length:${capturedState.historyLength}`
        );
      }

      const html = renderToString(React.createElement(HookTestComponent));

      expect(html).toContain('canUndo:false;length:0');
      expect(capturedState).not.toBeNull();
      expect(capturedState!.canUndo).toBe(false);
      expect(capturedState!.historyLength).toBe(0);
      expect(capturedState!.assignments).toEqual(initialAssignments);
      expect(typeof capturedState!.setAssignmentsWithHistory).toBe('function');
      expect(typeof capturedState!.undo).toBe('function');
      expect(typeof capturedState!.resetHistory).toBe('function');
    });
  });
});
