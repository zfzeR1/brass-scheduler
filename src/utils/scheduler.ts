import type {
  ScheduleState,
  Room,
  Instrument,
  Song,
  DuplicateNGPair,
  Entry,
  Assignment
} from '../types';

// スケジュール全体のコマ数を計算するユーティリティ
export function calculateNumSlots(
  startTime: string,
  endTime: string,
  slotDuration: number,
  intervalDuration: number
): number {
  const parseTimeToMinutes = (timeStr: string): number => {
    const [hrs, mins] = timeStr.split(':').map(Number);
    return hrs * 60 + mins;
  };

  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  const totalMinutes = endMins - startMins;

  if (totalMinutes <= 0) return 0;

  const cycle = slotDuration + intervalDuration;
  const slots = Math.floor((totalMinutes + intervalDuration) / cycle);
  return Math.max(0, slots);
}

// コマのインデックスから時間帯文字列を取得する
export function getSlotTimeRange(
  slotIndex: number,
  startTime: string,
  slotDuration: number,
  intervalDuration: number
): { start: string; end: string } {
  const parseTimeToMinutes = (timeStr: string): number => {
    const [hrs, mins] = timeStr.split(':').map(Number);
    return hrs * 60 + mins;
  };

  const formatMinutesToTime = (mins: number): string => {
    const hrs = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(hrs).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const startMins = parseTimeToMinutes(startTime);
  const slotStart = startMins + slotIndex * (slotDuration + intervalDuration);
  const slotEnd = slotStart + slotDuration;

  return {
    start: formatMinutesToTime(slotStart),
    end: formatMinutesToTime(slotEnd)
  };
}

// パートが同一であるかを比較する
export function isSamePart(
  p1: { instrumentId: string; partIndex: number; songId?: string },
  p2: { instrumentId: string; partIndex: number; songId?: string }
): boolean {
  if (p1.songId && p2.songId && p1.songId !== p2.songId) return false;
  return p1.instrumentId === p2.instrumentId && p1.partIndex === p2.partIndex;
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
    allPartsList
  };
}

/**
 * 事前構築されたコンテキストを用いてスケジュールを高速評価します。
 */
export function evaluateScheduleWithContext(
  assignments: Assignment[],
  context: EvaluationContext,
  includeViolations: boolean = false
): { score: number; violations: string[] } {
  let score = 0;
  const violations: string[] = [];

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

  // コマごとに整理
  const slotsAssignments: Assignment[][] = Array.from({ length: numSlots }, () => []);
  for (const asm of assignments) {
    if (asm.slotIndex < numSlots) {
      slotsAssignments[asm.slotIndex].push(asm);
    }
  }

  // 2. 全体制約（エントリー重複チェック）
  const entryUsageCount = new Map<string, number>();
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
        violations.push(`練習エントリー「${entry?.section || entryId}」が1日に複数回(${count}回)割り当てられています。`);
      }
    }
  }

  // コマごとの位置情報マップ（移動コスト計算用）
  const partRoomsBySlot: Array<Map<string, string>> = Array.from({ length: numSlots }, () => new Map());

  // 3. 各コマの制約検証
  for (let s = 0; s < numSlots; s++) {
    const currentSlotAsms = slotsAssignments[s];
    const assignedRoomIds = new Set<string>();
    const activePartsInSlot = new Set<string>();
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
          violations.push(`コマ ${s + 1}: 「${room.name}」の収容定員(${room.capacity}人)を超過しています(練習人数: ${totalPeople}人)`);
        }
      }

      // 移動不可楽器の固定部屋アサイン
      for (const p of entry.parts) {
        const inst = instrumentMap.get(p.instrumentId);
        if (inst?.movementType === 'immovable') {
          if (room.permanentInstrumentId !== inst.id) {
            score -= 100000;
            if (includeViolations) {
              violations.push(`コマ ${s + 1}: 移動不可楽器「${inst.name}」が常設部屋「${rooms.find(r => r.permanentInstrumentId === inst.id)?.name || '未定義'}」以外(${room.name})で練習に割り当てられています。`);
            }
          }
        }

        // 位置情報をマッピング
        const key = `${entry.songId}_${p.instrumentId}_${p.partIndex}`;
        slotMap.set(key, asm.roomId);
        activePartsInSlot.add(key);
      }
    }

    // B. 重複NG（兼任パート）の衝突チェック
    const activePartsList = Array.from(activePartsInSlot);
    for (let i = 0; i < activePartsList.length; i++) {
      const partKeyA = activePartsList[i];
      const firstUnderscoreA = partKeyA.indexOf('_');
      const secondUnderscoreA = partKeyA.indexOf('_', firstUnderscoreA + 1);
      const songA = partKeyA.slice(0, firstUnderscoreA);
      const instA = partKeyA.slice(firstUnderscoreA + 1, secondUnderscoreA);
      const partIndexA = Number(partKeyA.slice(secondUnderscoreA + 1));

      for (let j = i + 1; j < activePartsList.length; j++) {
        const partKeyB = activePartsList[j];
        const firstUnderscoreB = partKeyB.indexOf('_');
        const secondUnderscoreB = partKeyB.indexOf('_', firstUnderscoreB + 1);
        const songB = partKeyB.slice(0, firstUnderscoreB);
        const instB = partKeyB.slice(firstUnderscoreB + 1, secondUnderscoreB);
        const partIndexB = Number(partKeyB.slice(secondUnderscoreB + 1));

        // 1. 自動重複NG: 別の曲で「同じ楽器かつ同じパート」の場合
        if (songA !== songB && instA === instB && partIndexA === partIndexB) {
          score -= 150000;
          if (includeViolations) {
            const inst = instrumentMap.get(instA);
            violations.push(`コマ ${s + 1}: 別の曲で同じパート「${inst?.name || instA} (${partIndexA + 1}st)」が同時に練習に割り当てられています（自動衝突回避）。`);
          }
          continue;
        }

        // 2. 手動重複NG: ユーザーが明示的に設定したペアの場合
        const key = `${partKeyA}|${partKeyB}`;
        if (ngSet.has(key)) {
          score -= 150000;
          if (includeViolations) {
            violations.push(`コマ ${s + 1}: 重複NG設定されているパートが同時に練習に駆り出されています。`);
          }
        }
      }
    }

    // C. 個人練習部屋の動的確保およびアサイン（簡易判定＆位置マッピング）
    const idleParts = allPartsList.filter(
      ap => !activePartsInSlot.has(`${ap.songId}_${ap.instrumentId}_${ap.partIndex}`)
    );

    const personalPracticeRooms: Room[] = [];
    for (const room of rooms) {
      if (!assignedRoomIds.has(room.id)) {
        if (room.isPersonalPracticeCandidate || room.permanentInstrumentId) {
          personalPracticeRooms.push(room);
        }
      }
    }

    if (personalPracticeRooms.length === 0 && idleParts.length > 0) {
      score -= 100000;
      if (includeViolations) {
        violations.push(`コマ ${s + 1}: 個人練習を行うための空き部屋が1つも確保できていません。`);
      }
    } else if (idleParts.length > 0) {
      let currentRoomIdx = 0;
      let currentRoomRemainingCap = personalPracticeRooms[currentRoomIdx] ? personalPracticeRooms[currentRoomIdx].capacity : 0;
      let overflowCount = 0;

      for (const part of idleParts) {
        while (currentRoomIdx < personalPracticeRooms.length && currentRoomRemainingCap <= 0) {
          currentRoomIdx++;
          if (currentRoomIdx < personalPracticeRooms.length) {
            currentRoomRemainingCap = Math.max(0, personalPracticeRooms[currentRoomIdx].capacity);
          } else {
            currentRoomRemainingCap = 0;
          }
        }

        const key = `${part.songId}_${part.instrumentId}_${part.partIndex}`;
        if (currentRoomIdx < personalPracticeRooms.length) {
          slotMap.set(key, personalPracticeRooms[currentRoomIdx].id);
          currentRoomRemainingCap--;
        } else {
          overflowCount++;
        }
      }

      if (overflowCount > 0) {
        score -= 20000 * overflowCount;
        if (includeViolations) {
          violations.push(`コマ ${s + 1}: 個人練習部屋の定員を超過し、待機（練習場所なし）が発生しています(${overflowCount}パート)`);
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
            violations.push(`移動不可楽器「${inst.name}」がコマ ${s + 1} から ${s + 2} の間に移動しています。`);
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
        violations.push(`練習エントリー「${song?.name || ''} - ${entry.section}」がスケジュール内に割り当てられています（必須実施）。`);
      }
    }
  }

  return { score, violations };
}

// スケジュール全体の評価ロジック
export function evaluateSchedule(
  assignments: Assignment[],
  rooms: Room[],
  instruments: Instrument[],
  songs: Song[],
  duplicateNGPairs: DuplicateNGPair[],
  entries: Entry[],
  numSlots: number,
  includeViolations: boolean = false
): { score: number; violations: string[] } {
  const context = createEvaluationContext(rooms, instruments, songs, duplicateNGPairs, entries, numSlots);
  return evaluateScheduleWithContext(assignments, context, includeViolations);
}

// 焼きなまし法（Simulated Annealing）を用いた自動生成ロジック (最適化版: メモリアロケーションゼロ・インプレース反転復元・キャッシュ評価)
export function generateSchedule(
  state: ScheduleState,
  startSlotIndex: number = 0
): Assignment[] {
  const { timeSettings, rooms, instruments, songs, duplicateNGPairs, entries } = state;
  const numSlots = calculateNumSlots(
    timeSettings.startTime,
    timeSettings.endTime,
    timeSettings.slotDuration,
    timeSettings.intervalDuration
  );

  if (numSlots <= 0 || rooms.length === 0) return [];

  const currentAssignments: Assignment[] = [];
  const assignmentMap = new Map<string, Assignment>();
  for (const asm of state.assignments) {
    assignmentMap.set(`${asm.slotIndex}_${asm.roomId}`, asm);
  }

  for (let s = 0; s < numSlots; s++) {
    for (const room of rooms) {
      const key = `${s}_${room.id}`;
      const existing = assignmentMap.get(key);

      if (existing && (existing.isLocked || s < startSlotIndex)) {
        currentAssignments.push({
          ...existing,
          parts: [...(existing.parts || [])]
        });
      } else {
        currentAssignments.push({
          id: key,
          slotIndex: s,
          roomId: room.id,
          entryId: undefined,
          parts: [],
          isLocked: false,
          isPersonalPractice: false
        });
      }
    }
  }

  const context = createEvaluationContext(rooms, instruments, songs, duplicateNGPairs, entries, numSlots);

  // 初期評価
  let currentScore = evaluateScheduleWithContext(currentAssignments, context, false).score;
  let bestScore = currentScore;
  let bestAssignments = currentAssignments.map(asm => ({ ...asm, parts: [...asm.parts] }));

  const initialTemp = 100.0;
  const finalTemp = 0.1;
  const alpha = 0.98;
  const iterationsPerTemp = 200;
  let temp = initialTemp;

  // エントリーのpartsオブジェクトを事前構築（探索中のアロケーションを抑止）
  const entryPartsMap = new Map<string, Array<{ instrumentId: string; partIndex: number; songId: string }>>();
  for (const entry of entries) {
    entryPartsMap.set(
      entry.id,
      entry.parts.map(p => ({
        instrumentId: p.instrumentId,
        partIndex: p.partIndex,
        songId: entry.songId
      }))
    );
  }

  // 変更対象のアサインメントを事前分類
  const mutableAsms = currentAssignments.filter(asm => asm.slotIndex >= startSlotIndex && !asm.isLocked);
  if (mutableAsms.length === 0) {
    return currentAssignments;
  }

  // スロットごとのmutable、部屋ごとのmutableを事前グループ化
  const mutablesBySlot = new Map<number, Assignment[]>();
  const mutablesByRoom = new Map<string, Assignment[]>();
  for (const asm of mutableAsms) {
    if (!mutablesBySlot.has(asm.slotIndex)) mutablesBySlot.set(asm.slotIndex, []);
    mutablesBySlot.get(asm.slotIndex)!.push(asm);

    if (!mutablesByRoom.has(asm.roomId)) mutablesByRoom.set(asm.roomId, []);
    mutablesByRoom.get(asm.roomId)!.push(asm);
  }

  const assignableEntries = [...entries];

  while (temp > finalTemp) {
    for (let iter = 0; iter < iterationsPerTemp; iter++) {
      const targetAsm = mutableAsms[Math.floor(Math.random() * mutableAsms.length)];
      const action = Math.floor(Math.random() * 3);

      const prevTargetEntryId = targetAsm.entryId;
      const prevTargetParts = targetAsm.parts;
      let otherAsm: Assignment | null = null;
      let prevOtherEntryId: string | undefined = undefined;
      let prevOtherParts: typeof targetAsm.parts = [];

      if (action === 0) {
        // アサインの変更またはクリア
        const randVal = Math.random();
        if (randVal < 0.2) {
          targetAsm.entryId = undefined;
          targetAsm.parts = [];
        } else {
          const entry = assignableEntries[Math.floor(Math.random() * assignableEntries.length)];
          targetAsm.entryId = entry.id;
          targetAsm.parts = entryPartsMap.get(entry.id) || [];
        }
      } else if (action === 1) {
        // 同じコマ内の別部屋と入れ替え
        const slotCandidates = mutablesBySlot.get(targetAsm.slotIndex);
        if (slotCandidates && slotCandidates.length > 1) {
          let pick = slotCandidates[Math.floor(Math.random() * slotCandidates.length)];
          if (pick === targetAsm) {
            pick = slotCandidates[(slotCandidates.indexOf(targetAsm) + 1) % slotCandidates.length];
          }
          otherAsm = pick;
          prevOtherEntryId = otherAsm.entryId;
          prevOtherParts = otherAsm.parts;

          targetAsm.entryId = prevOtherEntryId;
          targetAsm.parts = prevOtherParts;
          otherAsm.entryId = prevTargetEntryId;
          otherAsm.parts = prevTargetParts;
        } else {
          continue;
        }
      } else {
        // 同じ部屋の別コマと入れ替え
        const roomCandidates = mutablesByRoom.get(targetAsm.roomId);
        if (roomCandidates && roomCandidates.length > 1) {
          let pick = roomCandidates[Math.floor(Math.random() * roomCandidates.length)];
          if (pick === targetAsm) {
            pick = roomCandidates[(roomCandidates.indexOf(targetAsm) + 1) % roomCandidates.length];
          }
          otherAsm = pick;
          prevOtherEntryId = otherAsm.entryId;
          prevOtherParts = otherAsm.parts;

          targetAsm.entryId = prevOtherEntryId;
          targetAsm.parts = prevOtherParts;
          otherAsm.entryId = prevTargetEntryId;
          otherAsm.parts = prevTargetParts;
        } else {
          continue;
        }
      }

      // 新しい配置のスコアを高速評価
      const nextScore = evaluateScheduleWithContext(currentAssignments, context, false).score;
      const delta = nextScore - currentScore;

      if (delta > 0 || Math.random() < Math.exp(delta / temp)) {
        // 採択（変更を確定）
        currentScore = nextScore;
        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestAssignments = currentAssignments.map(asm => ({ ...asm, parts: [...asm.parts] }));
        }
      } else {
        // 棄却（変更を元に戻す - メモリアロケーションゼロ）
        if (action === 0) {
          targetAsm.entryId = prevTargetEntryId;
          targetAsm.parts = prevTargetParts;
        } else if (otherAsm) {
          targetAsm.entryId = prevTargetEntryId;
          targetAsm.parts = prevTargetParts;
          otherAsm.entryId = prevOtherEntryId;
          otherAsm.parts = prevOtherParts;
        }
      }
    }
    temp *= alpha;
  }

  // 最後に個人練習部屋の動的アサインを適用・明示化して結果を出力
  const finalAssignments = bestAssignments.map(asm => ({ ...asm }));

  for (let s = 0; s < numSlots; s++) {
    const slotAsms = finalAssignments.filter(asm => asm.slotIndex === s);

    const allPartsList: Array<{ songId: string; instrumentId: string; partIndex: number }> = [];
    for (const song of songs) {
      for (const instId of Object.keys(song.parts)) {
        const partCount = song.parts[instId];
        for (let idx = 0; idx < partCount; idx++) {
          allPartsList.push({ songId: song.id, instrumentId: instId, partIndex: idx });
        }
      }
    }

    const activeParts: typeof allPartsList = [];
    for (const asm of slotAsms) {
      if (asm.entryId) {
        const entry = entries.find(e => e.id === asm.entryId);
        if (entry) {
          for (const p of entry.parts) {
            activeParts.push({ songId: entry.songId, instrumentId: p.instrumentId, partIndex: p.partIndex });
          }
        }
      }
    }

    const idleParts = allPartsList.filter(
      ap => !activeParts.some(act => act.songId === ap.songId && act.instrumentId === ap.instrumentId && act.partIndex === ap.partIndex)
    );

    const personalPracticeRooms: Room[] = [];
    for (const room of rooms) {
      const isAssigned = slotAsms.some(asm => asm.roomId === room.id && asm.entryId);
      if (!isAssigned) {
        if (room.isPersonalPracticeCandidate || room.permanentInstrumentId) {
          personalPracticeRooms.push(room);
        }
      }
    }

    let currentRoomIdx = 0;
    let currentRoomRemainingCap = personalPracticeRooms[currentRoomIdx] ? personalPracticeRooms[currentRoomIdx].capacity : 0;
    
    const practiceRoomParts = new Map<string, typeof idleParts>();
    for (const r of personalPracticeRooms) {
      practiceRoomParts.set(r.id, []);
    }

    for (const part of idleParts) {
      // 安全なwhileループ
      while (currentRoomIdx < personalPracticeRooms.length && currentRoomRemainingCap <= 0) {
        currentRoomIdx++;
        if (currentRoomIdx < personalPracticeRooms.length) {
          currentRoomRemainingCap = Math.max(0, personalPracticeRooms[currentRoomIdx].capacity);
        } else {
          currentRoomRemainingCap = 0;
        }
      }

      if (currentRoomIdx < personalPracticeRooms.length) {
        const roomId = personalPracticeRooms[currentRoomIdx].id;
        const currentList = practiceRoomParts.get(roomId) || [];
        currentList.push(part);
        practiceRoomParts.set(roomId, currentList);
        currentRoomRemainingCap--;
      }
    }

    for (const asm of slotAsms) {
      if (!asm.entryId) {
        const isPracticeRoom = personalPracticeRooms.some(r => r.id === asm.roomId);
        if (isPracticeRoom) {
          asm.isPersonalPractice = true;
          asm.parts = practiceRoomParts.get(asm.roomId) || [];
        } else {
          asm.isPersonalPractice = false;
          asm.parts = [];
        }
      }
    }
  }

  return finalAssignments;
}

// パート数を考慮したパート表記名フォーマッター (単一パートは数字なし、複数パートは「楽器名 数字」)
export function formatPartName(
  instrumentId: string,
  partIndex: number,
  songId: string | undefined,
  songs: Song[],
  instruments: Instrument[]
): string {
  const inst = instruments.find(i => i.id === instrumentId);
  const instName = inst ? inst.name : instrumentId;

  if (!songId) {
    return partIndex === 0 ? instName : `${instName} ${partIndex + 1}`;
  }

  const song = songs.find(s => s.id === songId);
  if (!song) {
    return partIndex === 0 ? instName : `${instName} ${partIndex + 1}`;
  }

  const partCount = song.parts[instrumentId] || 0;
  if (partCount <= 1) {
    return instName;
  }

  return `${instName} ${partIndex + 1}`;
}

/**
 * スケジュール自動生成を非同期（非ブロッキング）で実行します。
 * UIスレッドの描画更新（ローディングスピナーの表示）を挟んでから計算を開始します。
 */
export function generateScheduleAsync(
  state: ScheduleState,
  startSlotIndex: number = 0
): Promise<Assignment[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(generateSchedule(state, startSlotIndex));
    }, 16);
  });
}
