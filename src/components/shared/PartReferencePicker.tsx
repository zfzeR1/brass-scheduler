import React from 'react';
import type { Song, Instrument, PartReference } from '../../types';
import { formatPartName } from '../../utils/scheduler';

export interface PartReferencePickerProps {
  songs: Song[];
  instruments: Instrument[];
  value: PartReference;
  onChange: (value: PartReference) => void;
  songLabel?: string;
  instrumentLabel?: string;
  partLabel?: string;
  required?: boolean;
  disabled?: boolean;
  containerStyle?: React.CSSProperties;
}

export default function PartReferencePicker({
  songs,
  instruments,
  value,
  onChange,
  songLabel = '曲',
  instrumentLabel = '楽器',
  partLabel = 'パート',
  required = false,
  disabled = false,
  containerStyle
}: PartReferencePickerProps) {
  const currentSong = songs.find(s => s.id === value.songId);

  // 選択された曲に含まれる楽器一覧
  const songInstruments = currentSong
    ? instruments.filter(i => currentSong.parts[i.id] && currentSong.parts[i.id] > 0)
    : [];

  // 曲固有の追加楽器（instrumentsマスタに未登録のもの）
  const customInstIds = currentSong && currentSong.parts
    ? Object.keys(currentSong.parts).filter(
        instId => !instruments.some(i => i.id === instId) && currentSong.parts[instId] > 0
      )
    : [];

  const partCount = currentSong && value.instrumentId
    ? currentSong.parts[value.instrumentId] || 0
    : 0;

  const handleSongChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextSongId = e.target.value;
    onChange({
      songId: nextSongId,
      instrumentId: '',
      partIndex: 0
    });
  };

  const handleInstrumentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextInstId = e.target.value;
    onChange({
      ...value,
      instrumentId: nextInstId,
      partIndex: 0
    });
  };

  const handlePartIndexChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextIdx = Number(e.target.value);
    onChange({
      ...value,
      partIndex: nextIdx
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', ...containerStyle }}>
      {/* 1. 曲の選択 */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{songLabel}</label>
        <select
          className="form-control"
          value={value.songId}
          onChange={handleSongChange}
          required={required}
          disabled={disabled}
        >
          <option value="">曲を選択</option>
          {songs.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* 2. 楽器の選択 */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{instrumentLabel}</label>
        <select
          className="form-control"
          value={value.instrumentId}
          onChange={handleInstrumentChange}
          required={required}
          disabled={disabled || !value.songId}
        >
          <option value="">{value.songId ? '選択' : '曲を先に選択'}</option>
          {value.songId && (
            <>
              {songInstruments.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
              {customInstIds.map(instId => (
                <option key={instId} value={instId}>{instId}</option>
              ))}
            </>
          )}
        </select>
      </div>

      {/* 3. パートの選択 */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">{partLabel}</label>
        <select
          className="form-control"
          value={value.partIndex}
          onChange={handlePartIndexChange}
          required={required}
          disabled={disabled || !value.instrumentId}
        >
          {!value.instrumentId ? (
            <option value="0">楽器を先に選択</option>
          ) : (
            Array.from({ length: partCount }).map((_, idx) => (
              <option key={idx} value={idx}>
                {formatPartName(value.instrumentId, idx, value.songId, songs, instruments)}
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  );
}
