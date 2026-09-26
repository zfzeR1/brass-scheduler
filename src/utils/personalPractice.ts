import type { ScheduleState, Assignment, Room, Song, Instrument, SelectedPart } from '../types';

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

  for (const song of songs) {
    if (!song || !song.parts || typeof song.parts !== 'object') continue;
    for (const instId of Object.keys(song.parts)) {
      const inst = instruments.find(i => i.id === instId);
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
 * ユーザーが選択した担当パート群に基づき、各コマにおけるユーザーの練習場所・アサイン・個人練習部屋をシミュレートします。
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
        const entry = entries.find(e => e && e.id === asm.entryId);
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

    // 2. 合同練習がない場合、個人練習としてどの部屋にアサインされているかをシミュレートする
    if (!assignedAsm) {
      // 全パートリスト
      const allPartsList: Array<{ songId: string; instrumentId: string; partIndex: number }> = [];
      for (const song of songs) {
        if (!song || !song.parts || typeof song.parts !== 'object') continue;
        for (const instId of Object.keys(song.parts)) {
          const partCount = song.parts[instId];
          if (typeof partCount !== 'number' || partCount <= 0) continue;
          for (let idx = 0; idx < partCount; idx++) {
            allPartsList.push({ songId: song.id, instrumentId: instId, partIndex: idx });
          }
        }
      }

      // コマ s で練習アサインされているパート
      const activeParts: typeof allPartsList = [];
      for (const asm of slotAsms) {
        if (asm && asm.entryId) {
          const entry = entries.find(e => e && e.id === asm.entryId);
          if (entry && Array.isArray(entry.parts)) {
            for (const p of entry.parts) {
              if (p) {
                activeParts.push({ songId: entry.songId, instrumentId: p.instrumentId, partIndex: p.partIndex });
              }
            }
          }
        }
      }

      // 余りパート
      const idleParts = allPartsList.filter(
        ap => !activeParts.some(act => act.songId === ap.songId && act.instrumentId === ap.instrumentId && act.partIndex === ap.partIndex)
      );

      // 個人練習部屋候補
      const personalPracticeRooms: Room[] = [];
      for (const room of rooms) {
        if (!room) continue;
        const isAssigned = slotAsms.some(asm => asm && asm.roomId === room.id && asm.entryId);
        if (!isAssigned) {
          if (room.isPersonalPracticeCandidate || room.permanentInstrumentId) {
            personalPracticeRooms.push(room);
          }
        }
      }

      // シミュレーション実行して、自分が選択した最初のパートの行き先を探す
      let currentRoomIdx = 0;
      let currentRoomRemainingCap = personalPracticeRooms[currentRoomIdx]
        ? (personalPracticeRooms[currentRoomIdx].capacity || 0)
        : 0;
      let myPracticeRoomId: string | null = null;

      for (const idlePart of idleParts) {
        while (currentRoomIdx < personalPracticeRooms.length && currentRoomRemainingCap <= 0) {
          currentRoomIdx++;
          if (personalPracticeRooms[currentRoomIdx]) {
            currentRoomRemainingCap = personalPracticeRooms[currentRoomIdx].capacity || 0;
          }
        }

        if (currentRoomIdx < personalPracticeRooms.length) {
          const matchedMyPart = selectedParts.find(
            sp => sp && sp.songId === idlePart.songId && sp.instrumentId === idlePart.instrumentId && sp.partIndex === idlePart.partIndex
          );

          if (matchedMyPart) {
            myPracticeRoomId = personalPracticeRooms[currentRoomIdx].id;
            activePart = matchedMyPart;
            break;
          }
          currentRoomRemainingCap--;
        } else {
          break;
        }
      }

      if (myPracticeRoomId) {
        assignedAsm = slotAsms.find(asm => asm && asm.roomId === myPracticeRoomId) || null;
        isPersonal = true;
      }
    }

    const room = rooms.find(r => r && r.id === assignedAsm?.roomId);
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
