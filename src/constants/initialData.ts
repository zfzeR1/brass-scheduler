import type {
  ScheduleState,
  TimeSettings,
  Room,
  Song,
  DuplicateNGPair,
  Entry
} from '../types';
import {
  STANDARD_INSTRUMENTS,
  STANDARD_PART_COUNTS
} from './instruments';

export const INITIAL_TIME_SETTINGS: TimeSettings = {
  startTime: '09:00',
  endTime: '12:00',
  slotDuration: 45,
  intervalDuration: 5
};

export const INITIAL_ROOMS: Room[] = [
  { id: 'room-perc', name: '打楽器室', capacity: 6, isPersonalPracticeCandidate: true, permanentInstrumentId: 'timp' },
  { id: 'room-music', name: '音楽室', capacity: 20, isPersonalPracticeCandidate: true },
  { id: 'room-med1', name: '中練習室1', capacity: 8, isPersonalPracticeCandidate: true },
  { id: 'room-med2', name: '中練習室2', capacity: 8, isPersonalPracticeCandidate: true }
];

export const INITIAL_SONGS: Song[] = [
  {
    id: 'song-alv',
    name: 'アルヴァマー序曲',
    parts: { ...STANDARD_PART_COUNTS }
  },
  {
    id: 'song-disco',
    name: 'ディスコ・キッド',
    parts: {
      fl: 2, picc: 1, ob: 1, bsn: 1, ebcl: 1, bbcl: 3, bcl: 1,
      asax: 2, tsax: 1, bsax: 1, trp: 3, hrn: 4, trb: 3, euph: 1, tuba: 1,
      stbs: 1, timp: 1, perc: 4
    }
  }
];

export const INITIAL_NG_PAIRS: DuplicateNGPair[] = [
  {
    id: 'ng-1',
    partA: { songId: 'song-alv', instrumentId: 'perc', partIndex: 0 },
    partB: { songId: 'song-disco', instrumentId: 'perc', partIndex: 0 }
  },
  {
    id: 'ng-2',
    partA: { songId: 'song-alv', instrumentId: 'fl', partIndex: 0 },
    partB: { songId: 'song-disco', instrumentId: 'fl', partIndex: 0 }
  }
];

export const INITIAL_ENTRIES: Entry[] = [
  {
    id: 'entry-1',
    songId: 'song-alv',
    section: '冒頭〜A (1-24小節)',
    priority: 'high',
    parts: [
      { instrumentId: 'fl', partIndex: 0 },
      { instrumentId: 'fl', partIndex: 1 },
      { instrumentId: 'picc', partIndex: 0 },
      { instrumentId: 'ob', partIndex: 0 },
      { instrumentId: 'bbcl', partIndex: 0 },
      { instrumentId: 'bbcl', partIndex: 1 },
      { instrumentId: 'hrn', partIndex: 0 },
      { instrumentId: 'hrn', partIndex: 1 },
      { instrumentId: 'perc', partIndex: 0 },
      { instrumentId: 'perc', partIndex: 1 }
    ]
  },
  {
    id: 'entry-2',
    songId: 'song-alv',
    section: 'C〜D (45-68小節)',
    priority: 'high',
    parts: [
      { instrumentId: 'trp', partIndex: 0 },
      { instrumentId: 'trp', partIndex: 1 },
      { instrumentId: 'trp', partIndex: 2 },
      { instrumentId: 'trb', partIndex: 0 },
      { instrumentId: 'trb', partIndex: 1 },
      { instrumentId: 'trb', partIndex: 2 },
      { instrumentId: 'euph', partIndex: 0 },
      { instrumentId: 'tuba', partIndex: 0 }
    ]
  },
  {
    id: 'entry-3',
    songId: 'song-disco',
    section: 'A〜B (17-32小節)',
    priority: 'medium',
    parts: [
      { instrumentId: 'fl', partIndex: 0 },
      { instrumentId: 'asax', partIndex: 0 },
      { instrumentId: 'asax', partIndex: 1 },
      { instrumentId: 'trp', partIndex: 0 },
      { instrumentId: 'trp', partIndex: 1 },
      { instrumentId: 'perc', partIndex: 0 },
      { instrumentId: 'perc', partIndex: 1 },
      { instrumentId: 'perc', partIndex: 2 }
    ]
  },
  {
    id: 'entry-4',
    songId: 'song-disco',
    section: '中間部 (C〜D)',
    priority: 'medium',
    parts: [
      { instrumentId: 'hrn', partIndex: 0 },
      { instrumentId: 'hrn', partIndex: 1 },
      { instrumentId: 'trb', partIndex: 0 },
      { instrumentId: 'trb', partIndex: 1 },
      { instrumentId: 'tuba', partIndex: 0 }
    ]
  }
];

export function createDefaultScheduleState(): ScheduleState {
  return {
    timeSettings: INITIAL_TIME_SETTINGS,
    rooms: INITIAL_ROOMS,
    instruments: STANDARD_INSTRUMENTS,
    songs: INITIAL_SONGS,
    duplicateNGPairs: INITIAL_NG_PAIRS,
    entries: INITIAL_ENTRIES,
    assignments: []
  };
}
