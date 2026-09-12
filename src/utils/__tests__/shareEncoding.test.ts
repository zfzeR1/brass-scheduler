import { describe, it, expect } from 'vitest';
import {
  minifyState,
  expandPayload,
  encodeScheduleData,
  decodeScheduleData,
  toBase64Url,
  fromBase64Url,
  generateShareUrl
} from '../shareEncoding';
import type { ScheduleState } from '../../types';
import { STANDARD_INSTRUMENTS } from '../../types';

describe('shareEncoding utility', () => {
  const sampleState: ScheduleState = {
    timeSettings: {
      startTime: '09:30',
      endTime: '12:30',
      slotDuration: 50,
      intervalDuration: 10
    },
    rooms: [
      { id: 'r1', name: '第1音楽室', capacity: 30, isPersonalPracticeCandidate: false },
      { id: 'r2', name: '打楽器室', capacity: 6, isPersonalPracticeCandidate: false, permanentInstrumentId: 'timp' },
      { id: 'r3', name: '個人練習室A', capacity: 4, isPersonalPracticeCandidate: true }
    ],
    instruments: STANDARD_INSTRUMENTS,
    songs: [
      {
        id: 's1',
        name: 'ディスコ・キッド',
        parts: { fl: 2, hrn: 4, trp: 3, timp: 1 }
      },
      {
        id: 's2',
        name: 'アルヴァマー序曲',
        parts: { fl: 3, asax: 2 }
      }
    ],
    duplicateNGPairs: [
      {
        id: 'ng1',
        partA: { songId: 's1', instrumentId: 'fl', partIndex: 0 },
        partB: { songId: 's2', instrumentId: 'fl', partIndex: 0 }
      }
    ],
    entries: [
      {
        id: 'e1',
        songId: 's1',
        section: 'イントロ〜A',
        priority: 'high',
        parts: [
          { instrumentId: 'fl', partIndex: 0 },
          { instrumentId: 'trp', partIndex: 0 }
        ]
      },
      {
        id: 'e2',
        songId: 's1',
        section: '打楽器ソロ',
        priority: 'medium',
        parts: [
          { instrumentId: 'timp', partIndex: 0 }
        ]
      }
    ],
    assignments: [
      {
        id: '0_r1',
        slotIndex: 0,
        roomId: 'r1',
        entryId: 'e1',
        parts: [
          { instrumentId: 'fl', partIndex: 0, songId: 's1' },
          { instrumentId: 'trp', partIndex: 0, songId: 's1' }
        ],
        isLocked: false,
        isPersonalPractice: false
      },
      {
        id: '0_r2',
        slotIndex: 0,
        roomId: 'r2',
        entryId: 'e2',
        parts: [
          { instrumentId: 'timp', partIndex: 0, songId: 's1' }
        ],
        isLocked: false,
        isPersonalPractice: false
      },
      {
        id: '0_r3',
        slotIndex: 0,
        roomId: 'r3',
        entryId: undefined,
        parts: [],
        isLocked: false,
        isPersonalPractice: true
      }
    ]
  };

  describe('minifyState and expandPayload', () => {
    it('performs a lossless round-trip on core configuration and populated assignments', () => {
      const minified = minifyState(sampleState);

      // Verify minified structure compactness
      expect(minified.t.s).toBe('09:30');
      expect(minified.t.e).toBe('12:30');
      expect(minified.r.length).toBe(sampleState.rooms.length);
      expect(minified.s.length).toBe(sampleState.songs.length);
      expect(minified.e.length).toBe(sampleState.entries.length);
      expect(minified.ng.length).toBe(sampleState.duplicateNGPairs.length);

      // Expand back
      const expanded = expandPayload(minified);

      // Validate timeSettings
      expect(expanded.timeSettings).toEqual(sampleState.timeSettings);

      // Validate rooms
      expect(expanded.rooms).toEqual(sampleState.rooms);

      // Validate songs
      expect(expanded.songs).toEqual(sampleState.songs);

      // Validate entries
      expect(expanded.entries).toEqual(sampleState.entries);

      // Validate duplicate NG pairs
      expect(expanded.duplicateNGPairs).toEqual(sampleState.duplicateNGPairs);

      // Validate assignments (non-empty / personal practice assignments preserved)
      expect(expanded.assignments.length).toBe(sampleState.assignments.length);
      expect(expanded.assignments[0].entryId).toBe('e1');
      expect(expanded.assignments[0].parts.length).toBe(2);
      expect(expanded.assignments[1].entryId).toBe('e2');
      expect(expanded.assignments[2].isPersonalPractice).toBe(true);
    });
  });

  describe('encodeScheduleData and decodeScheduleData', () => {
    it('compresses to URL-safe base64 and decompresses back accurately', () => {
      const encoded = encodeScheduleData(sampleState);

      // Verify string is URL-safe (no '+', '/', or '=')
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');

      // Decompress and verify
      const decoded = decodeScheduleData(encoded);
      expect(decoded).not.toBeNull();
      if (!decoded) return;

      expect(decoded.timeSettings).toEqual(sampleState.timeSettings);
      expect(decoded.rooms.length).toBe(sampleState.rooms.length);
      expect(decoded.songs.length).toBe(sampleState.songs.length);
      expect(decoded.entries.length).toBe(sampleState.entries.length);
      expect(decoded.duplicateNGPairs.length).toBe(sampleState.duplicateNGPairs.length);
    });

    it('returns null gracefully when passed invalid or corrupted data', () => {
      // Empty string
      expect(decodeScheduleData('')).toBeNull();

      // Completely random non-base64 string
      expect(decodeScheduleData('!!!###$$$%%%')).toBeNull();

      // Corrupted base64 payload that cannot be inflated
      expect(decodeScheduleData('AQIDBAUGBwgJCgsMDQ4PEA')).toBeNull();

      // Base64 containing valid text but not valid JSON payload
      const nonJsonBase64 = btoa('Hello World this is not JSON')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      expect(decodeScheduleData(nonJsonBase64)).toBeNull();
    });

    it('supports backward compatibility with legacy full-JSON base64 format', () => {
      // Legacy format was uncompressed btoa(JSON.stringify(ScheduleState))
      const legacyJson = JSON.stringify(sampleState);
      const legacyBase64 = btoa(unescape(encodeURIComponent(legacyJson)));

      const decoded = decodeScheduleData(legacyBase64);
      expect(decoded).not.toBeNull();
      if (!decoded) return;

      expect(decoded.timeSettings).toEqual(sampleState.timeSettings);
      expect(decoded.rooms.length).toBe(sampleState.rooms.length);
      expect(decoded.songs.length).toBe(sampleState.songs.length);
    });
  });

  describe('toBase64Url and fromBase64Url', () => {
    it('correctly transforms arbitrary byte arrays to url-safe strings and back', () => {
      const testBytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
      const urlSafe = toBase64Url(testBytes);

      expect(urlSafe).not.toContain('+');
      expect(urlSafe).not.toContain('/');
      expect(urlSafe).not.toContain('=');

      const restored = fromBase64Url(urlSafe);
      expect(Array.from(restored)).toEqual(Array.from(testBytes));
    });
  });

  describe('generateShareUrl', () => {
    it('creates a hash-based share url containing encoded schedule data', () => {
      const url = generateShareUrl(sampleState);
      expect(url).toContain('#view=member&d=');
      const hashPart = url.split('#view=member&d=')[1];
      expect(hashPart).toBeDefined();

      const decodedFromUrl = decodeScheduleData(hashPart);
      expect(decodedFromUrl).not.toBeNull();
      expect(decodedFromUrl?.timeSettings.startTime).toBe(sampleState.timeSettings.startTime);
    });
  });
});
