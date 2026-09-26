import type {
  ScheduleState,
  Song,
  Entry,
  DuplicateNGPair,
  Assignment,
  PartReference
} from '../types';

/**
 * Validates whether a specific part reference exists within the registered songs.
 */
export function isPartReferenceValid(
  part: PartReference,
  songMap: Map<string, Song>
): boolean {
  if (!part || !part.songId || !part.instrumentId) return false;
  const song = songMap.get(part.songId);
  if (!song || !song.parts) return false;
  const maxCount = song.parts[part.instrumentId];
  if (typeof maxCount !== 'number' || maxCount <= 0) return false;
  return part.partIndex >= 0 && part.partIndex < maxCount;
}

/**
 * Cascading removal of a room.
 * Removes the room from `rooms` and purges any assignments associated with that room ID.
 */
export function removeRoomWithCascade(
  state: ScheduleState,
  roomId: string
): ScheduleState {
  const nextRooms = state.rooms.filter(r => r.id !== roomId);
  const nextAssignments = state.assignments.filter(asm => asm.roomId !== roomId);

  return {
    ...state,
    rooms: nextRooms,
    assignments: nextAssignments
  };
}

/**
 * Cascading removal of a song.
 * Removes the song and automatically purges:
 * - Any entries (`entries`) associated with that song
 * - Any duplicate NG pairs (`duplicateNGPairs`) referencing that song in partA or partB
 * - Resets any assignments in `assignments` that were assigned to those entries
 */
export function removeSongWithCascade(
  state: ScheduleState,
  songId: string
): ScheduleState {
  const nextSongs = state.songs.filter(s => s.id !== songId);

  // Identify all entry IDs that belong to the deleted song
  const removedEntryIds = new Set<string>();
  for (const entry of state.entries) {
    if (entry.songId === songId) {
      removedEntryIds.add(entry.id);
    }
  }

  // Remove entries belonging to the deleted song
  const nextEntries = state.entries.filter(e => e.songId !== songId);

  // Remove NG pairs that reference the deleted song
  const nextNGPairs = state.duplicateNGPairs.filter(
    p => p.partA.songId !== songId && p.partB.songId !== songId
  );

  // Clear assignments that were pointing to the removed entries
  const nextAssignments = state.assignments.map(asm => {
    const referencesDeletedEntry = asm.entryId && removedEntryIds.has(asm.entryId);
    const referencesDeletedSongPart = asm.parts.some(p => p.songId === songId);

    if (referencesDeletedEntry || referencesDeletedSongPart) {
      return {
        ...asm,
        entryId: undefined,
        parts: [],
        isLocked: false,
        isPersonalPractice: false
      };
    }
    return asm;
  });

  return {
    ...state,
    songs: nextSongs,
    entries: nextEntries,
    duplicateNGPairs: nextNGPairs,
    assignments: nextAssignments
  };
}

/**
 * Cascading removal of a section entry.
 * Removes the entry from `entries` and clears any assignments referencing that entry ID.
 */
export function removeEntryWithCascade(
  state: ScheduleState,
  entryId: string
): ScheduleState {
  const nextEntries = state.entries.filter(e => e.id !== entryId);

  const nextAssignments = state.assignments.map(asm => {
    if (asm.entryId === entryId) {
      return {
        ...asm,
        entryId: undefined,
        parts: [],
        isLocked: false,
        isPersonalPractice: false
      };
    }
    return asm;
  });

  return {
    ...state,
    entries: nextEntries,
    assignments: nextAssignments
  };
}

/**
 * Cascading removal of a duplicate NG pair.
 */
export function removeNGPairWithCascade(
  state: ScheduleState,
  pairId: string
): ScheduleState {
  return {
    ...state,
    duplicateNGPairs: state.duplicateNGPairs.filter(p => p.id !== pairId)
  };
}

/**
 * Pure sanitizer that comprehensively validates referential integrity across the entire ScheduleState.
 * Useful when loading state from localStorage or decoded URLs, or after updating song part counts.
 * 
 * Rules:
 * 1. Entries referencing non-existent songs are removed.
 * 2. Parts in entries referencing out-of-bounds instrument part indexes are stripped.
 * 3. Duplicate NG pairs referencing non-existent songs or out-of-bounds parts are removed.
 * 4. Assignments referencing non-existent rooms are purged.
 * 5. Assignments referencing non-existent entries are reset to empty cells.
 */
export function sanitizeScheduleState(state: ScheduleState): ScheduleState {
  if (!state) return state;

  const validRoomIds = new Set((state.rooms || []).map(r => r.id));
  const songMap = new Map<string, Song>((state.songs || []).map(s => [s.id, s]));

  // 1 & 2: Sanitize entries
  const sanitizedEntries: Entry[] = [];
  for (const entry of state.entries || []) {
    if (!songMap.has(entry.songId)) continue;

    const song = songMap.get(entry.songId)!;
    const validParts = (entry.parts || []).filter(p => {
      const maxCount = song.parts?.[p.instrumentId];
      return typeof maxCount === 'number' && maxCount > 0 && p.partIndex >= 0 && p.partIndex < maxCount;
    });

    sanitizedEntries.push({
      ...entry,
      parts: validParts
    });
  }

  const validEntryIds = new Set(sanitizedEntries.map(e => e.id));

  // 3: Sanitize NG pairs
  const sanitizedNGPairs: DuplicateNGPair[] = (state.duplicateNGPairs || []).filter(pair => {
    return (
      isPartReferenceValid(pair.partA, songMap) &&
      isPartReferenceValid(pair.partB, songMap)
    );
  });

  // 4 & 5: Sanitize assignments
  const sanitizedAssignments: Assignment[] = (state.assignments || [])
    .filter(asm => validRoomIds.has(asm.roomId))
    .map(asm => {
      // If assignment has an entryId that is no longer valid, reset it
      if (asm.entryId && !validEntryIds.has(asm.entryId)) {
        return {
          ...asm,
          entryId: undefined,
          parts: [],
          isLocked: false,
          isPersonalPractice: false
        };
      }

      // If parts reference an invalid song or out-of-bounds part, sanitize them
      if (asm.parts && asm.parts.length > 0) {
        const sanitizedParts = asm.parts.filter(p => {
          if (!p.songId) return true; // generic part without songId
          const song = songMap.get(p.songId);
          if (!song || !song.parts) return false;
          const maxCount = song.parts[p.instrumentId];
          return typeof maxCount === 'number' && maxCount > 0 && p.partIndex >= 0 && p.partIndex < maxCount;
        });

        if (sanitizedParts.length !== asm.parts.length) {
          return {
            ...asm,
            parts: sanitizedParts
          };
        }
      }

      return asm;
    });

  return {
    ...state,
    entries: sanitizedEntries,
    duplicateNGPairs: sanitizedNGPairs,
    assignments: sanitizedAssignments
  };
}
