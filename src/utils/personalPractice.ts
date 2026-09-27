import type { ScheduleState, Assignment, Room, Song, Instrument, SelectedPart } from '../types';
import { extractAllPartsList, packPersonalPracticeRooms } from './personalPracticePacking';

export interface UserSlotSchedule {
  slotIndex: number;
  assignment: Assignment | null;
  room?: Room;
  isPersonal: boolean;
  activePart: SelectedPart | null;
}

export interface AvailablePartItem {
  song: Song;
  inst: Instrument;
  partIndex: number;
  key: string;
}

/**
 * 登録されている曲と楽器定義から、部員が選択可能な全曲の全パート一覧をフラットに展開します。
 */
export function getAvailableParts(
  songs: Song[] = [],
  instruments: Instrument[] = []
): AvailablePartItem[] {
  const list: AvailablePartItem[] = [];
  if (!Array.isArray(songs) || !Array.isArray(instruments)) return list;

  const instMap = new Map<string, Instrument>(instruments.map(i => [i.id, i]));

  for (const song of songs) {
    if (!song || !song.parts || typeof song.parts !== 'object') continue;
    for (const instId of Object.keys(song.parts)) {
      const inst = instMap.get(instId);
      const count = song.parts[instId];
      if (inst && typeof count === 'number' && count > 0) {
        for (let idx = 0; idx < count; idx++) {
          list.push({
            song,
            inst,
            partIndex: idx,
            key: `${song.id}_${instId}_${idx}`
          });
        }
      }
    }
  }
  return list;
}

/**
 * ユーザーが選択した担当パート群に基づき、各コマにおけるユーザーの練習場所・アサイン・個人練習部屋を取得・シミュレートします。
 */
export function calculateUserSchedule(
  selectedParts: SelectedPart[] = [],
  state: ScheduleState,
  numSlots: number
): UserSlotSchedule[] {
  if (!Array.isArray(selectedParts) || selectedParts.length === 0) return [];
  if (!state || !Array.isArray(state.assignments) || state.assignments.length === 0) return [];
  if (!numSlots || numSlots <= 0) return [];

  const songs = state.songs || [];
  const entries = state.entries || [];
  const rooms = state.rooms || [];
  const assignments = state.assignments || [];

  // ルックアップ Map 事前構築
  const roomMap = new Map<string, Room>();
  for (const r of rooms) {
    if (r && r.id) roomMap.set(r.id, r);
  }
  const entryMap = new Map<string, typeof entries[0]>();
  for (const e of entries) {
    if (e && e.id) entryMap.set(e.id, e);
  }

  // ループ不変な全パートリストを一度だけ構築
  const allPartsList = extractAllPartsList(songs);

  const schedule: UserSlotSchedule[] = [];

  for (let s = 0; s < numSlots; s++) {
    const slotAsms = assignments.filter(asm => asm && asm.slotIndex === s);

    let assignedAsm: Assignment | null = null;
    let isPersonal = false;
    let activePart: SelectedPart | null = null;

    // 1. 合同練習を探す (自分が選択したパートのいずれかがアサインされているか)
    for (const part of selectedParts) {
      if (!part) continue;
      const found = slotAsms.find(asm => {
        if (!asm || !asm.entryId || asm.isPersonalPractice) return false;
        const entry = entryMap.get(asm.entryId);
        return (
          entry &&
          entry.songId === part.songId &&
          Array.isArray(entry.parts) &&
          entry.parts.some(p => p && p.instrumentId === part.instrumentId && p.partIndex === part.partIndex)
        );
      });

      if (found) {
        assignedAsm = found;
        activePart = part;
        break;
      }
    }

    // 2. スケジューラーで既に確定した個人練習部屋を探す（統合最適化）
    if (!assignedAsm) {
      for (const part of selectedParts) {
        if (!part) continue;
        const explicitPersonal = slotAsms.find(asm => {
          if (!asm || !asm.isPersonalPractice || !Array.isArray(asm.parts)) return false;
          return asm.parts.some(p =>
            p && p.instrumentId === part.instrumentId && p.partIndex === part.partIndex && (!p.songId || p.songId === part.songId)
          );
        });

        if (explicitPersonal) {
          assignedAsm = explicitPersonal;
          isPersonal = true;
          activePart = part;
          break;
        }
      }
    }

    // 3. スケジュール上に確定配置がない場合、共通パッキングエンジンでシミュレートする
    if (!assignedAsm) {
      // コマ s で合奏練習アサインされているパート
      const activePartKeys = new Set<string>();
      for (const asm of slotAsms) {
        if (asm && asm.entryId && !asm.isPersonalPractice) {
          const entry = entryMap.get(asm.entryId);
          if (entry && Array.isArray(entry.parts)) {
            for (const p of entry.parts) {
              if (p) {
                activePartKeys.add(`${entry.songId}_${p.instrumentId}_${p.partIndex}`);
              }
            }
          }
        }
      }

      // 未合奏の余りパート
      const idleParts = allPartsList.filter(
        ap => !activePartKeys.has(`${ap.songId}_${ap.instrumentId}_${ap.partIndex}`)
      );

      // 個人練習部屋候補
      const candidateRooms = rooms.filter(room => {
        if (!room) return false;
        const isAssigned = slotAsms.some(asm => asm && asm.roomId === room.id && asm.entryId && !asm.isPersonalPractice);
        return !isAssigned && (room.isPersonalPracticeCandidate || !!room.permanentInstrumentId);
      });

      // 共通パッキングエンジンで配置シミュレーション
      const { partToRoomMap } = packPersonalPracticeRooms(candidateRooms, idleParts);

      for (const part of selectedParts) {
        if (!part) continue;
        const key = `${part.songId}_${part.instrumentId}_${part.partIndex}`;
        const targetRoomId = partToRoomMap.get(key);
        if (targetRoomId) {
          assignedAsm = slotAsms.find(asm => asm && asm.roomId === targetRoomId) || null;
          isPersonal = true;
          activePart = part;
          break;
        }
      }
    }

    const room = assignedAsm ? roomMap.get(assignedAsm.roomId) : undefined;
    schedule.push({
      slotIndex: s,
      assignment: assignedAsm,
      room,
      isPersonal,
      activePart
    });
  }

  return schedule;
}
