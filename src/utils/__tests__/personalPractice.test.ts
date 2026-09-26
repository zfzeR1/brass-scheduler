import { describe, it, expect } from 'vitest';
import { getAvailableParts, calculateUserSchedule } from '../personalPractice';
import type { ScheduleState, Song, Room, Entry, Assignment, SelectedPart, Instrument } from '../../types';

describe('personalPractice utility', () => {
  const dummyInstruments: Instrument[] = [
    { id: 'fl', name: 'フルート', category: 'woodwind' },
    { id: 'bbcl', name: 'クラリネット', category: 'woodwind' },
    { id: 'trp', name: 'トランペット', category: 'brass' },
    { id: 'perc', name: '打楽器', category: 'percussion' }
  ];

  const dummySongs: Song[] = [
    {
      id: 'song-1',
      name: 'テスト曲1',
      parts: { fl: 2, bbcl: 1 }
    },
    {
      id: 'song-2',
      name: 'テスト曲2',
      parts: { trp: 2 }
    }
  ];

  const dummyRooms: Room[] = [
    { id: 'room-1', name: '大合奏室', capacity: 30, isPersonalPracticeCandidate: false },
    { id: 'room-2', name: '中練習室', capacity: 4, isPersonalPracticeCandidate: true },
    { id: 'room-3', name: '小練習室', capacity: 2, isPersonalPracticeCandidate: true }
  ];

  const dummyEntries: Entry[] = [
    {
      id: 'entry-1',
      songId: 'song-1',
      section: 'Intro',
      priority: 'high',
      parts: [
        { instrumentId: 'fl', partIndex: 0 },
        { instrumentId: 'bbcl', partIndex: 0 }
      ]
    }
  ];

  describe('getAvailableParts', () => {
    it('returns empty array when songs or instruments are empty or invalid', () => {
      expect(getAvailableParts([], [])).toEqual([]);
      expect(getAvailableParts(null as any, undefined as any)).toEqual([]);
    });

    it('expands all parts into flat selectable items', () => {
      const parts = getAvailableParts(dummySongs, dummyInstruments);
      // song-1: fl(2) + bbcl(1) = 3 items. song-2: trp(2) = 2 items. Total 5 items.
      expect(parts).toHaveLength(5);
      expect(parts[0]).toMatchObject({
        song: dummySongs[0],
        inst: dummyInstruments[0],
        partIndex: 0,
        key: 'song-1_fl_0'
      });
      expect(parts[1]).toMatchObject({
        song: dummySongs[0],
        inst: dummyInstruments[0],
        partIndex: 1,
        key: 'song-1_fl_1'
      });
      expect(parts[2]).toMatchObject({
        song: dummySongs[0],
        inst: dummyInstruments[1],
        partIndex: 0,
        key: 'song-1_bbcl_0'
      });
    });

    it('ignores negative or non-numeric part counts safely', () => {
      const corruptedSongs: Song[] = [
        {
          id: 'song-bad',
          name: '壊れた曲',
          parts: { fl: -1, trp: 0, bbcl: 'invalid' as any }
        }
      ];
      const parts = getAvailableParts(corruptedSongs, dummyInstruments);
      expect(parts).toEqual([]);
    });
  });

  describe('calculateUserSchedule', () => {
    const baseState: ScheduleState = {
      timeSettings: { startTime: '09:00', endTime: '12:00', slotDuration: 45, intervalDuration: 5 },
      rooms: dummyRooms,
      instruments: dummyInstruments,
      songs: dummySongs,
      duplicateNGPairs: [],
      entries: dummyEntries,
      assignments: []
    };

    it('returns empty array if no parts selected or no assignments or numSlots <= 0', () => {
      expect(calculateUserSchedule([], baseState, 3)).toEqual([]);
      expect(calculateUserSchedule([{ songId: 'song-1', instrumentId: 'fl', partIndex: 0 }], baseState, 3)).toEqual([]);
      expect(calculateUserSchedule([{ songId: 'song-1', instrumentId: 'fl', partIndex: 0 }], { ...baseState, assignments: [{ id: '1', slotIndex: 0, roomId: 'room-1', parts: [], isLocked: false, isPersonalPractice: false }] }, 0)).toEqual([]);
    });

    it('identifies section practice when user part is assigned in that slot', () => {
      const assignments: Assignment[] = [
        {
          id: 'asm-1',
          slotIndex: 0,
          roomId: 'room-1',
          entryId: 'entry-1',
          parts: [{ songId: 'song-1', instrumentId: 'fl', partIndex: 0 }],
          isLocked: false,
          isPersonalPractice: false
        }
      ];

      const state: ScheduleState = { ...baseState, assignments };
      const selectedParts: SelectedPart[] = [{ songId: 'song-1', instrumentId: 'fl', partIndex: 0 }];

      const schedule = calculateUserSchedule(selectedParts, state, 1);
      expect(schedule).toHaveLength(1);
      expect(schedule[0].slotIndex).toBe(0);
      expect(schedule[0].isPersonal).toBe(false);
      expect(schedule[0].assignment?.id).toBe('asm-1');
      expect(schedule[0].room?.id).toBe('room-1');
      expect(schedule[0].activePart).toEqual(selectedParts[0]);
    });

    it('places idle user into candidate personal practice room when not in section practice', () => {
      // In slot 0, room-1 is used for entry-1 (fl 0 and bbcl 0).
      // User is fl 1 (not in entry-1).
      // room-2 is a candidate for personal practice.
      const assignments: Assignment[] = [
        {
          id: 'asm-1',
          slotIndex: 0,
          roomId: 'room-1',
          entryId: 'entry-1',
          parts: [{ songId: 'song-1', instrumentId: 'fl', partIndex: 0 }],
          isLocked: false,
          isPersonalPractice: false
        },
        {
          id: 'asm-2',
          slotIndex: 0,
          roomId: 'room-2',
          entryId: undefined,
          parts: [{ songId: 'song-1', instrumentId: 'fl', partIndex: 1 }],
          isLocked: false,
          isPersonalPractice: true
        }
      ];

      const state: ScheduleState = { ...baseState, assignments };
      const selectedParts: SelectedPart[] = [{ songId: 'song-1', instrumentId: 'fl', partIndex: 1 }];

      const schedule = calculateUserSchedule(selectedParts, state, 1);
      expect(schedule).toHaveLength(1);
      expect(schedule[0].slotIndex).toBe(0);
      expect(schedule[0].isPersonal).toBe(true);
      expect(schedule[0].room?.id).toBe('room-2');
      expect(schedule[0].activePart).toEqual(selectedParts[0]);
    });

    it('overflows to next personal practice room when first room capacity is reached', () => {
      // room-2 capacity is 1 for this test, room-3 capacity is 2
      const roomsWithCap: Room[] = [
        { id: 'room-main', name: '大合奏室', capacity: 30, isPersonalPracticeCandidate: false },
        { id: 'room-small-1', name: '小1', capacity: 1, isPersonalPracticeCandidate: true },
        { id: 'room-small-2', name: '小2', capacity: 2, isPersonalPracticeCandidate: true }
      ];

      // Two idle parts: fl 1 and bbcl 0 (neither is in active section).
      // fl 1 fills room-small-1 (cap 1). bbcl 0 goes to room-small-2.
      const state: ScheduleState = {
        ...baseState,
        rooms: roomsWithCap,
        assignments: [
          { id: 'asm-1', slotIndex: 0, roomId: 'room-small-1', parts: [], isLocked: false, isPersonalPractice: true },
          { id: 'asm-2', slotIndex: 0, roomId: 'room-small-2', parts: [], isLocked: false, isPersonalPractice: true }
        ]
      };

      const userBbcl: SelectedPart[] = [{ songId: 'song-1', instrumentId: 'bbcl', partIndex: 0 }];
      const schedule = calculateUserSchedule(userBbcl, state, 1);

      expect(schedule[0].isPersonal).toBe(true);
      expect(schedule[0].room?.id).toBe('room-small-2');
    });

    it('handles waiting (free time) when no personal rooms are available', () => {
      // No rooms are marked as personal practice candidates
      const noCandidateRooms: Room[] = [
        { id: 'room-main', name: '大合奏室', capacity: 30, isPersonalPracticeCandidate: false }
      ];

      const state: ScheduleState = {
        ...baseState,
        rooms: noCandidateRooms,
        assignments: [
          { id: 'asm-1', slotIndex: 0, roomId: 'room-main', parts: [], isLocked: false, isPersonalPractice: false }
        ]
      };

      const selectedParts: SelectedPart[] = [{ songId: 'song-2', instrumentId: 'trp', partIndex: 0 }];
      const schedule = calculateUserSchedule(selectedParts, state, 1);

      expect(schedule[0].assignment).toBeNull();
      expect(schedule[0].room).toBeUndefined();
      expect(schedule[0].isPersonal).toBe(false);
    });

    it('gives priority to section practice over idle personal practice when user has multiple parts', () => {
      // User plays fl 0 in song-1 (which has section practice) and trp 0 in song-2 (which does not)
      const assignments: Assignment[] = [
        {
          id: 'asm-1',
          slotIndex: 0,
          roomId: 'room-1',
          entryId: 'entry-1',
          parts: [{ songId: 'song-1', instrumentId: 'fl', partIndex: 0 }],
          isLocked: false,
          isPersonalPractice: false
        }
      ];

      const state: ScheduleState = { ...baseState, assignments };
      const selectedParts: SelectedPart[] = [
        { songId: 'song-2', instrumentId: 'trp', partIndex: 0 },
        { songId: 'song-1', instrumentId: 'fl', partIndex: 0 }
      ];

      const schedule = calculateUserSchedule(selectedParts, state, 1);
      expect(schedule[0].isPersonal).toBe(false);
      expect(schedule[0].assignment?.id).toBe('asm-1');
      expect(schedule[0].room?.id).toBe('room-1');
      expect(schedule[0].activePart?.songId).toBe('song-1');
    });

    it('resiliently handles hostile/corrupted state without crashing', () => {
      const corruptedState: any = {
        songs: [{ id: 's1', parts: null }],
        entries: [{ id: 'e1', songId: 's1', parts: null }],
        rooms: [null, { id: 'r1', capacity: undefined }],
        assignments: [{ slotIndex: 0, roomId: 'r1', entryId: 'e1' }]
      };

      const selectedParts: SelectedPart[] = [{ songId: 's1', instrumentId: 'fl', partIndex: 0 }];
      expect(() => calculateUserSchedule(selectedParts, corruptedState, 1)).not.toThrow();
    });
  });
});
