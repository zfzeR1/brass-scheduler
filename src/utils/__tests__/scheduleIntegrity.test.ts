import { describe, it, expect } from 'vitest';
import type { ScheduleState, Room, Song, Entry, DuplicateNGPair, Assignment } from '../../types';
import {
  isPartReferenceValid,
  removeRoomWithCascade,
  removeSongWithCascade,
  removeEntryWithCascade,
  removeNGPairWithCascade,
  sanitizeScheduleState
} from '../scheduleIntegrity';

describe('scheduleIntegrity utility functions', () => {
  const mockRooms: Room[] = [
    { id: 'room-1', name: '大練習室', capacity: 20, isPersonalPracticeCandidate: true },
    { id: 'room-2', name: '小練習室', capacity: 5, isPersonalPracticeCandidate: true }
  ];

  const mockSongs: Song[] = [
    {
      id: 'song-a',
      name: 'アルヴァマー序曲',
      parts: { fl: 2, cl: 3, trp: 2 }
    },
    {
      id: 'song-b',
      name: 'ディスコ・キッド',
      parts: { fl: 1, cl: 2, sax: 2 }
    }
  ];

  const mockEntries: Entry[] = [
    {
      id: 'entry-1',
      songId: 'song-a',
      section: 'Intro',
      priority: 'high',
      parts: [
        { instrumentId: 'fl', partIndex: 0 },
        { instrumentId: 'cl', partIndex: 1 }
      ]
    },
    {
      id: 'entry-2',
      songId: 'song-b',
      section: 'A-B',
      priority: 'medium',
      parts: [
        { instrumentId: 'fl', partIndex: 0 },
        { instrumentId: 'sax', partIndex: 0 }
      ]
    }
  ];

  const mockNGPairs: DuplicateNGPair[] = [
    {
      id: 'ng-1',
      partA: { songId: 'song-a', instrumentId: 'fl', partIndex: 0 },
      partB: { songId: 'song-b', instrumentId: 'fl', partIndex: 0 }
    }
  ];

  const mockAssignments: Assignment[] = [
    {
      id: '0_room-1',
      slotIndex: 0,
      roomId: 'room-1',
      entryId: 'entry-1',
      parts: [{ songId: 'song-a', instrumentId: 'fl', partIndex: 0 }],
      isLocked: true,
      isPersonalPractice: false
    },
    {
      id: '0_room-2',
      slotIndex: 0,
      roomId: 'room-2',
      entryId: 'entry-2',
      parts: [{ songId: 'song-b', instrumentId: 'fl', partIndex: 0 }],
      isLocked: false,
      isPersonalPractice: false
    }
  ];

  const createBaseState = (): ScheduleState => ({
    timeSettings: { startTime: '09:00', endTime: '12:00', slotDuration: 45, intervalDuration: 5 },
    rooms: [...mockRooms],
    instruments: [
      { id: 'fl', name: 'Flute', movementType: 'movable' },
      { id: 'cl', name: 'Clarinet', movementType: 'movable' },
      { id: 'trp', name: 'Trumpet', movementType: 'movable' },
      { id: 'sax', name: 'Saxophone', movementType: 'movable' }
    ],
    songs: [...mockSongs],
    entries: [...mockEntries],
    duplicateNGPairs: [...mockNGPairs],
    assignments: [...mockAssignments]
  });

  describe('isPartReferenceValid', () => {
    const songMap = new Map<string, Song>(mockSongs.map(s => [s.id, s]));

    it('returns true for an existing song and within-bounds part index', () => {
      expect(isPartReferenceValid({ songId: 'song-a', instrumentId: 'fl', partIndex: 0 }, songMap)).toBe(true);
      expect(isPartReferenceValid({ songId: 'song-a', instrumentId: 'cl', partIndex: 2 }, songMap)).toBe(true);
    });

    it('returns false for out-of-bounds part index', () => {
      // song-a only has 2 flutes (index 0, 1)
      expect(isPartReferenceValid({ songId: 'song-a', instrumentId: 'fl', partIndex: 2 }, songMap)).toBe(false);
      expect(isPartReferenceValid({ songId: 'song-a', instrumentId: 'fl', partIndex: -1 }, songMap)).toBe(false);
    });

    it('returns false for non-existing song or instrument', () => {
      expect(isPartReferenceValid({ songId: 'non-existing', instrumentId: 'fl', partIndex: 0 }, songMap)).toBe(false);
      expect(isPartReferenceValid({ songId: 'song-a', instrumentId: 'oboe', partIndex: 0 }, songMap)).toBe(false);
    });
  });

  describe('removeRoomWithCascade', () => {
    it('removes the room and purges assignments of that room', () => {
      const state = createBaseState();
      const updated = removeRoomWithCascade(state, 'room-1');

      expect(updated.rooms.some(r => r.id === 'room-1')).toBe(false);
      expect(updated.rooms).toHaveLength(1);
      expect(updated.assignments.some(a => a.roomId === 'room-1')).toBe(false);
      expect(updated.assignments).toHaveLength(1);
      expect(updated.assignments[0].roomId).toBe('room-2');
    });

    it('returns unchanged state if room ID does not exist', () => {
      const state = createBaseState();
      const updated = removeRoomWithCascade(state, 'non-existent');

      expect(updated.rooms).toHaveLength(2);
      expect(updated.assignments).toHaveLength(2);
    });
  });

  describe('removeSongWithCascade', () => {
    it('cascades deletion to entries, NG pairs, and resets affected assignments', () => {
      const state = createBaseState();
      const updated = removeSongWithCascade(state, 'song-a');

      // 1. Song is removed
      expect(updated.songs.some(s => s.id === 'song-a')).toBe(false);
      expect(updated.songs).toHaveLength(1);

      // 2. Entries belonging to song-a are removed
      expect(updated.entries.some(e => e.songId === 'song-a')).toBe(false);
      expect(updated.entries).toHaveLength(1);
      expect(updated.entries[0].id).toBe('entry-2');

      // 3. NG pairs referencing song-a are removed
      expect(updated.duplicateNGPairs.some(p => p.partA.songId === 'song-a' || p.partB.songId === 'song-a')).toBe(false);
      expect(updated.duplicateNGPairs).toHaveLength(0);

      // 4. Assignment for entry-1 is reset to empty cell (locked flag cleared)
      const asm1 = updated.assignments.find(a => a.roomId === 'room-1');
      expect(asm1?.entryId).toBeUndefined();
      expect(asm1?.parts).toHaveLength(0);
      expect(asm1?.isLocked).toBe(false);

      // 5. Assignment for entry-2 (song-b) is preserved
      const asm2 = updated.assignments.find(a => a.roomId === 'room-2');
      expect(asm2?.entryId).toBe('entry-2');
    });
  });

  describe('removeEntryWithCascade', () => {
    it('removes entry and resets any assignments referencing it', () => {
      const state = createBaseState();
      const updated = removeEntryWithCascade(state, 'entry-1');

      expect(updated.entries.some(e => e.id === 'entry-1')).toBe(false);
      expect(updated.entries).toHaveLength(1);

      const asm1 = updated.assignments.find(a => a.roomId === 'room-1');
      expect(asm1?.entryId).toBeUndefined();
      expect(asm1?.parts).toHaveLength(0);
      expect(asm1?.isLocked).toBe(false);
    });
  });

  describe('removeNGPairWithCascade', () => {
    it('removes the specific NG pair without altering other state', () => {
      const state = createBaseState();
      const updated = removeNGPairWithCascade(state, 'ng-1');

      expect(updated.duplicateNGPairs).toHaveLength(0);
      expect(updated.entries).toHaveLength(2);
      expect(updated.rooms).toHaveLength(2);
    });
  });

  describe('sanitizeScheduleState', () => {
    it('purges orphaned entries, invalid parts, broken NG pairs, and stale assignments', () => {
      const base = createBaseState();

      // Introduce corrupted references
      const corruptedState: ScheduleState = {
        ...base,
        // Entry referencing a deleted song
        entries: [
          ...base.entries,
          {
            id: 'corrupted-entry',
            songId: 'deleted-song',
            section: 'Ghost',
            priority: 'low',
            parts: [{ instrumentId: 'fl', partIndex: 0 }]
          },
          // Entry with out-of-bounds part index (song-a flute index 99)
          {
            id: 'entry-oob',
            songId: 'song-a',
            section: 'OOB Parts',
            priority: 'medium',
            parts: [
              { instrumentId: 'fl', partIndex: 0 }, // valid
              { instrumentId: 'fl', partIndex: 99 } // invalid!
            ]
          }
        ],
        // NG pair referencing non-existent song
        duplicateNGPairs: [
          ...base.duplicateNGPairs,
          {
            id: 'ng-broken',
            partA: { songId: 'ghost-song', instrumentId: 'fl', partIndex: 0 },
            partB: { songId: 'song-a', instrumentId: 'fl', partIndex: 0 }
          }
        ],
        // Assignment referencing non-existent room and non-existent entry
        assignments: [
          ...base.assignments,
          {
            id: '0_ghost-room',
            slotIndex: 0,
            roomId: 'ghost-room',
            entryId: 'entry-1',
            parts: [],
            isLocked: false,
            isPersonalPractice: false
          },
          {
            id: '1_room-1',
            slotIndex: 1,
            roomId: 'room-1',
            entryId: 'ghost-entry',
            parts: [],
            isLocked: true,
            isPersonalPractice: false
          }
        ]
      };

      const sanitized = sanitizeScheduleState(corruptedState);

      // 1. Ghost entry is filtered out
      expect(sanitized.entries.some(e => e.id === 'corrupted-entry')).toBe(false);

      // 2. Out-of-bounds part in entry-oob is stripped out, leaving only valid part
      const oobEntry = sanitized.entries.find(e => e.id === 'entry-oob');
      expect(oobEntry).toBeDefined();
      expect(oobEntry?.parts).toHaveLength(1);
      expect(oobEntry?.parts[0].partIndex).toBe(0);

      // 3. Broken NG pair is removed
      expect(sanitized.duplicateNGPairs.some(p => p.id === 'ng-broken')).toBe(false);

      // 4. Ghost room assignment is purged
      expect(sanitized.assignments.some(a => a.roomId === 'ghost-room')).toBe(false);

      // 5. Assignment pointing to ghost entry has its entryId cleared and lock reset
      const asmStale = sanitized.assignments.find(a => a.slotIndex === 1 && a.roomId === 'room-1');
      expect(asmStale?.entryId).toBeUndefined();
      expect(asmStale?.isLocked).toBe(false);
    });

    it('safely handles empty or missing arrays without crashing', () => {
      const emptyState = {} as unknown as ScheduleState;
      const result = sanitizeScheduleState(emptyState);
      expect(result).toBeDefined();
      expect(result.entries).toEqual([]);
      expect(result.duplicateNGPairs).toEqual([]);
      expect(result.assignments).toEqual([]);
    });
  });
});
