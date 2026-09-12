export type InstrumentMovement = 'immovable' | 'avoid_movement' | 'movable';

export interface TimeSettings {
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  slotDuration: number; // コマ時間 (分)
  intervalDuration: number; // 移動インターバル時間 (分)
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  isPersonalPracticeCandidate: boolean;
  permanentInstrumentId?: string; // 常設される「移動不可」楽器のID
}

export interface Instrument {
  id: string;
  name: string;
  movementType: InstrumentMovement;
}

export interface Song {
  id: string;
  name: string;
  parts: { [instrumentId: string]: number }; // 楽器ID -> パート数 (例: { "hrn": 4 })
}

export interface PartReference {
  songId: string;
  instrumentId: string;
  partIndex: number; // 0-indexed (e.g. 0 = 1st, 1 = 2nd)
}

export interface SelectedPart {
  songId: string;
  instrumentId: string;
  partIndex: number;
}

export interface DuplicateNGPair {
  id: string;
  partA: PartReference;
  partB: PartReference;
}

export interface Entry {
  id: string;
  songId: string;
  section: string; // 例: "1-20小節", "A〜C"
  parts: Array<{ instrumentId: string; partIndex: number }>; // 練習に参加するパート
  priority: 'high' | 'medium' | 'low';
}

export interface Assignment {
  id: string; // slotIndex + "_" + roomId
  slotIndex: number;
  roomId: string;
  entryId?: string; // アサインされた練習エントリーID。空の場合は個人練習か空き部屋
  parts: Array<{
    instrumentId: string;
    partIndex: number;
    songId?: string; // 曲に紐づくパートの場合
  }>;
  isLocked: boolean; // スケジュール自動生成時にこの枠を固定するか
  isPersonalPractice: boolean; // 個人練習部屋枠かどうか
}

export interface ScheduleState {
  timeSettings: TimeSettings;
  rooms: Room[];
  instruments: Instrument[];
  songs: Song[];
  duplicateNGPairs: DuplicateNGPair[];
  entries: Entry[];
  assignments: Assignment[];
}

// 標準登録する全19楽器（吹奏楽大編成・スコア順）
export const STANDARD_INSTRUMENTS: Instrument[] = [
  // 木管
  { id: 'fl', name: 'Fl.', movementType: 'movable' },
  { id: 'picc', name: 'Picc.', movementType: 'movable' },
  { id: 'ob', name: 'Ob.', movementType: 'movable' },
  { id: 'bsn', name: 'Bsn.', movementType: 'movable' },
  { id: 'ebcl', name: 'E♭ Cl.', movementType: 'movable' },
  { id: 'bbcl', name: 'B♭ Cl.', movementType: 'movable' },
  { id: 'acl', name: 'A.Cl.', movementType: 'movable' },
  { id: 'bcl', name: 'B.Cl.', movementType: 'movable' },
  { id: 'asax', name: 'A.Sax.', movementType: 'movable' },
  { id: 'tsax', name: 'T.Sax.', movementType: 'movable' },
  { id: 'bsax', name: 'B.Sax.', movementType: 'movable' },
  // 金管
  { id: 'trp', name: 'Trp.', movementType: 'movable' },
  { id: 'hrn', name: 'Hrn.', movementType: 'movable' },
  { id: 'trb', name: 'Trb.', movementType: 'movable' },
  { id: 'euph', name: 'Euph.', movementType: 'movable' },
  { id: 'tuba', name: 'Tuba', movementType: 'avoid_movement' },
  // 弦
  { id: 'stbs', name: 'St.Bs.', movementType: 'avoid_movement' },
  // 打楽器
  { id: 'timp', name: 'Timp.', movementType: 'immovable' },
  { id: 'perc', name: 'Perc.', movementType: 'avoid_movement' }
];

// 標準パート数マップ (新規曲追加時のデフォルト値)
export const STANDARD_PART_COUNTS: Record<string, number> = {
  fl: 2,
  picc: 1,
  ob: 2,
  bsn: 2,
  ebcl: 1,
  bbcl: 3,
  acl: 1,
  bcl: 1,
  asax: 2,
  tsax: 1,
  bsax: 1,
  trp: 3,
  hrn: 4,
  trb: 3,
  euph: 1,
  tuba: 1,
  stbs: 1,
  timp: 1,
  perc: 4
};
