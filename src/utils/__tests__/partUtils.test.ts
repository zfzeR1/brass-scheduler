import { describe, it, expect } from 'vitest';
import {
  isSameGlobalPart,
  isSameLocalPart,
  getGlobalPartKey,
  getLocalPartKey,
  toGlobalPart,
  toLocalPart
} from '../partUtils';
import type { GlobalPartRef, LocalPartRef } from '../../types';

describe('partUtils (Phase 8 Part Reference Normalization)', () => {
  const partA: GlobalPartRef = { songId: 'song-1', instrumentId: 'fl', partIndex: 0 };
  const partB: GlobalPartRef = { songId: 'song-1', instrumentId: 'fl', partIndex: 0 };
  const partDifferentSong: GlobalPartRef = { songId: 'song-2', instrumentId: 'fl', partIndex: 0 };
  const partDifferentInst: GlobalPartRef = { songId: 'song-1', instrumentId: 'cl', partIndex: 0 };
  const partDifferentIndex: GlobalPartRef = { songId: 'song-1', instrumentId: 'fl', partIndex: 1 };

  describe('isSameGlobalPart', () => {
    it('returns true when songId, instrumentId, and partIndex match', () => {
      expect(isSameGlobalPart(partA, partB)).toBe(true);
    });

    it('returns false when any field differs', () => {
      expect(isSameGlobalPart(partA, partDifferentSong)).toBe(false);
      expect(isSameGlobalPart(partA, partDifferentInst)).toBe(false);
      expect(isSameGlobalPart(partA, partDifferentIndex)).toBe(false);
    });

    it('returns false when either argument is null or undefined', () => {
      expect(isSameGlobalPart(partA, null)).toBe(false);
      expect(isSameGlobalPart(null, partA)).toBe(false);
      expect(isSameGlobalPart(undefined, undefined)).toBe(false);
    });
  });

  describe('isSameLocalPart', () => {
    const localA: LocalPartRef = { instrumentId: 'trp', partIndex: 0 };
    const localB: LocalPartRef = { instrumentId: 'trp', partIndex: 0 };
    const localDiffInst: LocalPartRef = { instrumentId: 'hrn', partIndex: 0 };
    const localDiffIndex: LocalPartRef = { instrumentId: 'trp', partIndex: 1 };

    it('returns true when instrumentId and partIndex match', () => {
      expect(isSameLocalPart(localA, localB)).toBe(true);
    });

    it('returns false when fields differ', () => {
      expect(isSameLocalPart(localA, localDiffInst)).toBe(false);
      expect(isSameLocalPart(localA, localDiffIndex)).toBe(false);
    });

    it('returns false when either argument is null or undefined', () => {
      expect(isSameLocalPart(localA, null)).toBe(false);
      expect(isSameLocalPart(undefined, localB)).toBe(false);
    });
  });

  describe('getGlobalPartKey and getLocalPartKey', () => {
    it('generates consistent unique keys for global parts', () => {
      expect(getGlobalPartKey(partA)).toBe('song-1:fl:0');
      expect(getGlobalPartKey(partDifferentSong)).toBe('song-2:fl:0');
    });

    it('generates consistent unique keys for local parts', () => {
      expect(getLocalPartKey({ instrumentId: 'euph', partIndex: 2 })).toBe('euph:2');
    });
  });

  describe('toGlobalPart and toLocalPart conversions', () => {
    it('combines songId and LocalPartRef into GlobalPartRef', () => {
      const local: LocalPartRef = { instrumentId: 'tuba', partIndex: 0 };
      const global = toGlobalPart('song-march', local);
      expect(global).toEqual({
        songId: 'song-march',
        instrumentId: 'tuba',
        partIndex: 0,
      });
    });

    it('extracts LocalPartRef from GlobalPartRef', () => {
      const local = toLocalPart(partA);
      expect(local).toEqual({
        instrumentId: 'fl',
        partIndex: 0,
      });
      expect((local as any).songId).toBeUndefined();
    });
  });
});
