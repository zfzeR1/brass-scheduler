import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatExportFilename,
  calculateExportDimensions,
  formatExportDate,
  formatScheduleMeta,
  generateTimetableDataUrl,
  downloadDataUrl,
  exportTimetableToPng
} from '../timetableExport';
import type { ScheduleState, Song, Room, Entry } from '../../types';

describe('Adversarial Stress Test: R2 Timetable Export & Dimensions', () => {
  describe('Dimension Math with Extreme Room Counts', () => {
    it('handles 0 rooms with minimum 1000px width', () => {
      const dim = calculateExportDimensions(0);
      expect(dim.width).toBe(1000);
      expect(dim.minWidth).toBe(1000);
    });

    it('handles 1 room with minimum 1000px width', () => {
      const dim = calculateExportDimensions(1);
      expect(dim.width).toBe(1000);
      expect(dim.minWidth).toBe(1000);
    });

    it('handles boundary room count 4 (140 + 4*200 = 940 -> 1000)', () => {
      const dim = calculateExportDimensions(4);
      expect(dim.width).toBe(1000);
      expect(dim.minWidth).toBe(1000);
    });

    it('scales linearly beyond 4 rooms', () => {
      // 5 rooms: 140 + 5 * 200 = 1140
      expect(calculateExportDimensions(5).width).toBe(1140);
      // 10 rooms: 140 + 10 * 200 = 2140
      expect(calculateExportDimensions(10).width).toBe(2140);
      // 20 rooms: 140 + 20 * 200 = 4140
      expect(calculateExportDimensions(20).width).toBe(4140);
      // 50 rooms: 140 + 50 * 200 = 10140
      expect(calculateExportDimensions(50).width).toBe(10140);
    });

    it('handles negative room counts gracefully without falling below 1000px', () => {
      expect(calculateExportDimensions(-1).width).toBe(1000);
      expect(calculateExportDimensions(-100).width).toBe(1000);
      expect(calculateExportDimensions(-Infinity).width).toBe(1000);
    });

    it('handles non-integer room counts', () => {
      // 3.5 rooms: 140 + 3.5 * 200 = 840 -> 1000
      expect(calculateExportDimensions(3.5).width).toBe(1000);
      // 6.5 rooms: 140 + 6.5 * 200 = 1440
      expect(calculateExportDimensions(6.5).width).toBe(1440);
    });
  });

  describe('Filename Generator Date Boundaries & Leap Years', () => {
    it('formats single-digit months and days with zero-padding', () => {
      // Month 0 = Jan (single digit), Day 5 (single digit)
      const date1 = new Date(2026, 0, 5);
      expect(formatExportFilename(date1)).toBe('brass-timetable-20260105.png');

      // Month 8 = Sep (single digit), Day 9 (single digit)
      const date2 = new Date(2026, 8, 9);
      expect(formatExportFilename(date2)).toBe('brass-timetable-20260909.png');
    });

    it('correctly formats leap year leap day (Feb 29)', () => {
      // 2024 leap year
      const leap2024 = new Date(2024, 1, 29);
      expect(formatExportFilename(leap2024)).toBe('brass-timetable-20240229.png');

      // 2028 leap year
      const leap2028 = new Date(2028, 1, 29);
      expect(formatExportFilename(leap2028)).toBe('brass-timetable-20280229.png');

      // Century leap year 2000
      const leap2000 = new Date(2000, 1, 29);
      expect(formatExportFilename(leap2000)).toBe('brass-timetable-20000229.png');
    });

    it('handles year transitions cleanly', () => {
      // New Year Eve
      const nye = new Date(2026, 11, 31);
      expect(formatExportFilename(nye)).toBe('brass-timetable-20261231.png');

      // New Year Day
      const nyd = new Date(2027, 0, 1);
      expect(formatExportFilename(nyd)).toBe('brass-timetable-20270101.png');
    });

    it('generates standard format when no date argument is passed', () => {
      const fn = formatExportFilename();
      expect(fn).toMatch(/^brass-timetable-\d{4}\d{2}\d{2}\.png$/);
    });
  });

  describe('Date Localization (formatExportDate)', () => {
    it('formats Saturday and Sunday correctly in Japanese kanji', () => {
      const sat = new Date(2026, 8, 12); // Saturday
      expect(formatExportDate(sat)).toBe('2026年9月12日(土)');

      const sun = new Date(2026, 8, 13); // Sunday
      expect(formatExportDate(sun)).toBe('2026年9月13日(日)');

      const wed = new Date(2026, 8, 16); // Wednesday
      expect(formatExportDate(wed)).toBe('2026年9月16日(水)');
    });
  });

  describe('Schedule Metadata Summary (formatScheduleMeta)', () => {
    const baseState: ScheduleState = {
      timeSettings: {
        startTime: '08:30',
        endTime: '18:00',
        slotDuration: 60,
        intervalDuration: 15
      },
      rooms: [
        { id: 'r1', name: 'Main', capacity: 40, isPersonalPracticeCandidate: false },
        { id: 'r2', name: 'Sub', capacity: 20, isPersonalPracticeCandidate: true }
      ],
      instruments: [],
      songs: [],
      duplicateNGPairs: [],
      entries: [],
      assignments: []
    };

    it('formats multi-slot metadata accurately', () => {
      const meta = formatScheduleMeta(baseState);
      expect(meta.timeRange).toBe('08:30 - 18:00');
      expect(meta.slotDurationInfo).toBe('1コマ: 60分');
      expect(meta.intervalInfo).toBe('休憩・移動: 15分');
      expect(meta.totalRoomsInfo).toBe('練習場所: 全2室');
      expect(meta.totalSlotsInfo).toMatch(/全\d+コマ/);
    });

    it('handles empty rooms list without crashing', () => {
      const emptyRoomsState: ScheduleState = {
        ...baseState,
        rooms: []
      };
      const meta = formatScheduleMeta(emptyRoomsState);
      expect(meta.totalRoomsInfo).toBe('練習場所: 全0室');
    });

    it('handles 50 rooms state accurately', () => {
      const manyRooms: Room[] = Array.from({ length: 50 }, (_, i) => ({
        id: `r_${i}`,
        name: `Room ${i}`,
        capacity: 10,
        isPersonalPracticeCandidate: false
      }));
      const stateWithManyRooms: ScheduleState = {
        ...baseState,
        rooms: manyRooms
      };
      const meta = formatScheduleMeta(stateWithManyRooms);
      expect(meta.totalRoomsInfo).toBe('練習場所: 全50室');
    });
  });

  describe('Missing or Null DOM Container Rejections', () => {
    it('throws when generateTimetableDataUrl is invoked with null or undefined', async () => {
      await expect(
        // @ts-expect-error test undefined
        generateTimetableDataUrl(undefined)
      ).rejects.toThrow('Target DOM element for export is not provided.');

      await expect(
        // @ts-expect-error test null
        generateTimetableDataUrl(null)
      ).rejects.toThrow('Target DOM element for export is not provided.');
    });

    it('throws when exportTimetableToPng is invoked with null or undefined', async () => {
      await expect(
        // @ts-expect-error test undefined
        exportTimetableToPng(undefined)
      ).rejects.toThrow('Target DOM element for export is not provided.');

      await expect(
        // @ts-expect-error test null
        exportTimetableToPng(null)
      ).rejects.toThrow('Target DOM element for export is not provided.');
    });

    it('downloadDataUrl behaves as no-op when document is undefined in SSR', () => {
      expect(() => {
        downloadDataUrl('data:image/png;base64,sample', 'out.png');
      }).not.toThrow();
    });
  });

  describe('TimetableExportView Layout Tree Under Extreme Conditions', () => {
    it('renders unclipped tree with 15 rooms, 100-character song names, and 30 parts', async () => {
      const { TimetableExportView } = await import('../../components/TimetableExportView');

      const extremeRooms: Room[] = Array.from({ length: 15 }, (_, i) => ({
        id: `room_${i}`,
        name: `Special Band Hall Room #${i + 1}`,
        capacity: 25,
        isPersonalPracticeCandidate: i % 3 === 0,
        permanentInstrumentId: i === 0 ? 'inst_0' : undefined
      }));

      const extremeSongs: Song[] = [
        {
          id: 'song_long',
          name: '交響組曲「宇宙戦艦ヤマト」より 序曲・宇宙戦艦ヤマト・出撃・大いなる愛（吹奏楽大編成版 全曲ノーカット演奏用特別アレンジ）',
          parts: {
            inst_0: 4,
            inst_1: 4,
            inst_2: 6,
            inst_3: 4,
            inst_4: 4,
            inst_5: 4,
            inst_6: 4
          }
        }
      ];

      // 30 parts in a single entry
      const extremeParts = [];
      for (let i = 0; i < 30; i++) {
        extremeParts.push({
          songId: 'song_long',
          instrumentId: `inst_${i % 7}`,
          partIndex: Math.floor(i / 7)
        });
      }

      const extremeEntries: Entry[] = [
        {
          id: 'entry_extreme',
          songId: 'song_long',
          section: '第1楽章 Tutti全奏〜第2楽章 テンポ激変 Allegro con brio',
          parts: extremeParts,
          priority: 'high'
        }
      ];

      const extremeAssignments = [
        {
          id: 'asm_0_0',
          slotIndex: 0,
          roomId: 'room_0',
          entryId: 'entry_extreme',
          parts: extremeParts,
          isLocked: false,
          isPersonalPractice: false
        },
        {
          id: 'asm_0_1',
          slotIndex: 0,
          roomId: 'room_1',
          parts: [],
          isLocked: false,
          isPersonalPractice: true
        }
      ];

      const state: ScheduleState = {
        timeSettings: {
          startTime: '09:00',
          endTime: '12:00',
          slotDuration: 45,
          intervalDuration: 15
        },
        rooms: extremeRooms,
        instruments: Array.from({ length: 7 }, (_, i) => ({ id: `inst_${i}`, name: `Inst ${i}`, movementType: 'movable' })),
        songs: extremeSongs,
        duplicateNGPairs: [],
        entries: extremeEntries,
        assignments: extremeAssignments
      };

      // Invoke component render directly
      const tree = (TimetableExportView as any).render(
        { state, title: 'Adversarial Mega Schedule' },
        null
      );

      expect(tree).toBeDefined();
      expect(tree.props.style).toBeDefined();

      // Calculated width for 15 rooms: 140 + 15 * 200 = 3140px
      expect(tree.props.style.width).toBe('3140px');
      expect(tree.props.style.minWidth).toBe('3140px');

      // Table grid component is the second child of root container
      const tableGrid = tree.props.children[1];
      expect(tableGrid).toBeDefined();

      const tableHeader = tableGrid.props.children[0];
      expect(tableHeader.props.style.gridTemplateColumns).toBe('140px repeat(15, minmax(180px, 1fr))');

      const slotRows = tableGrid.props.children[1];
      expect(Array.isArray(slotRows)).toBe(true);
      expect(slotRows.length).toBe(3); // 09:00 - 12:00 with 45+15 = 60 min slots -> 3 slots

      // Check first row minimum height
      expect(slotRows[0].props.style.minHeight).toBe('88px');

      // Inspect room 0 cell (with rehearsal card)
      const room0Cell = slotRows[0].props.children[1][0];
      expect(room0Cell).toBeDefined();
      const rehearsalCard = room0Cell.props.children[0];
      expect(rehearsalCard).toBeDefined();

      // Parts list container inside rehearsal card
      const partsContainer = rehearsalCard.props.children[1];
      expect(partsContainer.props.style.overflow).toBe('visible');
      expect(partsContainer.props.style.maxHeight).toBe('none');
      expect(partsContainer.props.style.flexWrap).toBe('wrap');

      // Inspect 30 part badges
      const partBadges = partsContainer.props.children;
      expect(partBadges).toHaveLength(30);

      // Inspect room 1 cell (personal practice)
      const room1Cell = slotRows[0].props.children[1][1];
      const personalPracticeCard = room1Cell.props.children[1];
      expect(personalPracticeCard).toBeDefined();
      expect(personalPracticeCard.props.style.backgroundColor).toBe('#f5f3ff');
    });

    it('renders gracefully when rooms array is empty', async () => {
      const { TimetableExportView } = await import('../../components/TimetableExportView');

      const emptyState: ScheduleState = {
        timeSettings: {
          startTime: '10:00',
          endTime: '11:00',
          slotDuration: 50,
          intervalDuration: 10
        },
        rooms: [],
        instruments: [],
        songs: [],
        duplicateNGPairs: [],
        entries: [],
        assignments: []
      };

      const tree = (TimetableExportView as any).render({ state: emptyState }, null);
      expect(tree).toBeDefined();
      expect(tree.props.style.width).toBe('1000px');
      expect(tree.props.style.minWidth).toBe('1000px');
    });
  });
});

describe('Adversarial Stress Test: R4 & R5 Vitest Mock Engine', () => {
  describe('vi.fn() Call Tracking & Implementation Control', () => {
    it('creates an empty mock that returns undefined and tracks calls', () => {
      const mock = vi.fn();
      expect(mock.mock.calls).toHaveLength(0);
      expect(mock.mock.results).toHaveLength(0);

      const res = mock('arg1', 123, { a: true });
      expect(res).toBeUndefined();
      expect(mock.mock.calls).toHaveLength(1);
      expect(mock.mock.calls[0]).toEqual(['arg1', 123, { a: true }]);
      expect(mock.mock.results[0]).toEqual({ type: 'return', value: undefined });
    });

    it('respects initial implementation and return values', () => {
      const adder = vi.fn((a: number, b: number) => a + b);
      const result = adder(5, 7);
      expect(result).toBe(12);
      expect(adder.mock.calls[0]).toEqual([5, 7]);
      expect(adder.mock.results[0]).toEqual({ type: 'return', value: 12 });
    });

    it('records thrown exceptions in mock.results', () => {
      const throwingMock = vi.fn(() => {
        throw new Error('Explosion');
      });

      expect(() => throwingMock()).toThrow('Explosion');
      expect(throwingMock.mock.calls).toHaveLength(1);
      expect(throwingMock.mock.results[0].type).toBe('throw');
      expect(throwingMock.mock.results[0].value).toBeInstanceOf(Error);
    });

    it('updates implementation with mockImplementation', () => {
      const fn = vi.fn(() => 'first');
      expect(fn()).toBe('first');

      fn.mockImplementation(() => 'second');
      expect(fn()).toBe('second');
      expect(fn.mock.calls).toHaveLength(2);
    });

    it('updates return value with mockReturnValue', () => {
      const fn = vi.fn();
      fn.mockReturnValue('static_val');
      expect(fn()).toBe('static_val');
      expect(fn('foo')).toBe('static_val');
      expect(fn.mock.calls).toHaveLength(2);
    });

    it('clears calls and results with mockClear without wiping implementation', () => {
      const fn = vi.fn((x: number) => x * 2);
      fn(10);
      fn(20);
      expect(fn.mock.calls).toHaveLength(2);

      fn.mockClear();
      expect(fn.mock.calls).toHaveLength(0);
      expect(fn.mock.results).toHaveLength(0);

      // Implementation remains
      expect(fn(5)).toBe(10);
      expect(fn.mock.calls).toHaveLength(1);
    });

    it('resets calls, results, and implementation with mockReset', () => {
      const fn = vi.fn((x: number) => x * 2);
      fn(10);
      expect(fn.mock.calls).toHaveLength(1);

      fn.mockReset();
      expect(fn.mock.calls).toHaveLength(0);
      expect(fn.mock.results).toHaveLength(0);

      // Implementation reset to undefined
      expect(fn(5)).toBeUndefined();
    });
  });

  describe('vi.spyOn() and mockRestore', () => {
    it('spies on object methods, intercepts calls, and restores original', () => {
      const service = {
        calculate(a: number, b: number): number {
          return a * b;
        }
      };

      const spy = vi.spyOn(service, 'calculate');
      expect(service.calculate(3, 4)).toBe(12);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenLastCalledWith(3, 4);

      // Override implementation
      spy.mockReturnValue(999);
      expect(service.calculate(3, 4)).toBe(999);
      expect(spy).toHaveBeenCalledTimes(2);

      // Restore original method
      spy.mockRestore();
      expect(service.calculate(3, 4)).toBe(12);
    });

    it('throws TypeError when attempting to spy on non-objects', () => {
      expect(() => {
        // @ts-expect-error test non-object
        vi.spyOn(null, 'foo');
      }).toThrow();

      expect(() => {
        // @ts-expect-error test primitive
        vi.spyOn('string', 'charAt');
      }).toThrow();
    });

    it('restores all spies at once with vi.restoreAllMocks()', () => {
      const obj1 = { doA: () => 'A' };
      const obj2 = { doB: () => 'B' };

      const spyA = vi.spyOn(obj1, 'doA');
      const spyB = vi.spyOn(obj2, 'doB');
      spyA.mockReturnValue('A_mocked');
      spyB.mockReturnValue('B_mocked');

      expect(obj1.doA()).toBe('A_mocked');
      expect(obj2.doB()).toBe('B_mocked');

      vi.restoreAllMocks();

      expect(obj1.doA()).toBe('A');
      expect(obj2.doB()).toBe('B');
    });
  });

  describe('vi.stubGlobal() and vi.unstubAllGlobals()', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('stubs an existing global and restores it on unstub', () => {
      // Create a global
      (globalThis as any).__TEST_EXISTING_GLOBAL__ = 'original_value';

      vi.stubGlobal('__TEST_EXISTING_GLOBAL__', 'stubbed_value');
      expect((globalThis as any).__TEST_EXISTING_GLOBAL__).toBe('stubbed_value');

      vi.unstubAllGlobals();
      expect((globalThis as any).__TEST_EXISTING_GLOBAL__).toBe('original_value');

      delete (globalThis as any).__TEST_EXISTING_GLOBAL__;
    });

    it('stubs a non-existing global and completely removes it on unstub', () => {
      expect('__BRAND_NEW_GLOBAL__' in globalThis).toBe(false);

      vi.stubGlobal('__BRAND_NEW_GLOBAL__', 42);
      expect((globalThis as any).__BRAND_NEW_GLOBAL__).toBe(42);

      vi.unstubAllGlobals();
      expect('__BRAND_NEW_GLOBAL__' in globalThis).toBe(false);
    });

    it('multiple sequential stubs on the same key preserve original value', () => {
      (globalThis as any).__MULTI_STUB__ = 'initial';

      vi.stubGlobal('__MULTI_STUB__', 'stub_1');
      expect((globalThis as any).__MULTI_STUB__).toBe('stub_1');

      vi.stubGlobal('__MULTI_STUB__', 'stub_2');
      expect((globalThis as any).__MULTI_STUB__).toBe('stub_2');

      vi.unstubAllGlobals();
      expect((globalThis as any).__MULTI_STUB__).toBe('initial');

      delete (globalThis as any).__MULTI_STUB__;
    });
  });

  describe('Assertion Matchers for Mocks', () => {
    it('verifies toHaveBeenCalled and .not.toHaveBeenCalled', () => {
      const mock = vi.fn();
      expect(mock).not.toHaveBeenCalled();

      mock();
      expect(mock).toHaveBeenCalled();
    });

    it('verifies toHaveBeenCalledTimes and .not.toHaveBeenCalledTimes', () => {
      const mock = vi.fn();
      expect(mock).toHaveBeenCalledTimes(0);
      expect(mock).not.toHaveBeenCalledTimes(1);

      mock(1);
      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock).not.toHaveBeenCalledTimes(2);

      mock(2);
      mock(3);
      expect(mock).toHaveBeenCalledTimes(3);
    });

    it('verifies toHaveBeenCalledWith and .not.toHaveBeenCalledWith with deep arguments', () => {
      const mock = vi.fn();
      mock({ id: 101, tags: ['brass', 'trumpet'] }, [1, 2, 3]);

      expect(mock).toHaveBeenCalledWith({ id: 101, tags: ['brass', 'trumpet'] }, [1, 2, 3]);
      expect(mock).not.toHaveBeenCalledWith({ id: 101, tags: ['brass'] }, [1, 2, 3]);
      expect(mock).not.toHaveBeenCalledWith('different');
    });

    it('verifies totoHaveBeenLastCalledWith across multiple calls', () => {
      const mock = vi.fn();
      mock('first_call', 1);
      mock('second_call', 2);
      mock('third_call', 3);

      expect(mock).toHaveBeenLastCalledWith('third_call', 3);
      expect(mock).not.toHaveBeenLastCalledWith('first_call', 1);
      expect(mock).not.toHaveBeenLastCalledWith('second_call', 2);
    });
  });
});
