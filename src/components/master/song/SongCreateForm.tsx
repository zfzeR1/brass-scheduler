import React, { useState } from 'react';
import type { Song, Instrument } from '../../../types';
import { STANDARD_PART_COUNTS } from '../../../constants/instruments';
import InstrumentPartPicker from './InstrumentPartPicker';
import AddExtraInstrumentModal from './AddExtraInstrumentModal';
import { Plus } from 'lucide-react';

export interface SongCreateFormProps {
  instruments: Instrument[];
  onAddSong: (newSong: Song, extraInstruments: Instrument[]) => void;
}

export default function SongCreateForm({
  instruments,
  onAddSong
}: SongCreateFormProps) {
  const [songName, setSongName] = useState('');
  const [tempSongParts, setTempSongParts] = useState<Record<string, number>>({});
  const [songExtraInstruments, setSongExtraInstruments] = useState<Instrument[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // デフォルトパート編成マップ（標準楽器ごとの初期パート数）
  const defaultParts: Record<string, number> = {};
  instruments.forEach(inst => {
    defaultParts[inst.id] = STANDARD_PART_COUNTS[inst.id] ?? 1;
  });

  const handlePartCountChange = (instId: string, count: number) => {
    setTempSongParts(prev => ({
      ...prev,
      [instId]: count
    }));
  };

  const handleAddExtraInstrument = (name: string) => {
    const newInst: Instrument = {
      id: 'inst-' + Date.now(),
      name,
      movementType: 'movable'
    };
    setSongExtraInstruments(prev => [...prev, newInst]);
    setTempSongParts(prev => ({ ...prev, [newInst.id]: 1 }));
  };

  const handleRemoveExtraInstrument = (instId: string) => {
    setSongExtraInstruments(prev => prev.filter(i => i.id !== instId));
    setTempSongParts(prev => {
      const next = { ...prev };
      delete next[instId];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = songName.trim();
    if (!trimmedName) return;

    // デフォルトと個別設定をマージ
    const mergedParts: Record<string, number> = { ...defaultParts, ...tempSongParts };

    // 追加楽器の初期値を反映
    songExtraInstruments.forEach(inst => {
      if (!(inst.id in mergedParts)) {
        mergedParts[inst.id] = 1;
      }
    });

    // 0以下のパートを除外
    const filteredParts: Record<string, number> = {};
    for (const [instId, count] of Object.entries(mergedParts)) {
      if (count > 0) {
        filteredParts[instId] = count;
      }
    }

    const newSong: Song = {
      id: 'song-' + Date.now(),
      name: trimmedName,
      parts: filteredParts
    };

    onAddSong(newSong, songExtraInstruments);

    // 状態リセット
    setSongName('');
    setTempSongParts({});
    setSongExtraInstruments([]);
  };

  const allKnownNames = [
    ...instruments.map(i => i.name),
    ...songExtraInstruments.map(i => i.name)
  ];

  return (
    <div className="glass-card">
      <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>曲データ・パート編成登録</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">曲名</label>
          <input
            name="name"
            value={songName}
            onChange={e => setSongName(e.target.value)}
            placeholder="曲名 (例: 宝島)"
            className="form-control"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">パート編成 (各楽器のパート数)</label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
            標準パート数が自動セットされています。使わない楽器は「-」に設定してください。
          </p>

          <InstrumentPartPicker
            instruments={instruments}
            extraInstruments={songExtraInstruments}
            parts={tempSongParts}
            defaultParts={defaultParts}
            onChangePartCount={handlePartCountChange}
            onRemoveExtraInstrument={handleRemoveExtraInstrument}
            onOpenAddExtraInstrument={() => setIsAddModalOpen(true)}
            maxHeight="300px"
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
          <Plus size={16} /> 曲を追加
        </button>
      </form>

      <AddExtraInstrumentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddExtraInstrument}
        existingNames={allKnownNames}
      />
    </div>
  );
}
