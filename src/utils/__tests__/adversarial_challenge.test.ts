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
import type { Song, SelectedPart, Assignment } from '../../types';

class MockStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

function createSampleAssignment(slotIndex: number, roomId: string, entryId?: string): Assignment {
  return {
    id: `${slotIndex}_${roomId}`,
    slotIndex,
    roomId,
    entryId,
    parts: entryId
      ? [{ songId: 'song-test', instrumentId: 'fl', partIndex: 0 }]
      : [],
    isLocked: false,
    isPersonalPractice: false
  };
}

describe('Adversarial Stress Harness: R1 Part Storage & Sanitization', () => {
  const sampleSongs: Song[] = [
    {
      id: 'song-a',
      name: 'Song A',
      parts: { fl: 2, ob: 1, cl: 3 }
    },
    {
      id: 'song-b',
      name: 'Song B',
      parts: { trp: 3, hrn: 4 }
    }
  ];

  let mockStorage: MockStorage;
  let originalLocalStorage: Storage | undefined;
  let originalWindow: unknown;

  beforeEach(() => {
    mockStorage = new MockStorage();
    originalLocalStorage = globalThis.localStorage;
    originalWindow = (globalThis as unknown as { window?: unknown }).window;

    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true
    });
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true
      });
    }
  });

  afterEach(() => {
    if (originalLocalStorage !== undefined) {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true
      });
    }
    if (originalWindow !== undefined) {
      (globalThis as unknown as { window?: unknown }).window = originalWindow;
    }
  });

  describe('Corrupted JSON and Malformed Storage Data', () => {
    const corruptedPayloads = [
      '{ invalid json %%%',
      '{"incomplete": ',
      '<xml>not json</xml>',
      'undefined',
      'NaN',
      'null',
      '12345',
      '"just a string"',
      'true',
      'false',
      '{}',
      '{"songId": "song-a"}',
      '[{"songId": null}]',
      '[{"songId": "song-a", "instrumentId": null}]',
      '[{"songId": "song-a", "instrumentId": "fl", "partIndex": null}]',
      '[{"songId": "song-a", "instrumentId": "fl", "partIndex": "zero"}]',
      '[[[nested array]]]',
      ''
    ];

    corruptedPayloads.forEach((payload, index) => {
      it(`gracefully recovers from corrupted payload #${index + 1}: ${payload.slice(0, 20)}`, () => {
        if (payload === '') {
          mockStorage.removeItem(SELECTED_PARTS_STORAGE_KEY);
        } else {
          mockStorage.setItem(SELECTED_PARTS_STORAGE_KEY, payload);
        }
        const result = loadSavedSelectedParts(sampleSongs);
        expect(Array.isArray(result)).toBe(true);
        expect(result).toEqual([]);
      });
    });
  });

  describe('Null, Undefined, and Adversarial Input Types', () => {
    it('handles non-array and falsy raw inputs without throwing', () => {
      expect(sanitizeSelectedParts(null, sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts(undefined, sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts(0, sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts(false, sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts('', sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts({}, sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts(new Date(), sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts(Symbol('sym'), sampleSongs)).toEqual([]);
    });

    it('handles non-array and falsy songs parameters without throwing', () => {
      const valid = [{ songId: 'song-a', instrumentId: 'fl', partIndex: 0 }];
      expect(sanitizeSelectedParts(valid, null as unknown as Song[])).toEqual([]);
      expect(sanitizeSelectedParts(valid, undefined as unknown as Song[])).toEqual([]);
      expect(sanitizeSelectedParts(valid, 'not-songs' as unknown as Song[])).toEqual([]);
      expect(sanitizeSelectedParts(valid, {} as unknown as Song[])).toEqual([]);
      expect(sanitizeSelectedParts(valid, 42 as unknown as Song[])).toEqual([]);
    });

    it('handles arrays containing non-object and bizarre items', () => {
      const raw = [
        null,
        undefined,
        123,
        'string',
        true,
        [],
        [1, 2, 3],
        () => {},
        Symbol('test'),
        { songId: '   ', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-a', instrumentId: '   ', partIndex: 0 },
        { songId: 'song-a', instrumentId: 'fl', partIndex: 0 } // only valid one
      ];
      const result = sanitizeSelectedParts(raw, sampleSongs);
      expect(result).toEqual([
        { songId: 'song-a', instrumentId: 'fl', partIndex: 0 }
      ]);
    });
  });

  describe('Prototype Pollution and Object Key Attacks', () => {
    it('safely rejects prototype property injection attempts', () => {
      const rawWithProto = JSON.parse(
        '[{"__proto__": {"admin": true, "parts": {"fl": 10}}, "songId": "song-a", "instrumentId": "fl", "partIndex": 0}]'
      );
      const result = sanitizeSelectedParts(rawWithProto, sampleSongs);
      expect(result).toEqual([
        { songId: 'song-a', instrumentId: 'fl', partIndex: 0 }
      ]);
      // Verify Object prototype was not contaminated
      expect((Object.prototype as unknown as Record<string, unknown>).admin).toBeUndefined();
    });

    it('safely rejects built-in prototype method names as instrumentId', () => {
      const attacks = [
        { songId: 'song-a', instrumentId: 'toString', partIndex: 0 },
        { songId: 'song-a', instrumentId: 'valueOf', partIndex: 0 },
        { songId: 'song-a', instrumentId: 'constructor', partIndex: 0 },
        { songId: 'song-a', instrumentId: 'hasOwnProperty', partIndex: 0 },
        { songId: 'song-a', instrumentId: '__proto__', partIndex: 0 }
      ];
      expect(sanitizeSelectedParts(attacks, sampleSongs)).toEqual([]);
    });

    it('safely handles songs whose parts object has prototype properties', () => {
      const maliciousSong: Song = {
        id: 'song-hack',
        name: 'Hack',
        parts: Object.create({ inheritedFl: 5 })
      };
      maliciousSong.parts['cl'] = 2;

      const raw = [
        { songId: 'song-hack', instrumentId: 'inheritedFl', partIndex: 0 },
        { songId: 'song-hack', instrumentId: 'cl', partIndex: 0 }
      ];
      const result = sanitizeSelectedParts(raw, [maliciousSong]);
      expect(result).toEqual([
        { songId: 'song-hack', instrumentId: 'cl', partIndex: 0 }
      ]);
    });
  });

  describe('PartIndex and Instrument Boundary Attacks', () => {
    it('rejects negative, float, NaN, Infinity, and out-of-range partIndex', () => {
      const raw = [
        { songId: 'song-a', instrumentId: 'fl', partIndex: -1 },
        { songId: 'song-a', instrumentId: 'fl', partIndex: -9999 },
        { songId: 'song-a', instrumentId: 'fl', partIndex: 0.5 },
        { songId: 'song-a', instrumentId: 'fl', partIndex: 1.99 },
        { songId: 'song-a', instrumentId: 'fl', partIndex: NaN },
        { songId: 'song-a', instrumentId: 'fl', partIndex: Infinity },
        { songId: 'song-a', instrumentId: 'fl', partIndex: -Infinity },
        { songId: 'song-a', instrumentId: 'fl', partIndex: Number.MAX_SAFE_INTEGER },
        { songId: 'song-a', instrumentId: 'fl', partIndex: 2 }, // song-a fl count is 2 (0, 1 valid)
        { songId: 'song-a', instrumentId: 'fl', partIndex: 1 }  // valid
      ];
      const result = sanitizeSelectedParts(raw, sampleSongs);
      expect(result).toEqual([
        { songId: 'song-a', instrumentId: 'fl', partIndex: 1 }
      ]);
    });

    it('filters out non-existent songId and zero-count or negative instruments', () => {
      const songWithZero: Song = {
        id: 'song-zero',
        name: 'Zero Song',
        parts: {
          zeroInst: 0,
          negInst: -3,
          floatInst: 2.5 as unknown as number,
          strInst: '2' as unknown as number,
          validInst: 1
        }
      };
      const raw = [
        { songId: 'ghost-song', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-zero', instrumentId: 'zeroInst', partIndex: 0 },
        { songId: 'song-zero', instrumentId: 'negInst', partIndex: 0 },
        { songId: 'song-zero', instrumentId: 'floatInst', partIndex: 0 },
        { songId: 'song-zero', instrumentId: 'strInst', partIndex: 0 },
        { songId: 'song-zero', instrumentId: 'validInst', partIndex: 0 }
      ];
      const result = sanitizeSelectedParts(raw, [songWithZero]);
      expect(result).toEqual([
        { songId: 'song-zero', instrumentId: 'validInst', partIndex: 0 }
      ]);
    });

    it('deduplicates duplicate part references cleanly', () => {
      const duplicates = [
        { songId: 'song-a', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-a', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-a', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-a', instrumentId: 'fl', partIndex: 1 },
        { songId: 'song-a', instrumentId: 'fl', partIndex: 1 }
      ];
      const result = sanitizeSelectedParts(duplicates, sampleSongs);
      expect(result).toEqual([
        { songId: 'song-a', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-a', instrumentId: 'fl', partIndex: 1 }
      ]);
    });
  });

  describe('Storage Exception Recovery', () => {
    it('loadSavedSelectedParts catches QuotaExceededError and SecurityError gracefully', () => {
      mockStorage.getItem = () => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      };
      expect(loadSavedSelectedParts(sampleSongs)).toEqual([]);
    });

    it('saveSelectedParts catches QuotaExceededError without re-throwing', () => {
      mockStorage.setItem = () => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      };
      expect(() => {
        saveSelectedParts([{ songId: 'song-a', instrumentId: 'fl', partIndex: 0 }]);
      }).not.toThrow();
    });

    it('clearSavedSelectedParts catches SecurityError without re-throwing', () => {
      mockStorage.removeItem = () => {
        throw new DOMException('SecurityError', 'SecurityError');
      };
      expect(() => {
        clearSavedSelectedParts();
      }).not.toThrow();
    });
  });
});

describe('Adversarial Stress Harness: R3 Undo History Stack', () => {
  const initialAssignments: Assignment[] = [
    createSampleAssignment(0, 'room-1', 'entry-1'),
    createSampleAssignment(0, 'room-2', 'entry-2'),
    createSampleAssignment(1, 'room-1', 'entry-3')
  ];

  describe('Strict Immutability Stress-Testing', () => {
    it('deep nested mutations of active assignments do NOT contaminate stored history snapshots', () => {
      const manager = createScheduleHistory(initialAssignments);

      // Step 1: Push a state
      manager.setAssignmentsWithHistory([
        createSampleAssignment(0, 'room-1', 'step-1')
      ]);

      // Direct hostile mutation of returned assignments array and nested objects
      const exposed = manager.assignments;
      exposed[0].roomId = 'hacked-room';
      exposed[0].parts.push({ songId: 'hack', instrumentId: 'hack', partIndex: 999 });
      exposed[0].isLocked = true;
      exposed.push(createSampleAssignment(99, 'injected-room'));

      // Verify historical snapshot 0 remains pure
      const snapshot = manager.history[0];
      expect(snapshot).toHaveLength(3);
      expect(snapshot[0].roomId).toBe('room-1');
      expect(snapshot[0].parts).toHaveLength(1);
      expect(snapshot[0].parts[0].songId).toBe('song-test');
      expect(snapshot[0].isLocked).toBe(false);

      // Step 2: Undo restores pure state
      manager.undo();
      expect(manager.assignments).toEqual(initialAssignments);
      expect(manager.assignments[0].roomId).toBe('room-1');
      expect(manager.assignments[0].parts).toHaveLength(1);
    });

    it('mutations inside updater function do NOT contaminate prior snapshot', () => {
      const manager = createScheduleHistory(initialAssignments);

      manager.setAssignmentsWithHistory(prev => {
        // Deliberately mutate prev in-place
        prev[0].slotIndex = 999;
        prev[0].parts.length = 0;
        return prev;
      });

      expect(manager.history[0][0].slotIndex).toBe(0);
      expect(manager.history[0][0].parts).toHaveLength(1);
    });
  });

  describe('FIFO Eviction at Max Depth (25 steps)', () => {
    it('discards oldest snapshots strictly in FIFO order when 25 steps are exceeded', () => {
      const manager = createScheduleHistory(initialAssignments);
      const totalSteps = 100;

      for (let i = 1; i <= totalSteps; i++) {
        manager.setAssignmentsWithHistory([
          createSampleAssignment(i, 'room-1', `entry-step-${i}`)
        ]);
        expect(manager.historyLength).toBe(Math.min(i, 25));
      }

      // Max capacity must be 25
      expect(manager.historyLength).toBe(25);

      // Oldest snapshot must be step (100 - 25) = step 75
      expect(manager.history[0][0].entryId).toBe('entry-step-75');
      // Newest snapshot must be step 99
      expect(manager.history[24][0].entryId).toBe('entry-step-99');
      // Current assignments must be step 100
      expect(manager.assignments[0].entryId).toBe('entry-step-100');

      // Undo 25 times successively
      for (let expectedStep = 99; expectedStep >= 75; expectedStep--) {
        expect(manager.canUndo).toBe(true);
        manager.undo();
        expect(manager.assignments[0].entryId).toBe(`entry-step-${expectedStep}`);
      }

      // Stack is now empty
      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);
    });
  });

  describe('Repeated Undo Operations Until Empty', () => {
    it('maintains clean disabled state when undo is invoked repeatedly on empty history', () => {
      const manager = createScheduleHistory(initialAssignments);

      // Push 3 states
      manager.setAssignmentsWithHistory([createSampleAssignment(1, 'room-1')]);
      manager.setAssignmentsWithHistory([createSampleAssignment(2, 'room-1')]);
      manager.setAssignmentsWithHistory([createSampleAssignment(3, 'room-1')]);

      expect(manager.historyLength).toBe(3);
      expect(manager.canUndo).toBe(true);

      // 3 undos bring it back to initial
      manager.undo();
      manager.undo();
      manager.undo();

      expect(manager.historyLength).toBe(0);
      expect(manager.canUndo).toBe(false);
      expect(manager.assignments).toEqual(initialAssignments);

      // 10 extra undos on empty history
      for (let i = 0; i < 10; i++) {
        expect(() => manager.undo()).not.toThrow();
        expect(manager.historyLength).toBe(0);
        expect(manager.canUndo).toBe(false);
        expect(manager.assignments).toEqual(initialAssignments);
      }
    });

    it('resetHistory cleans state immediately', () => {
      const manager = createScheduleHistory(initialAssignments);
      manager.setAssignmentsWithHistory([createSampleAssignment(1, 'room-1')]);
      manager.setAssignmentsWithHistory([createSampleAssignment(2, 'room-1')]);

      expect(manager.canUndo).toBe(true);
      manager.resetHistory();

      expect(manager.canUndo).toBe(false);
      expect(manager.historyLength).toBe(0);
      expect(manager.history).toEqual([]);
    });
  });
});
