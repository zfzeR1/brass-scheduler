import type {
  Room,
  Instrument,
  Song,
  DuplicateNGPair,
  Entry,
  Assignment,
  ScheduleViolation
} from '../types';
import { packPersonalPracticeRooms } from './personalPracticePacking';

interface ActivePartInfo {
  key: string;
  songId: string;
  instrumentId: string;
  partIndex: number;
  roomId: string;
}

export interface EvaluationContext {
  rooms: Room[];
  instruments: Instrument[];
  songs: Song[];
  duplicateNGPairs: DuplicateNGPair[];
  entries: Entry[];
  numSlots: number;
  instrumentMap: Map<string, Instrument>;
  entryMap: Map<string, Entry>;
  roomMap: Map<string, Room>;
  ngSet: Set<string>;
  allPartsList: Array<{ songId: string; instrumentId: string; partIndex: number }>;
  _slotsAssignments: Assignment[][];
  _entryUsageCount: Map<string, number>;
  _partRoomsBySlot: Map<string, string>[];
  _assignedRoomIds: Set<string>;
  _activePartsInSlot: Set<string>;
  _activePartsInfo: ActivePartInfo[];
}

/**
 * スケジュール評価に必要なマスターデータとルックアップマップを事前構築します。
 */
export function createEvaluationContext(
  rooms: Room[],
  instruments: Instrument[],
  songs: Song[],
  duplicateNGPairs: DuplicateNGPair[],
  entries: Entry[],
  numSlots: number
): EvaluationContext {
  const instrumentMap = new Map<string, Instrument>(instruments.map(i => [i.id, i]));
  const entryMap = new Map<string, Entry>(entries.map(e => [e.id, e]));
  const roomMap = new Map<string, Room>(rooms.map(r => [r.id, r]));

  const ngSet = new Set<string>();
  for (const pair of duplicateNGPairs) {
    const key1 = `${pair.partA.songId}_${pair.partA.instrumentId}_${pair.partA.partIndex}|${pair.partB.songId}_${pair.partB.instrumentId}_${pair.partB.partIndex}`;
    const key2 = `${pair.partB.songId}_${pair.partB.instrumentId}_${pair.partB.partIndex}|${pair.partA.songId}_${pair.partA.instrumentId}_${pair.partA.partIndex}`;
    ngSet.add(key1);
    ngSet.add(key2);
  }

  const allPartsList: Array<{ songId: string; instrumentId: string; partIndex: number }> = [];
  for (const song of songs) {
    if (!song || !song.parts || typeof song.parts !== 'object') continue;
    for (const instId of Object.keys(song.parts)) {
      const partCount = song.parts[instId];
      if (typeof partCount === 'number' && partCount > 0) {
        for (let idx = 0; idx < partCount; idx++) {
          allPartsList.push({
            songId: song.id,
            instrumentId: instId,
            partIndex: idx
          });
        }
      }
    }
  }

  return {
    rooms,
    instruments,
    songs,
    duplicateNGPairs,
    entries,
    numSlots,
    instrumentMap,
    entryMap,
    roomMap,
    ngSet,
    allPartsList,
    _slotsAssignments: Array.from({ length: numSlots }, () => [] as Assignment[]),
    _entryUsageCount: new Map<string, number>(),
    _partRoomsBySlot: Array.from({ length: numSlots }, () => new Map<string, string>()),
    _assignedRoomIds: new Set<string>(),
    _activePartsInSlot: new Set<string>(),
    _activePartsInfo: [] as ActivePartInfo[]
  };
}

/**
 * 事前構築されたコンテキストを用いてスケジュールを高速評価します。
 */
export function evaluateScheduleWithContext(
  assignments: Assignment[],
  context: EvaluationContext,
  includeViolations: boolean = false
): { score: number; violations: ScheduleViolation[] } {
  let score = 0;
  const violations: ScheduleViolation[] = [];

  const {
    rooms,
    entries,
    songs,
    numSlots,
    instrumentMap,
    entryMap,
    roomMap,
    ngSet,
    allPartsList
  } = context;

  // バッファのクリアと再利用
  for (const arr of context._slotsAssignments) arr.length = 0;
  context._entryUsageCount.clear();
  for (const map of context._partRoomsBySlot) map.clear();

  const slotsAssignments = context._slotsAssignments;
  const entryUsageCount = context._entryUsageCount;
  const partRoomsBySlot = context._partRoomsBySlot;

  // コマごとに整理
  for (const asm of assignments) {
    if (asm.slotIndex < numSlots) {
      slotsAssignments[asm.slotIndex].push(asm);
    }
  }

  // 2. 全体制約（エントリー重複チェック）
  for (const asm of assignments) {
    if (asm.entryId && !asm.isPersonalPractice) {
      entryUsageCount.set(asm.entryId, (entryUsageCount.get(asm.entryId) || 0) + 1);
    }
  }
  for (const [entryId, count] of entryUsageCount.entries()) {
    if (count > 1) {
      const entry = entryMap.get(entryId);
      score -= 50000 * (count - 1);
      if (includeViolations) {
        violations.push({
          type: 'duplicate_entry',
          severity: 'error',
          message: `練習エントリー「${entry?.section || entryId}」が1日に複数回(${count}回)割り当てられています。`
        });
      }
    }
  }

  // 3. 各コマの制約検証
  for (let s = 0; s < numSlots; s++) {
    const currentSlotAsms = slotsAssignments[s];
    
    context._assignedRoomIds.clear();
    context._activePartsInSlot.clear();
    context._activePartsInfo.length = 0;
    
    const assignedRoomIds = context._assignedRoomIds;
    const activePartsInSlot = context._activePartsInSlot;
    const activePartsInfo = context._activePartsInfo;
    const slotMap = partRoomsBySlot[s];

    // A. 部屋ごとの制約検証（キャパシティ、移動不可楽器）
    for (const asm of currentSlotAsms) {
      if (asm.isPersonalPractice) continue;

      const room = roomMap.get(asm.roomId);
      if (!room || !asm.entryId) continue;

      const entry = entryMap.get(asm.entryId);
      if (!entry) continue;

      assignedRoomIds.add(asm.roomId);

      // キャパシティ管理
      const totalPeople = entry.parts.length;
      if (totalPeople > room.capacity) {
        const diff = totalPeople - room.capacity;
        score -= 100000 * diff;
        if (includeViolations) {
          violations.push({
            type: 'capacity',
            severity: 'error',
            message: `コマ ${s + 1}: 「${room.name}」の収容定員(${room.capacity}人)を超過しています(練習人数: ${totalPeople}人)`
          });
        }
      }

      // 移動不可楽器の固定部屋アサイン
      for (const p of entry.parts) {
        const inst = instrumentMap.get(p.instrumentId);
        if (inst?.movementType === 'immovable') {
          if (room.permanentInstrumentId !== inst.id) {
            score -= 100000;
            if (includeViolations) {
              violations.push({
                type: 'immovable',
                severity: 'error',
                message: `コマ ${s + 1}: 移動不可楽器「${inst.name}」が常設部屋「${rooms.find(r => r.permanentInstrumentId === inst.id)?.name || '未定義'}」以外(${room.name})で練習に割り当てられています。`
              });
            }
          }
        }

        // 位置情報をマッピング
        const key = `${entry.songId}_${p.instrumentId}_${p.partIndex}`;
        slotMap.set(key, asm.roomId);
        activePartsInSlot.add(key);
        activePartsInfo.push({
          key,
          songId: entry.songId,
          instrumentId: p.instrumentId,
          partIndex: p.partIndex,
          roomId: asm.roomId
        });
      }
    }

    // B. 重複NG（兼任パート）の衝突チェック（文字列スライス不要の高速直接比較）
    for (let i = 0; i < activePartsInfo.length; i++) {
      const partA = activePartsInfo[i];

      for (let j = i + 1; j < activePartsInfo.length; j++) {
        const partB = activePartsInfo[j];

        // 1. 自動重複NG: 別の曲で「同じ楽器かつ同じパート」の場合
        if (partA.songId !== partB.songId && partA.instrumentId === partB.instrumentId && partA.partIndex === partB.partIndex) {
          score -= 150000;
          if (includeViolations) {
            const inst = instrumentMap.get(partA.instrumentId);
            violations.push({
              type: 'auto_collision',
              severity: 'error',
              message: `コマ ${s + 1}: 別の曲で同じパート「${inst?.name || partA.instrumentId} (${partA.partIndex + 1}st)」が同時に練習に割り当てられています（自動衝突回避）。`
            });
          }
          continue;
        }

        // 2. 手動重複NG: ユーザーが明示的に設定したペアの場合
        const key = `${partA.key}|${partB.key}`;
        if (ngSet.has(key)) {
          score -= 150000;
          if (includeViolations) {
            violations.push({
              type: 'duplicate_ng',
              severity: 'error',
              message: `コマ ${s + 1}: 重複NG設定されているパートが同時に練習に駆り出されています。`
            });
          }
        }
      }
    }

    // C. 個人練習部屋の動的確保およびアサイン（共通パッキングエンジン利用）
    const idleParts = allPartsList.filter(
      ap => !activePartsInSlot.has(`${ap.songId}_${ap.instrumentId}_${ap.partIndex}`)
    );

    const personalPracticeRooms = rooms.filter(
      r => !assignedRoomIds.has(r.id) && (r.isPersonalPracticeCandidate || !!r.permanentInstrumentId)
    );

    if (personalPracticeRooms.length === 0 && idleParts.length > 0) {
      score -= 100000;
      if (includeViolations) {
        violations.push({
          type: 'no_personal_room',
          severity: 'error',
          message: `コマ ${s + 1}: 個人練習を行うための空き部屋が1つも確保できていません。`
        });
      }
    } else if (idleParts.length > 0) {
      const { partToRoomMap, overflowCount } = packPersonalPracticeRooms(personalPracticeRooms, idleParts);
      for (const [key, roomId] of partToRoomMap.entries()) {
        slotMap.set(key, roomId);
      }

      if (overflowCount > 0) {
        score -= 20000 * overflowCount;
        if (includeViolations) {
          violations.push({
            type: 'personal_overflow',
            severity: 'warning',
            message: `コマ ${s + 1}: 個人練習部屋の定員を超過し、待機（練習場所なし）が発生しています(${overflowCount}パート)`
          });
        }
      }
    }

    // D. ソフト制約：アサインされた練習の優先度ボーナス
    for (const asm of currentSlotAsms) {
      if (asm.entryId && !asm.isPersonalPractice) {
        const entry = entryMap.get(asm.entryId);
        if (entry) {
          if (entry.priority === 'high') score += 1000;
          else if (entry.priority === 'medium') score += 500;
          else if (entry.priority === 'low') score += 100;
          score += (numSlots - s) * 20;
        }
      } else if (!asm.entryId) {
        score -= 100;
      }
    }
  }

  // 4. ソフト制約：移動コストの最小化
  for (const part of allPartsList) {
    const inst = instrumentMap.get(part.instrumentId);
    if (!inst) continue;

    const partKey = `${part.songId}_${part.instrumentId}_${part.partIndex}`;

    for (let s = 0; s < numSlots - 1; s++) {
      const currentRoomId = partRoomsBySlot[s].get(partKey);
      const nextRoomId = partRoomsBySlot[s + 1].get(partKey);

      if (currentRoomId && nextRoomId && currentRoomId !== nextRoomId) {
        if (inst.movementType === 'immovable') {
          score -= 100000;
          if (includeViolations) {
            violations.push({
              type: 'movement',
              severity: 'warning',
              message: `移動不可楽器「${inst.name}」がコマ ${s + 1} から ${s + 2} の間に移動しています。`
            });
          }
        } else if (inst.movementType === 'avoid_movement') {
          score -= 5000;
        } else {
          score -= 200;
        }
      }
    }
  }

  // 5. すべての練習エントリーが最低1回はアサインされているか（必須実施制約）
  const assignedEntryIds = new Set<string>();
  for (const asm of assignments) {
    if (asm.entryId && !asm.isPersonalPractice) {
      assignedEntryIds.add(asm.entryId);
    }
  }

  for (const entry of entries) {
    if (!assignedEntryIds.has(entry.id)) {
      score -= 200000;
      if (includeViolations) {
        const song = songs.find(s => s.id === entry.songId);
        violations.push({
          type: 'missing_entry',
          severity: 'error',
          message: `練習エントリー「${song?.name || ''} - ${entry.section}」がスケジュール内に割り当てられていません（未配置）。`
        });
      }
    }
  }

  return { score, violations };
}

/**
 * スケジュール全体の評価ロジック（コンビニエンスラッパー）
 */
export function evaluateSchedule(
  assignments: Assignment[],
  rooms: Room[],
  instruments: Instrument[],
  songs: Song[],
  duplicateNGPairs: DuplicateNGPair[],
  entries: Entry[],
  numSlots: number,
  includeViolations: boolean = false
): { score: number; violations: ScheduleViolation[] } {
  const context = createEvaluationContext(rooms, instruments, songs, duplicateNGPairs, entries, numSlots);
  return evaluateScheduleWithContext(assignments, context, includeViolations);
}
