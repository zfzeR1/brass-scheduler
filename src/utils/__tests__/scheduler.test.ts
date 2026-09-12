import { describe, it, expect } from 'vitest';
import {
  calculateNumSlots,
  getSlotTimeRange,
  formatPartName,
  evaluateSchedule,
  generateSchedule
} from '../scheduler';
import type {
  ScheduleState,
  Room,
  Instrument,
  Song,
  Entry,
  Assignment,
  DuplicateNGPair
} from '../../types';
import { STANDARD_INSTRUMENTS } from '../../types';

describe('scheduler utility functions', () => {
  describe('calculateNumSlots', () => {
    it('calculates the correct number of slots for standard duration', () => {
      // 09:00 - 12:00 = 180 min. cycle = 45 + 5 = 50 min.
      // (180 + 5) / 50 = 3 slots (09:00-09:45, 09:50-10:35, 10:40-11:25; remaining 35m < 45m)
      expect(calculateNumSlots('09:00', '12:00', 45, 5)).toBe(3);

      // 09:00 - 13:00 = 240 min. (240 + 5) / 50 = 4 slots
      expect(calculateNumSlots('09:00', '13:00', 45, 5)).toBe(4);

      // 09:00 - 17:00 = 480 min. (480 + 10) / 70 = 7 slots (slot 60, int 10)
      expect(calculateNumSlots('09:00', '17:00', 60, 10)).toBe(7);
    });

    it('returns 0 for invalid bounds (start >= end)', () => {
      expect(calculateNumSlots('12:00', '09:00', 45, 5)).toBe(0);
      expect(calculateNumSlots('09:00', '09:00', 45, 5)).toBe(0);
      expect(calculateNumSlots('17:30', '09:00', 30, 10)).toBe(0);
    });

    it('handles edge cases gracefully', () => {
      // Slot duration exceeds total time
      expect(calculateNumSlots('09:00', '09:30', 45, 5)).toBe(0);
      // Exact fit for 1 slot without interval
      expect(calculateNumSlots('09:00', '09:45', 45, 5)).toBe(1);
      // Interval duration larger than remaining time
      expect(calculateNumSlots('09:00', '10:00', 45, 30)).toBe(1);
    });
  });

  describe('getSlotTimeRange', () => {
    it('returns formatted start and end times for standard slots', () => {
      const slot0 = getSlotTimeRange(0, '09:00', 45, 5);
      expect(slot0).toEqual({ start: '09:00', end: '09:45' });

      const slot1 = getSlotTimeRange(1, '09:00', 45, 5);
      expect(slot1).toEqual({ start: '09:50', end: '10:35' });

      const slot2 = getSlotTimeRange(2, '09:00', 45, 5);
      expect(slot2).toEqual({ start: '10:40', end: '11:25' });
    });

    it('formats time with leading zeros correctly', () => {
      const earlySlot = getSlotTimeRange(0, '08:05', 30, 5);
      expect(earlySlot.start).toBe('08:05');
      expect(earlySlot.end).toBe('08:35');
    });
  });

  describe('formatPartName', () => {
    const mockInstruments: Instrument[] = [
      { id: 'fl', name: 'フルート', movementType: 'movable' },
      { id: 'hrn', name: 'ホルン', movementType: 'movable' },
      { id: 'timp', name: 'ティンパニ', movementType: 'immovable' }
    ];

    const mockSongs: Song[] = [
      {
        id: 'song-1',
        name: 'アルヴァマー序曲',
        parts: { fl: 1, hrn: 4, timp: 1 }
      }
    ];

    it('formats single-part instruments without numbers', () => {
      // Flute has count 1 in song-1
      const formatted = formatPartName('fl', 0, 'song-1', mockSongs, mockInstruments);
      expect(formatted).toBe('フルート');
    });

    it('formats multi-part instruments with 1-based part numbers', () => {
      // Horn has count 4 in song-1
      const hrn1 = formatPartName('hrn', 0, 'song-1', mockSongs, mockInstruments);
      const hrn2 = formatPartName('hrn', 1, 'song-1', mockSongs, mockInstruments);
      const hrn4 = formatPartName('hrn', 3, 'song-1', mockSongs, mockInstruments);

      expect(hrn1).toBe('ホルン 1');
      expect(hrn2).toBe('ホルン 2');
      expect(hrn4).toBe('ホルン 4');
    });

    it('falls back appropriately when song is not found or undefined', () => {
      // No songId provided
      const part0 = formatPartName('fl', 0, undefined, mockSongs, mockInstruments);
      const part1 = formatPartName('fl', 1, undefined, mockSongs, mockInstruments);
      expect(part0).toBe('フルート');
      expect(part1).toBe('フルート 2');

      // Unknown songId
      const unknown = formatPartName('hrn', 2, 'unknown-song', mockSongs, mockInstruments);
      expect(unknown).toBe('ホルン 3');
    });
  });

  describe('evaluateSchedule', () => {
    const rooms: Room[] = [
      { id: 'room-1', name: '大練習室', capacity: 20, isPersonalPracticeCandidate: false },
      { id: 'room-2', name: '打楽器室', capacity: 5, isPersonalPracticeCandidate: false, permanentInstrumentId: 'timp' },
      { id: 'room-3', name: '個人練習室A', capacity: 5, isPersonalPracticeCandidate: true }
    ];

    const songs: Song[] = [
      {
        id: 'song-a',
        name: '曲A',
        parts: { fl: 2, hrn: 2, timp: 1 }
      },
      {
        id: 'song-b',
        name: '曲B',
        parts: { fl: 2, hrn: 2 }
      }
    ];

    const entries: Entry[] = [
      {
        id: 'entry-1',
        songId: 'song-a',
        section: 'Aメロ',
        priority: 'high',
        parts: [
          { instrumentId: 'fl', partIndex: 0 },
          { instrumentId: 'hrn', partIndex: 0 }
        ]
      },
      {
        id: 'entry-2',
        songId: 'song-a',
        section: 'サビ',
        priority: 'medium',
        parts: [
          { instrumentId: 'timp', partIndex: 0 }
        ]
      }
    ];

    it('penalizes duplicate assignment of the same entry across multiple slots (-50,000 pts)', () => {
      const assignments: Assignment[] = [
        {
          id: '0_room-1',
          slotIndex: 0,
          roomId: 'room-1',
          entryId: 'entry-1',
          parts: [{ instrumentId: 'fl', partIndex: 0 }, { instrumentId: 'hrn', partIndex: 0 }],
          isLocked: false,
          isPersonalPractice: false
        },
        {
          id: '1_room-1',
          slotIndex: 1,
          roomId: 'room-1',
          entryId: 'entry-1', // Duplicate assignment of entry-1
          parts: [{ instrumentId: 'fl', partIndex: 0 }, { instrumentId: 'hrn', partIndex: 0 }],
          isLocked: false,
          isPersonalPractice: false
        },
        {
          id: '0_room-2',
          slotIndex: 0,
          roomId: 'room-2',
          entryId: 'entry-2',
          parts: [{ instrumentId: 'timp', partIndex: 0 }],
          isLocked: false,
          isPersonalPractice: false
        }
      ];

      const { violations } = evaluateSchedule(
        assignments,
        rooms,
        STANDARD_INSTRUMENTS,
        songs,
        [],
        entries,
        2,
        true
      );

      const hasDuplicateViolation = violations.some(v => v.includes('1日に複数回'));
      expect(hasDuplicateViolation).toBe(true);
    });

    it('penalizes room capacity overflow (-100,000 pts per excess person)', () => {
      const smallRoom: Room = { id: 'small-room', name: '小部屋', capacity: 1, isPersonalPracticeCandidate: false };
      const overflowEntry: Entry = {
        id: 'overflow-entry',
        songId: 'song-a',
        section: '合奏',
        priority: 'high',
        parts: [
          { instrumentId: 'fl', partIndex: 0 },
          { instrumentId: 'hrn', partIndex: 0 },
          { instrumentId: 'hrn', partIndex: 1 }
        ] // 3 people in capacity 1 room -> diff = 2
      };

      const assignments: Assignment[] = [
        {
          id: '0_small-room',
          slotIndex: 0,
          roomId: 'small-room',
          entryId: 'overflow-entry',
          parts: overflowEntry.parts,
          isLocked: false,
          isPersonalPractice: false
        }
      ];

      const { violations } = evaluateSchedule(
        assignments,
        [smallRoom],
        STANDARD_INSTRUMENTS,
        songs,
        [],
        [overflowEntry],
        1,
        true
      );

      const hasCapacityViolation = violations.some(v => v.includes('収容定員(1人)を超過しています'));
      expect(hasCapacityViolation).toBe(true);
    });

    it('penalizes placing immovable instruments outside their permanent room (-100,000 pts)', () => {
      // entry-2 contains 'timp' (immovable), permanent room is room-2, but placed in room-1
      const assignments: Assignment[] = [
        {
          id: '0_room-1',
          slotIndex: 0,
          roomId: 'room-1', // Not room-2!
          entryId: 'entry-2',
          parts: [{ instrumentId: 'timp', partIndex: 0 }],
          isLocked: false,
          isPersonalPractice: false
        },
        {
          id: '0_room-2',
          slotIndex: 0,
          roomId: 'room-2',
          entryId: 'entry-1',
          parts: [{ instrumentId: 'fl', partIndex: 0 }],
          isLocked: false,
          isPersonalPractice: false
        }
      ];

      const { violations } = evaluateSchedule(
        assignments,
        rooms,
        STANDARD_INSTRUMENTS,
        songs,
        [],
        entries,
        1,
        true
      );

      const hasImmovableViolation = violations.some(v => v.includes('移動不可楽器「Timp.」が常設部屋'));
      expect(hasImmovableViolation).toBe(true);
    });

    it('penalizes automatic duplicate NG collision across songs (-150,000 pts)', () => {
      // Two entries in the same slot using same instrument and same part index from different songs
      const entrySongA: Entry = {
        id: 'e-song-a',
        songId: 'song-a',
        section: 'Sec A',
        priority: 'high',
        parts: [{ instrumentId: 'fl', partIndex: 0 }]
      };
      const entrySongB: Entry = {
        id: 'e-song-b',
        songId: 'song-b',
        section: 'Sec B',
        priority: 'high',
        parts: [{ instrumentId: 'fl', partIndex: 0 }]
      };

      const assignments: Assignment[] = [
        {
          id: '0_room-1',
          slotIndex: 0,
          roomId: 'room-1',
          entryId: 'e-song-a',
          parts: entrySongA.parts,
          isLocked: false,
          isPersonalPractice: false
        },
        {
          id: '0_room-2',
          slotIndex: 0,
          roomId: 'room-2',
          entryId: 'e-song-b',
          parts: entrySongB.parts,
          isLocked: false,
          isPersonalPractice: false
        }
      ];

      const { violations } = evaluateSchedule(
        assignments,
        rooms,
        STANDARD_INSTRUMENTS,
        songs,
        [],
        [entrySongA, entrySongB],
        1,
        true
      );

      const hasAutoNgViolation = violations.some(v => v.includes('別の曲で同じパート') && v.includes('自動衝突回避'));
      expect(hasAutoNgViolation).toBe(true);
    });

    it('penalizes explicitly configured manual duplicate NG pairs (-150,000 pts)', () => {
      // Manual duplicate NG pair between flute 0 in song-a and horn 1 in song-a
      const manualNgPairs: DuplicateNGPair[] = [
        {
          id: 'ng-1',
          partA: { songId: 'song-a', instrumentId: 'fl', partIndex: 0 },
          partB: { songId: 'song-a', instrumentId: 'hrn', partIndex: 1 }
        }
      ];

      const entryA: Entry = {
        id: 'ea',
        songId: 'song-a',
        section: 'A',
        priority: 'high',
        parts: [{ instrumentId: 'fl', partIndex: 0 }]
      };
      const entryB: Entry = {
        id: 'eb',
        songId: 'song-a',
        section: 'B',
        priority: 'high',
        parts: [{ instrumentId: 'hrn', partIndex: 1 }]
      };

      const assignments: Assignment[] = [
        {
          id: '0_room-1',
          slotIndex: 0,
          roomId: 'room-1',
          entryId: 'ea',
          parts: entryA.parts,
          isLocked: false,
          isPersonalPractice: false
        },
        {
          id: '0_room-2',
          slotIndex: 0,
          roomId: 'room-2',
          entryId: 'eb',
          parts: entryB.parts,
          isLocked: false,
          isPersonalPractice: false
        }
      ];

      const { violations } = evaluateSchedule(
        assignments,
        rooms,
        STANDARD_INSTRUMENTS,
        songs,
        manualNgPairs,
        [entryA, entryB],
        1,
        true
      );

      const hasManualNgViolation = violations.some(v => v.includes('重複NG設定されているパートが同時に'));
      expect(hasManualNgViolation).toBe(true);
    });
  });

  describe('generateSchedule', () => {
    const baseState: ScheduleState = {
      timeSettings: {
        startTime: '09:00',
        endTime: '11:00', // 120 min -> (120+5)/50 = 2 slots
        slotDuration: 45,
        intervalDuration: 5
      },
      rooms: [
        { id: 'room-1', name: '第1音楽室', capacity: 10, isPersonalPracticeCandidate: true },
        { id: 'room-2', name: '第2音楽室', capacity: 10, isPersonalPracticeCandidate: true }
      ],
      instruments: STANDARD_INSTRUMENTS,
      songs: [
        {
          id: 'song-1',
          name: '宝島',
          parts: { asax: 2, trp: 2 }
        }
      ],
      duplicateNGPairs: [],
      entries: [
        {
          id: 'entry-1',
          songId: 'song-1',
          section: 'イントロ',
          priority: 'high',
          parts: [{ instrumentId: 'asax', partIndex: 0 }]
        },
        {
          id: 'entry-2',
          songId: 'song-1',
          section: 'サビ',
          priority: 'medium',
          parts: [{ instrumentId: 'trp', partIndex: 0 }]
        }
      ],
      assignments: []
    };

    it('generates assignments covering all slots and rooms', () => {
      const generated = generateSchedule(baseState);

      // 2 slots * 2 rooms = 4 assignments
      expect(generated.length).toBe(4);

      const slot0Room1 = generated.find(a => a.slotIndex === 0 && a.roomId === 'room-1');
      const slot0Room2 = generated.find(a => a.slotIndex === 0 && a.roomId === 'room-2');
      const slot1Room1 = generated.find(a => a.slotIndex === 1 && a.roomId === 'room-1');
      const slot1Room2 = generated.find(a => a.slotIndex === 1 && a.roomId === 'room-2');

      expect(slot0Room1).toBeDefined();
      expect(slot0Room2).toBeDefined();
      expect(slot1Room1).toBeDefined();
      expect(slot1Room2).toBeDefined();
    });

    it('preserves locked slots intact during generation', () => {
      const lockedAssignment: Assignment = {
        id: '0_room-1',
        slotIndex: 0,
        roomId: 'room-1',
        entryId: 'entry-1',
        parts: [{ instrumentId: 'asax', partIndex: 0, songId: 'song-1' }],
        isLocked: true,
        isPersonalPractice: false
      };

      const stateWithLock: ScheduleState = {
        ...baseState,
        assignments: [lockedAssignment]
      };

      const generated = generateSchedule(stateWithLock);

      const preserved = generated.find(a => a.slotIndex === 0 && a.roomId === 'room-1');
      expect(preserved).toBeDefined();
      expect(preserved?.isLocked).toBe(true);
      expect(preserved?.entryId).toBe('entry-1');
      expect(preserved?.parts[0].instrumentId).toBe('asax');
    });
  });
});
