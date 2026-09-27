import type { Instrument, Song } from '../types';

/**
 * 2つのパート参照が同一であるかを比較します。
 * songId が両方に存在し異なる場合は false、
 * songId が片方または両方未指定の場合は instrumentId と partIndex で比較します。
 */
export function isSamePart(
  p1: { instrumentId: string; partIndex: number; songId?: string },
  p2: { instrumentId: string; partIndex: number; songId?: string }
): boolean {
  if (p1.songId && p2.songId && p1.songId !== p2.songId) return false;
  return p1.instrumentId === p2.instrumentId && p1.partIndex === p2.partIndex;
}

/**
 * パート数を考慮したパート表記名フォーマッター
 * - 単一パート編成の楽器: 「楽器名」 (例: 'チューバ')
 * - 複数パート編成の楽器: 「楽器名 1-based番号」 (例: 'フルート 1', 'ホルン 2')
 */
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

  const partCount = song.parts?.[instrumentId] || 0;
  if (partCount <= 1) {
    return instName;
  }

  return `${instName} ${partIndex + 1}`;
}
