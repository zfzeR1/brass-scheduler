import React, { useState, useEffect } from 'react';
import type { Song, Instrument } from '../../../types';
import InstrumentPartPicker from './InstrumentPartPicker';
import AddExtraInstrumentModal from './AddExtraInstrumentModal';
import { X, Save } from 'lucide-react';
import ModalBase from '../../shared/ModalBase';

export interface SongEditModalProps {
  song: Song | null;
  isOpen: boolean;
  instruments: Instrument[];
  onSave: (updatedSong: Song, extraInstruments: Instrument[]) => void;
  onClose: () => void;
}

export default function SongEditModal({
  song,
  isOpen,
  instruments,
  onSave,
  onClose
}: SongEditModalProps) {
  const [songName, setSongName] = useState(() => song?.name || '');
  const [editParts, setEditParts] = useState<Record<string, number>>(() => {
    if (!song) return {};
    const initialParts: Record<string, number> = {};
    instruments.forEach(inst => {
      initialParts[inst.id] = song.parts[inst.id] ?? 0;
    });
    for (const instId of Object.keys(song.parts)) {
      if (!(instId in initialParts)) {
        initialParts[instId] = song.parts[instId];
      }
    }
    return initialParts;
  });
  const [editExtraInsts, setEditExtraInsts] = useState<Instrument[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (song && isOpen) {
      setSongName(song.name);
      // 既存の編成を読み込む
      const initialParts: Record<string, number> = {};
      instruments.forEach(inst => {
        initialParts[inst.id] = song.parts[inst.id] ?? 0;
      });
      // マスタにない楽器も保持
      for (const instId of Object.keys(song.parts)) {
        if (!(instId in initialParts)) {
          initialParts[instId] = song.parts[instId];
        }
      }
      setEditParts(initialParts);
      setEditExtraInsts([]);
    }
  }, [song, isOpen, instruments]);

  const handlePartCountChange = (instId: string, count: number) => {
    setEditParts(prev => ({
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
    setEditExtraInsts(prev => [...prev, newInst]);
    setEditParts(prev => ({ ...prev, [newInst.id]: 1 }));
  };

  const handleRemoveExtraInstrument = (instId: string) => {
    setEditExtraInsts(prev => prev.filter(i => i.id !== instId));
    setEditParts(prev => {
      const next = { ...prev };
      delete next[instId];
      return next;
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!song) return;
    const trimmedName = songName.trim();
    if (!trimmedName) return;

    const filteredParts: Record<string, number> = {};
    for (const [instId, count] of Object.entries(editParts)) {
      if (count > 0) {
        filteredParts[instId] = count;
      }
    }

    const updatedSong: Song = {
      ...song,
      name: trimmedName,
      parts: filteredParts
    };

    onSave(updatedSong, editExtraInsts);
    onClose();
  };

  const allKnownNames = [
    ...instruments.map(i => i.name),
    ...editExtraInsts.map(i => i.name)
  ];

  return (
    <>
      <ModalBase isOpen={isOpen} onClose={onClose} title="曲の編集" maxWidth="520px" zIndex={1000}>
        {song && (
          <div style={{ overflowY: 'auto' }}>
            {/* ヘッダー */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  曲データの編集
                </h2>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  ID: {song.id}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={onClose}
                aria-label="閉じる"
              >
                <X size={18} />
              </button>
            </div>

            {/* 編集フォーム */}
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>曲名</label>
                <input
                  type="text"
                  className="form-control"
                  value={songName}
                  onChange={e => setSongName(e.target.value)}
                  placeholder="曲名"
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>パート編成</label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
                  各楽器のパート数を指定してください（「-」に設定すると除外されます）。
                </p>

                <InstrumentPartPicker
                  instruments={instruments}
                  extraInstruments={editExtraInsts}
                  parts={editParts}
                  onChangePartCount={handlePartCountChange}
                  onRemoveExtraInstrument={handleRemoveExtraInstrument}
                  onOpenAddExtraInstrument={() => setIsAddModalOpen(true)}
                  maxHeight="260px"
                  isCompact={true}
                />
              </div>

              {/* フッターアクション */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  style={{ flex: 1, padding: '0.6rem' }}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!songName.trim()}
                  style={{ flex: 1, padding: '0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                >
                  <Save size={16} /> 変更を保存する
                </button>
              </div>
            </form>
          </div>
        )}
      </ModalBase>

      <AddExtraInstrumentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddExtraInstrument}
        existingNames={allKnownNames}
      />
    </>
  );
}
