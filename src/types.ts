export type InstrumentMovement = 'immovable' | 'avoid_movement' | 'movable';

export interface ScheduleViolation {
  type: 'capacity' | 'duplicate_ng' | 'immovable' | 'auto_collision' | 'missing_entry' | 'duplicate_entry' | 'personal_overflow' | 'no_personal_room' | 'movement';
  severity: 'error' | 'warning';
  message: string;
}
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

/**
 * 楽曲内の局所的な楽器パート参照（楽曲IDを含まない）。
 * 主に Entry.parts など、単一曲のスコープ内で利用されます。
 */
export interface LocalPartRef {
  instrumentId: string;
  partIndex: number; // 0-indexed (e.g. 0 = 1st, 1 = 2nd)
}

/**
 * アプリケーション全体でパートを一意に特定する大域的な参照情報。
 * 楽曲ID (songId) + 楽器ID (instrumentId) + パート番号 (partIndex) で構成されます。
 */
export interface GlobalPartRef extends LocalPartRef {
  songId: string;
}

// 既存コード・テストとの100%後方互換性のための型エイリアス
export type PartReference = GlobalPartRef;
export type SelectedPart = GlobalPartRef;

export interface DuplicateNGPair {
  id: string;
  partA: GlobalPartRef;
  partB: GlobalPartRef;
}

export interface Entry {
  id: string;
  songId: string;
  section: string; // 例: "1-20小節", "A〜C"
  parts: LocalPartRef[]; // 練習に参加するパート
  priority: 'high' | 'medium' | 'low';
}

export interface AssignmentPart extends LocalPartRef {
  songId?: string; // 曲に紐づくパートの場合
}

export interface Assignment {
  id: string; // slotIndex + "_" + roomId
  slotIndex: number;
  roomId: string;
  entryId?: string; // アサインされた練習エントリーID。空の場合は個人練習か空き部屋
  parts: AssignmentPart[];
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

// 標準楽器マスタおよび標準パート数（constants/instruments.ts から後方互換性のため再エクスポート）
export { STANDARD_INSTRUMENTS, STANDARD_PART_COUNTS } from './constants/instruments';

