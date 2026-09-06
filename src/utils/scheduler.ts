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

// スケジュール全体の評価ロジック (最適化版)
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
  let score = 0;
  const violations: string[] = [];

  // 1. マップとキャッシュの作成
  const instrumentMap = new Map<string, Instrument>(instruments.map(i => [i.id, i]));
  const entryMap = new Map<string, Entry>(entries.map(e => [e.id, e]));
  const roomMap = new Map<string, Room>(rooms.map(r => [r.id, r]));

  // 重複NGの高速ルックアップ用セット
  const ngSet = new Set<string>();
  for (const pair of duplicateNGPairs) {
    const key1 = `${pair.partA.songId}_${pair.partA.instrumentId}_${pair.partA.partIndex}|${pair.partB.songId}_${pair.partB.instrumentId}_${pair.partB.partIndex}`;
    const key2 = `${pair.partB.songId}_${pair.partB.instrumentId}_${pair.partB.partIndex}|${pair.partA.songId}_${pair.partA.instrumentId}_${pair.partA.partIndex}`;
    ngSet.add(key1);
    ngSet.add(key2);
  }

  // 全パート一覧を作成
  const allPartsList: Array<{ songId: string; instrumentId: string; partIndex: number }> = [];
  for (const song of songs) {
    for (const instId of Object.keys(song.parts)) {
      const partCount = song.parts[instId];
      for (let idx = 0; idx < partCount; idx++) {
        allPartsList.push({
          songId: song.id,
          instrumentId: instId,
          partIndex: idx
        });
      }
    }
  }

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
    const activeEntriesInSlot: Entry[] = [];
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

      activeEntriesInSlot.push(entry);
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
      const [songA, instA, partIndexAStr] = activePartsList[i].split('_');
      const partIndexA = Number(partIndexAStr);

      for (let j = i + 1; j < activePartsList.length; j++) {
        const [songB, instB, partIndexBStr] = activePartsList[j].split('_');
        const partIndexB = Number(partIndexBStr);

        // 1. 自動重複NG: 別の曲で「同じ楽器かつ同じパート」の場合
        if (songA !== songB && instA === instB && partIndexA === partIndexB) {
          score -= 150000;
          if (includeViolations) {
            const inst = instrumentMap.get(instA);
            violations.push(`コマ ${s + 1}: 別の曲で同じパート「${inst?.name || instA} (${partIndexA + 1}st)」が同時に練習に割り当てられています（自動衝突回避）。`);
          }
          continue; // 自動重複NGで衝突したペアは、手動NGのチェックをスキップしてよい
        }

        // 2. 手動重複NG: ユーザーが明示的に設定したペアの場合
        const key = `${activePartsList[i]}|${activePartsList[j]}`;
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
        // 安全性を高めたwhile条件
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
      score -= 200000; // 重大な制約違反ペナルティ
      if (includeViolations) {
        const song = songs.find(s => s.id === entry.songId);
        violations.push(`練習エントリー「${song?.name || ''} - ${entry.section}」がスケジュール内に割り当てられていません（必須実施）。`);
      }
    }
  }

  return { score, violations };
}

// 焼きなまし法（Simulated Annealing）を用いた自動生成ロジック
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

  let currentAssignments: Assignment[] = [];
  const assignmentMap = new Map<string, Assignment>();
  for (const asm of state.assignments) {
    assignmentMap.set(`${asm.slotIndex}_${asm.roomId}`, asm);
  }

  for (let s = 0; s < numSlots; s++) {
    for (const room of rooms) {
      const key = `${s}_${room.id}`;
      const existing = assignmentMap.get(key);

      if (existing && (existing.isLocked || s < startSlotIndex)) {
        currentAssignments.push({ ...existing });
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

  // 初期評価 (探索中は includeViolations を false にする)
  let bestAssignments = currentAssignments.map(asm => ({ ...asm }));
  let bestEval = evaluateSchedule(bestAssignments, rooms, instruments, songs, duplicateNGPairs, entries, numSlots, false);

  const initialTemp = 100.0;
  const finalTemp = 0.1;
  const alpha = 0.98;
  const iterationsPerTemp = 200;
  let temp = initialTemp;

  const assignableEntries = [...entries];

  const getMutableAssignments = (asms: Assignment[]): Assignment[] => {
    return asms.filter(asm => asm.slotIndex >= startSlotIndex && !asm.isLocked);
  };

  while (temp > finalTemp) {
    for (let iter = 0; iter < iterationsPerTemp; iter++) {
      const nextAssignments = currentAssignments.map(asm => ({ ...asm }));
      const mutableAsms = getMutableAssignments(nextAssignments);

      if (mutableAsms.length === 0) break;

      const targetAsm = mutableAsms[Math.floor(Math.random() * mutableAsms.length)];
      const action = Math.floor(Math.random() * 3);

      if (action === 0) {
        const randVal = Math.random();
        if (randVal < 0.2) {
          targetAsm.entryId = undefined;
          targetAsm.parts = [];
        } else {
          const entry = assignableEntries[Math.floor(Math.random() * assignableEntries.length)];
          targetAsm.entryId = entry.id;
          targetAsm.parts = entry.parts.map(p => ({
            instrumentId: p.instrumentId,
            partIndex: p.partIndex,
            songId: entry.songId
          }));
        }
      } else if (action === 1) {
        const sameSlotMutables = mutableAsms.filter(
          asm => asm.slotIndex === targetAsm.slotIndex && asm.roomId !== targetAsm.roomId
        );
        if (sameSlotMutables.length > 0) {
          const otherAsm = sameSlotMutables[Math.floor(Math.random() * sameSlotMutables.length)];
          const tempEntry = targetAsm.entryId;
          const tempParts = targetAsm.parts;

          targetAsm.entryId = otherAsm.entryId;
          targetAsm.parts = otherAsm.parts;
          otherAsm.entryId = tempEntry;
          otherAsm.parts = tempParts;
        }
      } else {
        const otherSlotMutables = mutableAsms.filter(
          asm => asm.roomId === targetAsm.roomId && asm.slotIndex !== targetAsm.slotIndex
        );
        if (otherSlotMutables.length > 0) {
          const otherAsm = otherSlotMutables[Math.floor(Math.random() * otherSlotMutables.length)];
          const tempEntry = targetAsm.entryId;
          const tempParts = targetAsm.parts;

          targetAsm.entryId = otherAsm.entryId;
          targetAsm.parts = otherAsm.parts;
          otherAsm.entryId = tempEntry;
          otherAsm.parts = tempParts;
        }
      }

      // 探索中は includeViolations: false にして不要な文字列生成と配列pushを抑止
      const currentEval = evaluateSchedule(currentAssignments, rooms, instruments, songs, duplicateNGPairs, entries, numSlots, false);
      const nextEval = evaluateSchedule(nextAssignments, rooms, instruments, songs, duplicateNGPairs, entries, numSlots, false);

      const delta = nextEval.score - currentEval.score;

      if (delta > 0 || Math.random() < Math.exp(delta / temp)) {
        currentAssignments = nextAssignments;
        
        if (nextEval.score > bestEval.score) {
          bestAssignments = nextAssignments.map(asm => ({ ...asm }));
          bestEval = nextEval;
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
