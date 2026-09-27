import React, { useState } from 'react';
import type { ScheduleState, Song, Instrument } from '../../types';
import { removeSongWithCascade, sanitizeScheduleState } from '../../utils/scheduleIntegrity';
import { useOptionalSchedule } from '../../context/ScheduleContext';
import SongCreateForm from './song/SongCreateForm';
import SongListView from './song/SongListView';
import SongEditModal from './song/SongEditModal';

export interface SongFormSectionProps {
  state?: ScheduleState;
  setState?: React.Dispatch<React.SetStateAction<ScheduleState>>;
  onProceedToNext: () => void;
}

export default function SongFormSection(props: SongFormSectionProps) {
  const scheduleCtx = useOptionalSchedule();
  const state = props.state ?? scheduleCtx?.state;
  const setState = props.setState ?? scheduleCtx?.setState;
  const { onProceedToNext } = props;

  if (!state || !setState) {
    throw new Error('SongFormSection requires ScheduleProvider or state/setState props');
  }

  const [editingSong, setEditingSong] = useState<Song | null>(null);

  // 新規曲の追加
  const handleAddSong = (newSong: Song, extraInstruments: Instrument[]) => {
    setState(prev => {
      const nextInstruments = extraInstruments.length > 0
        ? [...prev.instruments, ...extraInstruments]
        : prev.instruments;
      return {
        ...prev,
        instruments: nextInstruments,
        songs: [...prev.songs, newSong]
      };
    });
  };

  // 既存曲の更新（安全サニタイズ処理を含む）
  const handleUpdateSong = (updatedSong: Song, extraInstruments: Instrument[]) => {
    setState(prev => {
      const nextInstruments = extraInstruments.length > 0
        ? [...prev.instruments, ...extraInstruments]
        : prev.instruments;
      const nextSongs = prev.songs.map(s => (s.id === updatedSong.id ? updatedSong : s));
      return sanitizeScheduleState({
        ...prev,
        instruments: nextInstruments,
        songs: nextSongs
      });
    });
  };

  // 曲の削除（カスケード削除により関連エントリー・NG・配置を整合性維持）
  const handleRemoveSong = (songId: string) => {
    setState(prev => removeSongWithCascade(prev, songId));
  };

  return (
    <div className="grid-2col">
      <SongCreateForm
        instruments={state.instruments}
        onAddSong={handleAddSong}
      />

      <SongListView
        songs={state.songs}
        instruments={state.instruments}
        onStartEditSong={song => setEditingSong(song)}
        onDeleteSong={handleRemoveSong}
        onProceedToNext={onProceedToNext}
      />

      <SongEditModal
        song={editingSong}
        isOpen={Boolean(editingSong)}
        instruments={state.instruments}
        onSave={handleUpdateSong}
        onClose={() => setEditingSong(null)}
      />
    </div>
  );
}
