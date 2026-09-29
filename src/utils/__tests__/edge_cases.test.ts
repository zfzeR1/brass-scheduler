import { describe, it, expect } from 'vitest';
import { generateSchedule } from '../scheduler';
import { loadScheduleFromShortId } from '../../hooks/useScheduleUrlLoader';
import type { ScheduleState } from '../../types';

describe('Algorithm & Loader Edge Cases', () => {
  describe('generateSchedule edge cases', () => {
    const baseState: ScheduleState = {
      timeSettings: {
        startTime: '09:00',
        endTime: '12:00',
        slotDuration: 60,
        intervalDuration: 0
      },
      rooms: [
        { id: 'r1', name: 'Room 1', capacity: 10, isPersonalPracticeCandidate: true }
      ],
      instruments: [
        { id: 'fl', name: 'Flute', movementType: 'movable' }
      ],
      songs: [
        { id: 's1', name: 'Song 1', parts: { fl: 2 } }
      ],
      duplicateNGPairs: [],
      entries: [
        {
          id: 'e1',
          songId: 's1',
          section: 'Sec 1',
          priority: 'high',
          parts: [{ instrumentId: 'fl', partIndex: 0 }]
        }
      ],
      assignments: []
    };

    it('handles 0 rooms gracefully without crashing', () => {
      const stateWithoutRooms = { ...baseState, rooms: [] };
      const result = generateSchedule(stateWithoutRooms);
      expect(result).toEqual([]);
    });

    it('handles 0 slots (invalid times) gracefully', () => {
      const stateInvalidTime = {
        ...baseState,
        timeSettings: {
          startTime: '12:00',
          endTime: '09:00',
          slotDuration: 60,
          intervalDuration: 0
        }
      };
      const result = generateSchedule(stateInvalidTime);
      expect(result).toEqual([]);
    });

    it('handles 0 entries (all rooms become personal practice or empty)', () => {
      const stateWithoutEntries = { ...baseState, entries: [] };
      const result = generateSchedule(stateWithoutEntries);
      expect(result.length).toBe(3); // 3 slots * 1 room
      // all slots should be personal practice since room is personal practice candidate
      result.forEach(asm => {
        expect(asm.isPersonalPractice).toBe(true);
        expect(asm.entryId).toBeUndefined();
      });
    });

    it('handles more entries than slots*rooms (saturation constraint)', () => {
      // 3 slots * 1 room = 3 capacity, but we have 10 entries
      const saturatedEntries = Array.from({ length: 10 }).map((_, idx) => ({
        id: `e-${idx}`,
        songId: 's1',
        section: `Sec ${idx}`,
        priority: 'medium' as const,
        parts: [{ instrumentId: 'fl', partIndex: 0 }]
      }));
      const saturatedState = { ...baseState, entries: saturatedEntries };

      const result = generateSchedule(saturatedState);
      expect(result.length).toBe(3);
      // All 3 assignments should have entries assigned
      result.forEach(asm => {
        expect(asm.entryId).toBeDefined();
      });
    });
  });

  describe('useScheduleUrlLoader edge cases', () => {
    it('handles AbortSignal abortion when loading schedule', async () => {
      const controller = new AbortController();
      controller.abort(); // already aborted

      await expect(
        loadScheduleFromShortId('abc12345', controller.signal)
      ).rejects.toThrow();
    });
  });
});
