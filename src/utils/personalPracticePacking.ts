import type { Room, Song } from '../types';

export interface PartItem {
  songId: string;
  instrumentId: string;
  partIndex: number;
}

export interface PackingResult {
  /** 部屋IDごとの割り当てパート一覧 */
  roomAssignments: Map<string, PartItem[]>;
  /** パート識別キー(`${songId}_${instrumentId}_${partIndex}`)から部屋IDへのマッピング */
  partToRoomMap: Map<string, string>;
  /** 部屋定員不足によりあふれた（待機となった）パート数 */
  overflowCount: number;
}

/**
 * 登録されている曲一覧から全パートのリスト（全曲・全楽器・全パートインデックス）を展開します。
 */
export function extractAllPartsList(songs: Song[]): PartItem[] {
  const list: PartItem[] = [];
  if (!Array.isArray(songs)) return list;

  for (const song of songs) {
    if (!song || !song.parts || typeof song.parts !== 'object') continue;
    for (const instId of Object.keys(song.parts)) {
      const partCount = song.parts[instId];
      if (typeof partCount === 'number' && partCount > 0) {
        for (let idx = 0; idx < partCount; idx++) {
          list.push({
            songId: song.id,
            instrumentId: instId,
            partIndex: idx
          });
        }
      }
    }
  }
  return list;
}

/**
 * 空きパート（idleParts）を個人練習可能な部屋群に定員順でグリーディに詰め込みます。
 * scheduleEvaluator, scheduleGenerator, personalPractice で統一されたパッキングアルゴリズムを提供します。
 */
export function packPersonalPracticeRooms(
  candidateRooms: Room[],
  idleParts: PartItem[]
): PackingResult {
  const safeRooms = (candidateRooms || []).filter((r): r is Room => Boolean(r && r.id));
  const safeParts = (idleParts || []).filter((p): p is PartItem => Boolean(p && p.songId && p.instrumentId != null));

  const roomAssignments = new Map<string, PartItem[]>();
  const partToRoomMap = new Map<string, string>();

  for (const r of safeRooms) {
    roomAssignments.set(r.id, []);
  }

  if (safeRooms.length === 0 || safeParts.length === 0) {
    return {
      roomAssignments,
      partToRoomMap,
      overflowCount: safeParts.length
    };
  }

  let currentRoomIdx = 0;
  let remainingCap = safeRooms[currentRoomIdx] ? Math.max(0, safeRooms[currentRoomIdx].capacity || 0) : 0;
  let overflowCount = 0;

  for (const part of safeParts) {
    while (currentRoomIdx < safeRooms.length && remainingCap <= 0) {
      currentRoomIdx++;
      if (currentRoomIdx < safeRooms.length) {
        remainingCap = Math.max(0, safeRooms[currentRoomIdx].capacity || 0);
      } else {
        remainingCap = 0;
      }
    }

    const key = `${part.songId}_${part.instrumentId}_${part.partIndex}`;
    if (currentRoomIdx < safeRooms.length) {
      const roomId = safeRooms[currentRoomIdx].id;
      const partsInRoom = roomAssignments.get(roomId) || [];
      partsInRoom.push(part);
      roomAssignments.set(roomId, partsInRoom);
      partToRoomMap.set(key, roomId);
      remainingCap--;
    } else {
      overflowCount++;
    }
  }

  return {
    roomAssignments,
    partToRoomMap,
    overflowCount
  };
}
