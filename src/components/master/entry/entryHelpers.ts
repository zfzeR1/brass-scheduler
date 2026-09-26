import type { Song, Instrument } from '../../../types';
import { formatPartName } from '../../../utils/scheduler';

export interface SongPartItem {
  instrumentId: string;
  partIndex: number;
  label: string;
}

/**
 * 対象曲で編成されているパートの一覧と表示用ラベルを生成します。
 */
export function getSongParts(
  songId: string,
  songs: Song[],
  instruments: Instrument[]
): SongPartItem[] {
  const song = songs.find(s => s.id === songId);
  if (!song) return [];

  const list: SongPartItem[] = [];
  for (const instId of Object.keys(song.parts)) {
    const count = song.parts[instId];
    for (let idx = 0; idx < count; idx++) {
      list.push({
        instrumentId: instId,
        partIndex: idx,
        label: formatPartName(instId, idx, songId, songs, instruments)
      });
    }
  }
  return list;
}
