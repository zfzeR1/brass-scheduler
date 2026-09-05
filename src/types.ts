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
