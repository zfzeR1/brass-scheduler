import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SELECTED_PARTS_STORAGE_KEY,
  sanitizeSelectedParts,
  loadSavedSelectedParts,
  saveSelectedParts,
  clearSavedSelectedParts
} from '../partStorage';
import {
  ScheduleHistoryManager,
  createScheduleHistory,
  pushHistorySnapshot,
  popHistorySnapshot,
  MAX_HISTORY_DEPTH
} from '../history';
import type { Song, SelectedPart, Assignment, ScheduleState, Instrument, Room } from '../../types';

class MemoryStorage implements Storage {
  private data: Map<string, string> = new Map();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

function makeAssignment(slotIndex: number, roomId: string, entryId?: string): Assignment {
  return {
    id: `${slotIndex}_${roomId}`,
    slotIndex,
    roomId,
    entryId,
    parts: entryId
      ? [{ songId: 'song-alpha', instrumentId: 'fl', partIndex: 0 }]
      : [],
    isLocked: false,
    isPersonalPractice: false
  };
}

describe('Challenger Stress Test: R1 Part Selection Storage & Sanitization', () => {
  let memStorage: MemoryStorage;
  let origLocalStorage: Storage | undefined;
  let origWindow: unknown;

  const standardSongs: Song[] = [
    {
      id: 'song-1',
      name: 'First Suite in Eb',
      parts: { fl: 2, ob: 1, cl: 3, hrn: 2 }
    },
    {
      id: 'song-2',
      name: 'Second Suite in F',
      parts: { trp: 3, trb: 2, tuba: 1 }
    }
  ];

  beforeEach(() => {
    memStorage = new MemoryStorage();
    origLocalStorage = globalThis.localStorage;
    origWindow = (globalThis as unknown as { window?: unknown }).window;

    Object.defineProperty(globalThis, 'localStorage', {
      value: memStorage,
      writable: true,
      configurable: true
    });
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: memStorage,
        writable: true,
        configurable: true
      });
    }
  });

  afterEach(() => {
    if (origLocalStorage !== undefined) {
      Object.defineProperty(globalThis, 'localStorage', {
        value: origLocalStorage,
        writable: true,
        configurable: true
      });
    }
    if (origWindow !== undefined) {
      (globalThis as unknown as { window?: unknown }).window = origWindow;
    }
  });

  describe('1. Corrupted and Hostile JSON in localStorage', () => {
    const hostilePayloads: Array<{ label: string; payload: string }> = [
      { label: 'syntax error', payload: '{ invalid json %%%' },
      { label: 'truncated object', payload: '{"songId": "song-1", ' },
      { label: 'truncated array', payload: '[{"songId": "song-1", "instrumentId": "fl", "partIndex": 0}, ' },
      { label: 'xml content', payload: '<?xml version="1.0"?><parts></parts>' },
      { label: 'null byte in json', payload: '[\x00{"songId":"song-1"}]' },
      { label: 'literal undefined string', payload: 'undefined' },
      { label: 'literal NaN string', payload: 'NaN' },
      { label: 'literal null string', payload: 'null' },
      { label: 'raw number', payload: '99999' },
      { label: 'raw boolean true', payload: 'true' },
      { label: 'raw boolean false', payload: 'false' },
      { label: 'raw quoted string', payload: '"hello world"' },
      { label: 'object dictionary instead of array', payload: '{"0": {"songId": "song-1", "instrumentId": "fl", "partIndex": 0}}' },
      { label: 'empty string', payload: '' },
      { label: 'whitespace only', payload: '   \n\t  ' },
      { label: 'deeply nested empty array', payload: '[[[[[[]]]]]]' }
    ];

    for (const { label, payload } of hostilePayloads) {
      it(`gracefully recovers from ${label} returning empty array without throwing`, () => {
        if (payload === '') {
          memStorage.removeItem(SELECTED_PARTS_STORAGE_KEY);
        } else {
          memStorage.setItem(SELECTED_PARTS_STORAGE_KEY, payload);
        }
        const result = loadSavedSelectedParts(standardSongs);
        expect(Array.isArray(result)).toBe(true);
        expect(result).toEqual([]);
      });
    }

    it('recovers valid items while discarding corrupt items from mixed array', () => {
      const mixed = [
        null,
        undefined,
        123,
        'not an object',
        {},
        { songId: null, instrumentId: 'fl', partIndex: 0 },
        { songId: '', instrumentId: 'fl', partIndex: 0 },
        { songId: '   ', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-1', instrumentId: '', partIndex: 0 },
        { songId: 'song-1', instrumentId: '   ', partIndex: 0 },
        { songId: 'song-1', instrumentId: 'fl', partIndex: -1 },
        { songId: 'song-1', instrumentId: 'fl', partIndex: 1.5 },
        { songId: 'song-1', instrumentId: 'fl', partIndex: '0' },
        { songId: 'song-1', instrumentId: 'fl', partIndex: NaN },
        { songId: 'song-1', instrumentId: 'fl', partIndex: Infinity },
        { songId: 'song-1', instrumentId: 'fl', partIndex: 0 } // VALID
      ];
      memStorage.setItem(SELECTED_PARTS_STORAGE_KEY, JSON.stringify(mixed));
      const result = loadSavedSelectedParts(standardSongs);
      expect(result).toEqual([
        { songId: 'song-1', instrumentId: 'fl', partIndex: 0 }
      ]);
    });
  });

  describe('2. Missing, Null, or Undefined song.parts Objects', () => {
    it('handles songs array with malformed parts gracefully', () => {
      const hostileSongs: Song[] = [
        { id: 's-null', name: 'Null Parts', parts: null as unknown as Record<string, number> },
        { id: 's-undef', name: 'Undef Parts', parts: undefined as unknown as Record<string, number> },
        { id: 's-str', name: 'Str Parts', parts: 'fl: 2' as unknown as Record<string, number> },
        { id: 's-num', name: 'Num Parts', parts: 123 as unknown as Record<string, number> },
        { id: 's-empty', name: 'Empty Parts', parts: {} },
        {
          id: 's-corrupt-counts',
          name: 'Corrupt Counts',
          parts: {
            zero: 0,
            negative: -2,
            floatVal: 1.5,
            nanVal: NaN,
            infVal: Infinity,
            strVal: '2' as unknown as number,
            validFlute: 2
          }
        }
      ];

      const testParts = [
        { songId: 's-null', instrumentId: 'fl', partIndex: 0 },
        { songId: 's-undef', instrumentId: 'fl', partIndex: 0 },
        { songId: 's-str', instrumentId: 'fl', partIndex: 0 },
        { songId: 's-num', instrumentId: 'fl', partIndex: 0 },
        { songId: 's-empty', instrumentId: 'fl', partIndex: 0 },
        { songId: 's-corrupt-counts', instrumentId: 'zero', partIndex: 0 },
        { songId: 's-corrupt-counts', instrumentId: 'negative', partIndex: 0 },
        { songId: 's-corrupt-counts', instrumentId: 'floatVal', partIndex: 0 },
        { songId: 's-corrupt-counts', instrumentId: 'nanVal', partIndex: 0 },
        { songId: 's-corrupt-counts', instrumentId: 'infVal', partIndex: 0 },
        { songId: 's-corrupt-counts', instrumentId: 'strVal', partIndex: 0 },
        { songId: 's-corrupt-counts', instrumentId: 'validFlute', partIndex: 1 } // VALID
      ];

      const sanitized = sanitizeSelectedParts(testParts, hostileSongs);
      expect(sanitized).toEqual([
        { songId: 's-corrupt-counts', instrumentId: 'validFlute', partIndex: 1 }
      ]);
    });
  });

  describe('3. Deleted Songs, Reduced Part Counts, and Duplicate Keys', () => {
    it('sanitizes deleted songs and bounds out-of-range partIndex after reduction', () => {
      // User had saved part selections from an older schedule
      const saved = [
        { songId: 'song-deleted', instrumentId: 'fl', partIndex: 0 }, // song deleted
        { songId: 'song-1', instrumentId: 'fl', partIndex: 0 },        // valid
        { songId: 'song-1', instrumentId: 'fl', partIndex: 1 },        // valid
        { songId: 'song-1', instrumentId: 'fl', partIndex: 2 },        // reduced: song-1 fl count is 2 (0, 1) -> invalid!
        { songId: 'song-1', instrumentId: 'cl', partIndex: 2 },        // valid (cl count is 3)
        { songId: 'song-1', instrumentId: 'cl', partIndex: 3 }         // out of bounds
      ];

      const result = sanitizeSelectedParts(saved, standardSongs);
      expect(result).toEqual([
        { songId: 'song-1', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-1', instrumentId: 'fl', partIndex: 1 },
        { songId: 'song-1', instrumentId: 'cl', partIndex: 2 }
      ]);
    });

    it('deduplicates identical part selections across distinct orderings', () => {
      const duplicates = [
        { songId: 'song-1', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-2', instrumentId: 'trp', partIndex: 0 },
        { songId: 'song-1', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-1', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-2', instrumentId: 'trp', partIndex: 0 },
        { songId: 'song-2', instrumentId: 'trp', partIndex: 1 }
      ];

      const result = sanitizeSelectedParts(duplicates, standardSongs);
      expect(result).toEqual([
        { songId: 'song-1', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-2', instrumentId: 'trp', partIndex: 0 },
        { songId: 'song-2', instrumentId: 'trp', partIndex: 1 }
      ]);
    });
  });

  describe('4. Storage Quota and Security Restrictions (Private Browsing)', () => {
    it('handles QuotaExceededError when saving without crashing', () => {
      memStorage.setItem = () => {
        const err = new DOMException('Quota exceeded', 'QuotaExceededError');
        throw err;
      };

      expect(() => {
        saveSelectedParts([{ songId: 'song-1', instrumentId: 'fl', partIndex: 0 }]);
      }).not.toThrow();
    });

    it('handles SecurityError when localStorage is blocked (sandboxed / private browsing)', () => {
      memStorage.getItem = () => {
        throw new DOMException('Access denied', 'SecurityError');
      };
      memStorage.setItem = () => {
        throw new DOMException('Access denied', 'SecurityError');
      };

      expect(loadSavedSelectedParts(standardSongs)).toEqual([]);
      expect(() => {
        saveSelectedParts([{ songId: 'song-1', instrumentId: 'fl', partIndex: 0 }]);
      }).not.toThrow();
      expect(() => {
        clearSavedSelectedParts();
      }).not.toThrow();
    });

    it('handles environments where window.localStorage getter itself throws SecurityError', () => {
      const brokenWindow = {};
      Object.defineProperty(brokenWindow, 'localStorage', {
        get() {
          throw new DOMException('Access denied', 'SecurityError');
        },
        configurable: true
      });

      const oldWin = (globalThis as unknown as { window?: unknown }).window;
      (globalThis as unknown as { window?: unknown }).window = brokenWindow;
      const oldLS = globalThis.localStorage;
      // Also delete global localStorage
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;

      try {
        expect(loadSavedSelectedParts(standardSongs)).toEqual([]);
        expect(() => {
          saveSelectedParts([{ songId: 'song-1', instrumentId: 'fl', partIndex: 0 }]);
        }).not.toThrow();
      } finally {
        (globalThis as unknown as { window?: unknown }).window = oldWin;
        Object.defineProperty(globalThis, 'localStorage', {
          value: oldLS,
          writable: true,
          configurable: true
        });
      }
    });
  });
});

describe('Challenger Stress Test: R3 Undo History Stack', () => {
  const initialAssignments: Assignment[] = [
    makeAssignment(0, 'room-1', 'e-init-1'),
    makeAssignment(0, 'room-2', 'e-init-2'),
    makeAssignment(1, 'room-1', 'e-init-3')
  ];

  describe('1. 25-step Capacity and Strict FIFO Eviction', () => {
    it('precisely limits history to 25 steps and evicts oldest first', () => {
      const manager = createScheduleHistory(initialAssignments, 25);
      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);

      // Push 30 successive steps
      for (let i = 1; i <= 30; i++) {
        manager.setAssignmentsWithHistory([
          makeAssignment(0, 'room-1', `step-${i}`)
        ]);
        const expectedLen = Math.min(i, 25);
        expect(manager.historyLength).toBe(expectedLen);
        expect(manager.canUndo).toBe(true);
      }

      // Max capacity is strictly 25
      expect(manager.historyLength).toBe(25);

      // Steps 1..5 were evicted. Oldest in stack is step-5 snapshot (taken before step-6 was applied) -> entry step-5
      expect(manager.history[0][0].entryId).toBe('step-5');
      expect(manager.history[24][0].entryId).toBe('step-29');
      expect(manager.assignments[0].entryId).toBe('step-30');

      // Successively undo all 25 steps
      for (let s = 29; s >= 5; s--) {
        expect(manager.canUndo).toBe(true);
        manager.undo();
        expect(manager.assignments[0].entryId).toBe(`step-${s}`);
      }

      // Now empty: cannot undo further
      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);

      // Extra undo does nothing
      manager.undo();
      expect(manager.assignments[0].entryId).toBe('step-5');
    });
  });

  describe('2. Snapshot Immutability Verification', () => {
    it('mutating exposed assignments does not corrupt history snapshots', () => {
      const manager = createScheduleHistory(initialAssignments);

      manager.setAssignmentsWithHistory([
        makeAssignment(0, 'room-1', 'modified-1')
      ]);

      // Direct mutation of returned assignments
      const exposed = manager.assignments;
      exposed.length = 0; // wiped out

      // History snapshot 0 must be intact
      expect(manager.history[0]).toHaveLength(3);
      expect(manager.history[0][0].entryId).toBe('e-init-1');

      // Undo restores the pure snapshot
      manager.undo();
      expect(manager.assignments).toHaveLength(3);
      expect(manager.assignments[0].entryId).toBe('e-init-1');
    });

    it('mutating nested objects inside exposed assignments does not corrupt history', () => {
      const manager = createScheduleHistory(initialAssignments);

      manager.setAssignmentsWithHistory([
        makeAssignment(0, 'room-1', 'modified-1')
      ]);

      // Deep mutation
      manager.assignments[0].parts[0].instrumentId = 'CORRUPTED';
      manager.assignments[0].roomId = 'CORRUPTED_ROOM';

      manager.undo();
      expect(manager.assignments[0].parts[0].instrumentId).toBe('fl');
      expect(manager.assignments[0].roomId).toBe('room-1');
    });
  });

  describe('3. Undo Under Empty, Single-Item, and Rapid Repeated Undo Calls', () => {
    it('handles empty stack undo gracefully without exception', () => {
      const manager = createScheduleHistory(initialAssignments);
      expect(manager.canUndo).toBe(false);
      expect(() => manager.undo()).not.toThrow();
      expect(manager.assignments).toEqual(initialAssignments);
    });

    it('handles single-item stack undo cleanly', () => {
      const manager = createScheduleHistory(initialAssignments);
      manager.setAssignmentsWithHistory([makeAssignment(1, 'room-1', 'single-change')]);

      expect(manager.historyLength).toBe(1);
      expect(manager.canUndo).toBe(true);

      manager.undo();
      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);
      expect(manager.assignments).toEqual(initialAssignments);

      // Repeat on now-empty stack
      manager.undo();
      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);
      expect(manager.assignments).toEqual(initialAssignments);
    });

    it('handles 100 rapid consecutive undo calls on a 3-item stack', () => {
      const manager = createScheduleHistory(initialAssignments);
      manager.setAssignmentsWithHistory([makeAssignment(1, 'room-1', 'c1')]);
      manager.setAssignmentsWithHistory([makeAssignment(1, 'room-1', 'c2')]);
      manager.setAssignmentsWithHistory([makeAssignment(1, 'room-1', 'c3')]);

      expect(manager.historyLength).toBe(3);

      for (let i = 0; i < 100; i++) {
        expect(() => manager.undo()).not.toThrow();
      }

      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);
      expect(manager.assignments).toEqual(initialAssignments);
    });
  });

  describe('4. Tab Navigation Simulation and History Preservation', () => {
    it('preserves history stack when simulating navigation between Step 1, Step 2, and Step 3', () => {
      // In App.tsx, the undo manager lives in top-level state:
      let appAssignments: Assignment[] = structuredClone(initialAssignments);
      const appUndoManager = createScheduleHistory(appAssignments, {
        maxDepth: 25,
        onAssignmentsChange: (newAssignments) => {
          appAssignments = newAssignments;
        }
      });

      // Simulation of Step 2: User performs 3 manual adjustments
      appUndoManager.setAssignmentsWithHistory([makeAssignment(0, 'room-1', 'step2-adj-1')]);
      appUndoManager.setAssignmentsWithHistory([makeAssignment(0, 'room-1', 'step2-adj-2')]);
      appUndoManager.setAssignmentsWithHistory([makeAssignment(0, 'room-1', 'step2-adj-3')]);

      expect(appUndoManager.historyLength).toBe(3);
      expect(appUndoManager.canUndo).toBe(true);
      expect(appAssignments[0].entryId).toBe('step2-adj-3');

      // User navigates to Step 3 (Share view)
      let currentTab = 'share';
      expect(currentTab).toBe('share');
      // Step 3 does not modify assignments or history
      expect(appUndoManager.historyLength).toBe(3);

      // User navigates to Step 1 (MasterDataTab)
      currentTab = 'master';
      expect(currentTab).toBe('master');
      // Step 1 does not wipe history
      expect(appUndoManager.historyLength).toBe(3);

      // User navigates back to Step 2 (ScheduleTab)
      currentTab = 'schedule';
      expect(currentTab).toBe('schedule');

      // ScheduleTab receives undoControls = appUndoManager
      expect(appUndoManager.canUndo).toBe(true);
      expect(appUndoManager.historyLength).toBe(3);

      // User clicks Undo in Step 2
      appUndoManager.undo();
      expect(appAssignments[0].entryId).toBe('step2-adj-2');
      expect(appUndoManager.historyLength).toBe(2);

      appUndoManager.undo();
      expect(appAssignments[0].entryId).toBe('step2-adj-1');
      expect(appUndoManager.historyLength).toBe(1);

      appUndoManager.undo();
      expect(appAssignments).toEqual(initialAssignments);
      expect(appUndoManager.historyLength).toBe(0);
      expect(appUndoManager.canUndo).toBe(false);
    });
  });

  describe('5. MyPageTab Component Resilience to Hostile Props & Storage', () => {
    it('renders MyPageTab with null/undefined song.parts and corrupted localStorage without crashing', async () => {
      const { default: MyPageTab } = await import('../../components/MyPageTab');
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');

      const localMemStorage = new MemoryStorage();
      const origStorage = globalThis.localStorage;
      Object.defineProperty(globalThis, 'localStorage', {
        value: localMemStorage,
        writable: true,
        configurable: true
      });

      try {
        // Poison localStorage with corrupt JSON
        localMemStorage.setItem(SELECTED_PARTS_STORAGE_KEY, '{ broken json corrupted %%%');

        const hostileState: ScheduleState = {
          timeSettings: {
            startTime: '09:00',
            endTime: '12:00',
            slotDuration: 60,
            intervalDuration: 10
          },
          rooms: [{ id: 'r1', name: 'Room 1', capacity: 5, isPersonalPracticeCandidate: true }],
          instruments: [{ id: 'fl', name: 'Flute', movementType: 'movable' }],
          songs: [
            { id: 's-null', name: 'Null Parts Song', parts: null as unknown as Record<string, number> },
            { id: 's-undef', name: 'Undef Parts Song', parts: undefined as unknown as Record<string, number> },
            { id: 's-valid', name: 'Valid Song', parts: { fl: 2 } }
          ],
          duplicateNGPairs: [],
          entries: [],
          assignments: []
        };

        expect(() => {
          const html = renderToString(React.createElement(MyPageTab, { state: hostileState }));
          expect(typeof html).toBe('string');
          expect(html).toContain('個人時間割（マイページ）');
        }).not.toThrow();
      } finally {
        if (origStorage !== undefined) {
          Object.defineProperty(globalThis, 'localStorage', {
            value: origStorage,
            writable: true,
            configurable: true
          });
        }
      }
    });
  });
});

