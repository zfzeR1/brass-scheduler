import { describe, it, expect } from 'vitest';
import {
  formatExportFilename,
  calculateExportDimensions,
  formatExportDate,
  formatScheduleMeta,
  generateTimetableDataUrl,
  downloadDataUrl,
  exportTimetableToPng
} from '../timetableExport';
import type { ScheduleState } from '../../types';

describe('timetableExport utilities', () => {
  describe('formatExportFilename', () => {
    it('generates filename matching brass-timetable-YYYYMMDD.png for default date', () => {
      const filename = formatExportFilename();
      expect(filename).toMatch(/^brass-timetable-\d{8}\.png$/);
    });

    it('correctly zero-pads single-digit month and day', () => {
      const date = new Date(2026, 3, 5); // April 5, 2026
      const filename = formatExportFilename(date);
      expect(filename).toBe('brass-timetable-20260405.png');
    });

    it('correctly formats two-digit month and day', () => {
      const date = new Date(2026, 11, 31); // December 31, 2026
      const filename = formatExportFilename(date);
      expect(filename).toBe('brass-timetable-20261231.png');
    });

    it('correctly formats January 1st', () => {
      const date = new Date(2027, 0, 1); // January 1, 2027
      const filename = formatExportFilename(date);
      expect(filename).toBe('brass-timetable-20270101.png');
    });
  });

  describe('calculateExportDimensions', () => {
    it('enforces minimum width of 1000px for small room counts', () => {
      expect(calculateExportDimensions(0)).toEqual({ width: 1000, minWidth: 1000 });
      expect(calculateExportDimensions(1)).toEqual({ width: 1000, minWidth: 1000 });
      expect(calculateExportDimensions(2)).toEqual({ width: 1000, minWidth: 1000 });
      expect(calculateExportDimensions(3)).toEqual({ width: 1000, minWidth: 1000 });
      expect(calculateExportDimensions(4)).toEqual({ width: 1000, minWidth: 1000 });
    });

    it('scales width dynamically when 140 + rooms * 200 > 1000', () => {
      // 5 rooms: 140 + 5 * 200 = 1140
      expect(calculateExportDimensions(5)).toEqual({ width: 1140, minWidth: 1140 });

      // 6 rooms: 140 + 6 * 200 = 1340
      expect(calculateExportDimensions(6)).toEqual({ width: 1340, minWidth: 1340 });

      // 10 rooms: 140 + 10 * 200 = 2140
      expect(calculateExportDimensions(10)).toEqual({ width: 2140, minWidth: 2140 });
    });

    it('handles negative room counts gracefully', () => {
      expect(calculateExportDimensions(-3)).toEqual({ width: 1000, minWidth: 1000 });
    });
  });

  describe('formatExportDate', () => {
    it('formats date into Japanese year/month/day with day of week', () => {
      // 2026-09-12 is Saturday (土)
      const date = new Date(2026, 8, 12);
      expect(formatExportDate(date)).toBe('2026年9月12日(土)');
    });

    it('formats Sunday correctly', () => {
      // 2026-09-13 is Sunday (日)
      const date = new Date(2026, 8, 13);
      expect(formatExportDate(date)).toBe('2026年9月13日(日)');
    });
  });

  describe('formatScheduleMeta', () => {
    const sampleState: ScheduleState = {
      timeSettings: {
        startTime: '09:00',
        endTime: '17:00',
        slotDuration: 45,
        intervalDuration: 15
      },
      rooms: [
        { id: 'r1', name: '大練習室', capacity: 30, isPersonalPracticeCandidate: false },
        { id: 'r2', name: '第1音楽室', capacity: 15, isPersonalPracticeCandidate: true },
        { id: 'r3', name: '第2音楽室', capacity: 10, isPersonalPracticeCandidate: true }
      ],
      instruments: [],
      songs: [],
      duplicateNGPairs: [],
      entries: [],
      assignments: []
    };

    it('calculates time range and slot summary info correctly', () => {
      const meta = formatScheduleMeta(sampleState);
      expect(meta.timeRange).toBe('09:00 - 17:00');
      expect(meta.slotDurationInfo).toBe('1コマ: 45分');
      expect(meta.intervalInfo).toBe('休憩・移動: 15分');
      expect(meta.totalSlotsInfo).toBe('全8コマ');
      expect(meta.totalRoomsInfo).toBe('練習場所: 全3室');
    });

    it('adapts to different slot intervals and room counts', () => {
      const customState: ScheduleState = {
        ...sampleState,
        timeSettings: {
          startTime: '10:00',
          endTime: '12:00',
          slotDuration: 50,
          intervalDuration: 10
        },
        rooms: [{ id: 'r1', name: 'ホール', capacity: 50, isPersonalPracticeCandidate: false }]
      };
      const meta = formatScheduleMeta(customState);
      expect(meta.timeRange).toBe('10:00 - 12:00');
      expect(meta.totalSlotsInfo).toBe('全2コマ');
      expect(meta.totalRoomsInfo).toBe('練習場所: 全1室');
    });
  });

  describe('generateTimetableDataUrl & exportTimetableToPng', () => {
    it('throws when element is not provided', async () => {
      await expect(
        // @ts-expect-error test undefined element
        generateTimetableDataUrl(undefined)
      ).rejects.toThrow('Target DOM element for export is not provided.');

      await expect(
        // @ts-expect-error test null element
        exportTimetableToPng(null)
      ).rejects.toThrow('Target DOM element for export is not provided.');
    });

    it('generates a valid data URL from a simulated node', async () => {
      const dummyNode = {
        offsetWidth: 1000,
        offsetHeight: 600,
        outerHTML: '<div id="test">Brass Timetable</div>',
        childNodes: [],
        cloneNode: () => dummyNode
      } as unknown as HTMLElement;

      const dataUrl = await generateTimetableDataUrl(dummyNode);
      expect(dataUrl).toBeDefined();
      expect(typeof dataUrl).toBe('string');
      expect(dataUrl.startsWith('data:image/')).toBe(true);
    });

    it('executes downloadDataUrl safely in Node environment without crashing', () => {
      expect(() => {
        downloadDataUrl('data:image/png;base64,sample', 'test.png');
      }).not.toThrow();
    });

    it('executes exportTimetableToPng returning dataUrl', async () => {
      const dummyNode = {
        offsetWidth: 1000,
        offsetHeight: 600,
        outerHTML: '<div id="test">Export Test</div>',
        childNodes: [],
        cloneNode: () => dummyNode
      } as unknown as HTMLElement;

      const result = await exportTimetableToPng(dummyNode, 'custom-timetable.png');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
