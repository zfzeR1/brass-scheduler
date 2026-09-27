import type {
  ScheduleState,
  Assignment
} from '../types';
import { calculateNumSlots } from './timeUtils';
import {
  createEvaluationContext,
  evaluateScheduleWithContext
} from './scheduleEvaluator';
import { extractAllPartsList, packPersonalPracticeRooms } from './personalPracticePacking';

/**
 * 焼きなまし法（Simulated Annealing）を用いたスケジュール自動生成エンジン
 */
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

  // ループ外で全パートリストを一度だけ構築
  const allPartsList = extractAllPartsList(songs);

  for (let s = 0; s < numSlots; s++) {
    const slotAsms = finalAssignments.filter(asm => asm.slotIndex === s);

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

    const personalPracticeRooms = rooms.filter(room => {
      const isAssigned = slotAsms.some(asm => asm.roomId === room.id && asm.entryId);
      return !isAssigned && (room.isPersonalPracticeCandidate || !!room.permanentInstrumentId);
    });

    const { roomAssignments } = packPersonalPracticeRooms(personalPracticeRooms, idleParts);

    for (const asm of slotAsms) {
      if (!asm.entryId) {
        const partsForRoom = roomAssignments.get(asm.roomId);
        if (partsForRoom !== undefined && personalPracticeRooms.some(r => r.id === asm.roomId)) {
          asm.isPersonalPractice = true;
          asm.parts = partsForRoom;
        } else {
          asm.isPersonalPractice = false;
          asm.parts = [];
        }
      }
    }
  }

  return finalAssignments;
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
