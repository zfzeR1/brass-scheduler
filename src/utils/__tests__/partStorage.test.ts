import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SELECTED_PARTS_STORAGE_KEY,
  sanitizeSelectedParts,
  loadSavedSelectedParts,
  saveSelectedParts,
  clearSavedSelectedParts
} from '../partStorage';
import type { Song, SelectedPart } from '../../types';

class LocalStorageMock implements Storage {
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
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

describe('partStorage utility', () => {
  const sampleSongs: Song[] = [
    {
      id: 'song-disco',
      name: 'ディスコ・キッド',
      parts: { fl: 2, trp: 3, hrn: 4, perc: 3 }
    },
    {
      id: 'song-alv',
      name: 'アルヴァマー序曲',
      parts: { fl: 3, asax: 2, trb: 3 }
    }
  ];

  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    if (typeof window !== 'undefined') {
      vi.stubGlobal('window', { ...window, localStorage: mockStorage });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('sanitizeSelectedParts', () => {
    it('returns empty array when raw input is null, undefined, or not an array', () => {
      expect(sanitizeSelectedParts(null, sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts(undefined, sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts('invalid', sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts(12345, sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts({}, sampleSongs)).toEqual([]);
      expect(sanitizeSelectedParts(true, sampleSongs)).toEqual([]);
    });

    it('returns empty array when songs input is not an array', () => {
      const raw = [{ songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }];
      expect(sanitizeSelectedParts(raw, null as unknown as Song[])).toEqual([]);
      expect(sanitizeSelectedParts(raw, undefined as unknown as Song[])).toEqual([]);
      expect(sanitizeSelectedParts(raw, {} as unknown as Song[])).toEqual([]);
    });

    it('filters out malformed items in raw array', () => {
      const raw = [
        null,
        undefined,
        'string-item',
        123,
        {},
        { songId: 123, instrumentId: 'fl', partIndex: 0 },
        { songId: '', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-disco', instrumentId: 123, partIndex: 0 },
        { songId: 'song-disco', instrumentId: '', partIndex: 0 },
        { songId: 'song-disco', instrumentId: 'fl', partIndex: '0' },
        { songId: 'song-disco', instrumentId: 'fl', partIndex: -1 },
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 1.5 },
        { songId: 'song-disco', instrumentId: 'fl', partIndex: NaN },
        { songId: 'song-disco', instrumentId: 'fl', partIndex: Infinity }
      ];

      expect(sanitizeSelectedParts(raw, sampleSongs)).toEqual([]);
    });

    it('filters out parts where songId does not exist in songs', () => {
      const raw = [
        { songId: 'non-existent-song', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }
      ];

      const result = sanitizeSelectedParts(raw, sampleSongs);
      expect(result).toEqual([
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }
      ]);
    });

    it('filters out parts where instrument does not exist in song.parts', () => {
      const raw = [
        { songId: 'song-disco', instrumentId: 'ob', partIndex: 0 }, // oboe not in song-disco
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }
      ];

      const result = sanitizeSelectedParts(raw, sampleSongs);
      expect(result).toEqual([
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }
      ]);
    });

    it('filters out parts where song partCount is zero or negative', () => {
      const songsWithZeroPart: Song[] = [
        {
          id: 'song-test',
          name: 'テスト曲',
          parts: { fl: 0, trp: -1, cl: 2 }
        }
      ];

      const raw = [
        { songId: 'song-test', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-test', instrumentId: 'trp', partIndex: 0 },
        { songId: 'song-test', instrumentId: 'cl', partIndex: 0 }
      ];

      const result = sanitizeSelectedParts(raw, songsWithZeroPart);
      expect(result).toEqual([
        { songId: 'song-test', instrumentId: 'cl', partIndex: 0 }
      ]);
    });

    it('filters out parts when partIndex is greater than or equal to partCount', () => {
      // song-disco has fl: 2 (valid indices: 0, 1)
      const raw = [
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }, // valid
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 1 }, // valid
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 2 }, // invalid (>= 2)
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 5 }  // invalid (>= 2)
      ];

      const result = sanitizeSelectedParts(raw, sampleSongs);
      expect(result).toEqual([
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 1 }
      ]);
    });

    it('deduplicates identical part selections', () => {
      const raw = [
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }, // duplicate
        { songId: 'song-alv', instrumentId: 'asax', partIndex: 1 },
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }, // duplicate
        { songId: 'song-alv', instrumentId: 'asax', partIndex: 1 }  // duplicate
      ];

      const result = sanitizeSelectedParts(raw, sampleSongs);
      expect(result).toEqual([
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-alv', instrumentId: 'asax', partIndex: 1 }
      ]);
    });

    it('preserves valid multiple parts in order', () => {
      const raw: SelectedPart[] = [
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-disco', instrumentId: 'trp', partIndex: 2 },
        { songId: 'song-alv', instrumentId: 'fl', partIndex: 2 },
        { songId: 'song-alv', instrumentId: 'trb', partIndex: 0 }
      ];

      const result = sanitizeSelectedParts(raw, sampleSongs);
      expect(result).toEqual(raw);
    });
  });

  describe('loadSavedSelectedParts', () => {
    it('returns empty array when storage is empty', () => {
      const result = loadSavedSelectedParts(sampleSongs);
      expect(result).toEqual([]);
    });

    it('returns empty array when stored data is corrupted JSON', () => {
      mockStorage.setItem(SELECTED_PARTS_STORAGE_KEY, '{ invalid json string %%%');
      const result = loadSavedSelectedParts(sampleSongs);
      expect(result).toEqual([]);
    });

    it('returns empty array when stored data is not an array', () => {
      mockStorage.setItem(SELECTED_PARTS_STORAGE_KEY, JSON.stringify({ songId: 'song-disco' }));
      expect(loadSavedSelectedParts(sampleSongs)).toEqual([]);

      mockStorage.setItem(SELECTED_PARTS_STORAGE_KEY, JSON.stringify('plain text'));
      expect(loadSavedSelectedParts(sampleSongs)).toEqual([]);

      mockStorage.setItem(SELECTED_PARTS_STORAGE_KEY, JSON.stringify(12345));
      expect(loadSavedSelectedParts(sampleSongs)).toEqual([]);
    });

    it('loads and sanitizes valid stored data', () => {
      const savedParts = [
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-deleted', instrumentId: 'fl', partIndex: 0 }, // deleted song
        { songId: 'song-alv', instrumentId: 'asax', partIndex: 0 }
      ];
      mockStorage.setItem(SELECTED_PARTS_STORAGE_KEY, JSON.stringify(savedParts));

      const result = loadSavedSelectedParts(sampleSongs);
      expect(result).toEqual([
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-alv', instrumentId: 'asax', partIndex: 0 }
      ]);
    });

    it('safely catches error when storage.getItem throws', () => {
      vi.spyOn(mockStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: Access is denied');
      });

      const result = loadSavedSelectedParts(sampleSongs);
      expect(result).toEqual([]);
    });
  });

  describe('saveSelectedParts', () => {
    it('saves parts as serialized JSON under SELECTED_PARTS_STORAGE_KEY', () => {
      const parts: SelectedPart[] = [
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-alv', instrumentId: 'asax', partIndex: 1 }
      ];

      saveSelectedParts(parts);

      const stored = mockStorage.getItem(SELECTED_PARTS_STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(parts);
    });

    it('saves empty array properly', () => {
      saveSelectedParts([]);
      const stored = mockStorage.getItem(SELECTED_PARTS_STORAGE_KEY);
      expect(stored).toBe('[]');
    });

    it('safely handles non-array argument without crashing', () => {
      saveSelectedParts(null as unknown as SelectedPart[]);
      const stored = mockStorage.getItem(SELECTED_PARTS_STORAGE_KEY);
      expect(stored).toBe('[]');
    });

    it('gracefully handles QuotaExceededError without throwing', () => {
      vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => {
        saveSelectedParts([{ songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }]);
      }).not.toThrow();
    });
  });

  describe('clearSavedSelectedParts', () => {
    it('removes the stored item from localStorage', () => {
      mockStorage.setItem(SELECTED_PARTS_STORAGE_KEY, JSON.stringify([{ songId: 's1' }]));
      expect(mockStorage.getItem(SELECTED_PARTS_STORAGE_KEY)).not.toBeNull();

      clearSavedSelectedParts();
      expect(mockStorage.getItem(SELECTED_PARTS_STORAGE_KEY)).toBeNull();
    });

    it('gracefully handles storage errors on removal without throwing', () => {
      vi.spyOn(mockStorage, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(() => {
        clearSavedSelectedParts();
      }).not.toThrow();
    });
  });

  describe('Round-trip and lifecycle integration', () => {
    it('performs clean save and restore round-trip', () => {
      const parts: SelectedPart[] = [
        { songId: 'song-disco', instrumentId: 'hrn', partIndex: 3 },
        { songId: 'song-alv', instrumentId: 'trb', partIndex: 1 }
      ];

      saveSelectedParts(parts);
      const restored = loadSavedSelectedParts(sampleSongs);

      expect(restored).toEqual(parts);
    });

    it('automatically drops parts when songs are deleted in updated song list', () => {
      const parts: SelectedPart[] = [
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 },
        { songId: 'song-alv', instrumentId: 'asax', partIndex: 0 }
      ];

      saveSelectedParts(parts);

      // Admin deletes song-alv
      const songsAfterDeletion = sampleSongs.filter(s => s.id !== 'song-alv');
      const restored = loadSavedSelectedParts(songsAfterDeletion);

      expect(restored).toEqual([
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }
      ]);
    });

    it('automatically drops parts when partCount is reduced in updated song list', () => {
      const parts: SelectedPart[] = [
        { songId: 'song-disco', instrumentId: 'hrn', partIndex: 3 } // 4th Horn (0, 1, 2, 3)
      ];

      saveSelectedParts(parts);

      // Admin reduces Horn from 4 to 2 parts (valid indices: 0, 1)
      const songsWithReducedParts: Song[] = [
        {
          id: 'song-disco',
          name: 'ディスコ・キッド',
          parts: { fl: 2, trp: 3, hrn: 2, perc: 3 }
        }
      ];

      const restored = loadSavedSelectedParts(songsWithReducedParts);
      expect(restored).toEqual([]);
    });

    it('supports clearing parts and subsequently loading empty array', () => {
      const parts: SelectedPart[] = [
        { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }
      ];

      saveSelectedParts(parts);
      expect(loadSavedSelectedParts(sampleSongs)).toEqual(parts);

      saveSelectedParts([]);
      expect(loadSavedSelectedParts(sampleSongs)).toEqual([]);
    });
  });
});
