import { useCallback } from 'react';
import type { ScheduleState, Assignment } from '../types';

type SetAssignmentsWithHistory = (updater: Assignment[] | ((prev: Assignment[]) => Assignment[])) => void;

export const makeAssignmentId = (slotIndex: number, roomId: string): string => `${slotIndex}_${roomId}`;

export function useAssignmentActions(state: ScheduleState, setAssignmentsWithHistory: SetAssignmentsWithHistory) {
  const toggleLock = useCallback((slotIndex: number, roomId: string) => {
    setAssignmentsWithHistory(prev => {
      const updated = prev.map(asm => {
        if (asm.slotIndex === slotIndex && asm.roomId === roomId) {
          return { ...asm, isLocked: !asm.isLocked };
        }
        return asm;
      });
      return updated;
    });
  }, [setAssignmentsWithHistory]);

  const handleSwapAssignments = useCallback((srcSlotIndex: number, srcRoomId: string, destSlotIndex: number, destRoomId: string) => {
    if (srcSlotIndex === destSlotIndex && srcRoomId === destRoomId) return;

    setAssignmentsWithHistory(prev => {
      const updated = [...prev];
      let srcIdx = updated.findIndex(
        asm => asm.slotIndex === srcSlotIndex && asm.roomId === srcRoomId
      );
      let destIdx = updated.findIndex(
        asm => asm.slotIndex === destSlotIndex && asm.roomId === destRoomId
      );

      if (srcIdx === -1) {
        updated.push({
          id: makeAssignmentId(srcSlotIndex, srcRoomId),
          slotIndex: srcSlotIndex,
          roomId: srcRoomId,
          entryId: undefined,
          parts: [],
          isLocked: false,
          isPersonalPractice: false
        });
        srcIdx = updated.length - 1;
      }
      if (destIdx === -1) {
        updated.push({
          id: makeAssignmentId(destSlotIndex, destRoomId),
          slotIndex: destSlotIndex,
          roomId: destRoomId,
          entryId: undefined,
          parts: [],
          isLocked: false,
          isPersonalPractice: false
        });
        destIdx = updated.length - 1;
      }

      const srcAsm = { ...updated[srcIdx] };
      const destAsm = { ...updated[destIdx] };

      updated[srcIdx] = {
        ...srcAsm,
        entryId: destAsm.entryId,
        parts: destAsm.parts,
        isPersonalPractice: destAsm.isPersonalPractice
      };

      updated[destIdx] = {
        ...destAsm,
        entryId: srcAsm.entryId,
        parts: srcAsm.parts,
        isPersonalPractice: srcAsm.isPersonalPractice
      };

      return updated;
    });
  }, [setAssignmentsWithHistory]);

  const handleAssignEntry = useCallback((slotIndex: number, roomId: string, entryId: string) => {
    const entry = state.entries.find(e => e.id === entryId);
    if (!entry) return;
    setAssignmentsWithHistory(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(a => a.slotIndex === slotIndex && a.roomId === roomId);
      const newAsm: Assignment = {
        id: makeAssignmentId(slotIndex, roomId),
        slotIndex,
        roomId,
        entryId: entry.id,
        isPersonalPractice: false,
        isLocked: idx !== -1 ? updated[idx].isLocked : false,
        parts: entry.parts.map(p => ({
          songId: entry.songId,
          instrumentId: p.instrumentId,
          partIndex: p.partIndex
        }))
      };
      if (idx !== -1) {
        updated[idx] = newAsm;
      } else {
        updated.push(newAsm);
      }
      return updated;
    });
  }, [state.entries, setAssignmentsWithHistory]);

  const handleSetPersonalPractice = useCallback((slotIndex: number, roomId: string) => {
    setAssignmentsWithHistory(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(a => a.slotIndex === slotIndex && a.roomId === roomId);
      const newAsm: Assignment = {
        id: makeAssignmentId(slotIndex, roomId),
        slotIndex,
        roomId,
        entryId: undefined,
        isPersonalPractice: true,
        isLocked: idx !== -1 ? updated[idx].isLocked : false,
        parts: []
      };
      if (idx !== -1) {
        updated[idx] = newAsm;
      } else {
        updated.push(newAsm);
      }
      return updated;
    });
  }, [setAssignmentsWithHistory]);

  const handleSetEmpty = useCallback((slotIndex: number, roomId: string) => {
    setAssignmentsWithHistory(prev => {
      const updated = [...prev];
      const idx = updated.findIndex(a => a.slotIndex === slotIndex && a.roomId === roomId);
      const newAsm: Assignment = {
        id: makeAssignmentId(slotIndex, roomId),
        slotIndex,
        roomId,
        entryId: undefined,
        isPersonalPractice: false,
        isLocked: false,
        parts: []
      };
      if (idx !== -1) {
        updated[idx] = newAsm;
      } else {
        updated.push(newAsm);
      }
      return updated;
    });
  }, [setAssignmentsWithHistory]);

  return {
    toggleLock,
    handleSwapAssignments,
    handleAssignEntry,
    handleSetPersonalPractice,
    handleSetEmpty
  };
}
