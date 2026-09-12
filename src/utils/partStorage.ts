import type { SelectedPart, Song } from '../types';

export const SELECTED_PARTS_STORAGE_KEY = 'brass_scheduler_selected_parts_v1';

/**
 * Safely retrieves localStorage if available in the execution environment.
 * Guards against SSR / Node environments and SecurityError (e.g. sandboxed iframes or private mode).
 */
function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Sanitizes an unknown input into a valid, deduplicated array of SelectedPart objects
 * verified against the active list of songs and their part counts.
 */
export function sanitizeSelectedParts(raw: unknown, songs: Song[]): SelectedPart[] {
  if (!Array.isArray(raw) || !Array.isArray(songs)) {
    return [];
  }

  const result: SelectedPart[] = [];
  const seenKeys = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const { songId, instrumentId, partIndex } = item as Partial<SelectedPart>;

    if (typeof songId !== 'string' || songId.trim() === '') {
      continue;
    }
    if (typeof instrumentId !== 'string' || instrumentId.trim() === '') {
      continue;
    }
    if (typeof partIndex !== 'number' || !Number.isInteger(partIndex) || partIndex < 0) {
      continue;
    }

    // 1. Check song existence
    const song = songs.find(s => s.id === songId);
    if (!song || !song.parts || typeof song.parts !== 'object') {
      continue;
    }

    // 2. Check instrument exists in song and has partCount > 0
    if (!Object.prototype.hasOwnProperty.call(song.parts, instrumentId)) {
      continue;
    }
    const partCount = song.parts[instrumentId];
    if (typeof partCount !== 'number' || !Number.isInteger(partCount) || partCount <= 0) {
      continue;
    }

    // 3. Check bounds: 0 <= partIndex < partCount
    if (partIndex >= partCount) {
      continue;
    }

    // 4. Deduplicate identical selections
    const key = `${songId}___${instrumentId}___${partIndex}`;
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    result.push({
      songId,
      instrumentId,
      partIndex
    });
  }

  return result;
}

/**
 * Safely loads and sanitizes saved selected parts from localStorage.
 * Returns an empty array if storage is empty, corrupted, or unavailable.
 */
export function loadSavedSelectedParts(songs: Song[]): SelectedPart[] {
  try {
    const storage = getStorage();
    if (!storage) {
      return [];
    }
    const rawJson = storage.getItem(SELECTED_PARTS_STORAGE_KEY);
    if (!rawJson) {
      return [];
    }
    const parsed: unknown = JSON.parse(rawJson);
    return sanitizeSelectedParts(parsed, songs);
  } catch {
    return [];
  }
}

/**
 * Safely persists selected parts to localStorage.
 * Gracefully handles QuotaExceededError or environments where storage is unavailable.
 */
export function saveSelectedParts(parts: SelectedPart[]): void {
  try {
    const storage = getStorage();
    if (!storage) {
      return;
    }
    const safeParts = Array.isArray(parts) ? parts : [];
    storage.setItem(SELECTED_PARTS_STORAGE_KEY, JSON.stringify(safeParts));
  } catch {
    // Graceful error handling (e.g. QuotaExceededError, SecurityError)
  }
}

/**
 * Safely clears persisted selected parts from localStorage.
 */
export function clearSavedSelectedParts(): void {
  try {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(SELECTED_PARTS_STORAGE_KEY);
    }
  } catch {
    // Graceful error handling
  }
}
