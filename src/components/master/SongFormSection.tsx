import React, { useState } from 'react';
import type { ScheduleState, Song } from '../../types';
import { STANDARD_PART_COUNTS } from '../../types';
import { removeSongWithCascade, sanitizeScheduleState } from '../../utils/scheduleIntegrity';
import { Plus, Trash2, Edit3, ChevronRight } from 'lucide-react';

export interface SongFormSectionProps {
  state: ScheduleState;
  setState: React.Dispatch<React.SetStateAction<ScheduleState>>;
  onProceedToNext: () => void;
}

const PART_COUNT_OPTIONS = [
  { value: 0, label: '-' },
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3rd' },
  { value: 4, label: '4th' }
];

export default function SongFormSection({ state, setState, onProceedToNext }: SongFormSectionProps) {
  const [tempSongParts, setTempSongParts] = useState<{ [instId: string]: number }>({});
  const [songExtraInstruments, setSongExtraInstruments] = useState<Array<{ id: string; name: string; movementType: 'movable' | 'avoid_movement' | 'immovable' }>>([]);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editSongParts, setEditSongParts] = useState<{ [instId: string]: number }>({});
  const [editSongExtraInsts, setEditSongExtraInsts] = useState<Array<{ id: string; name: string; movementType: 'movable' | 'avoid_movement' | 'immovable' }>>([]);

  const getDefaultSongParts = (): { [instId: string]: number } => {
    const defaults: { [instId: string]: number } = {};
    state.instruments.forEach(inst => {
      defaults[inst.id] = STANDARD_PART_COUNTS[inst.id] ?? 1;
    });
    return defaults;
  };

  const handleAddSong = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    if (!name) return;

    const defaults = getDefaultSongParts();
    const mergedParts: { [instId: string]: number } = { ...defaults };
    for (const [instId, count] of Object.entries(tempSongParts)) {
      mergedParts[instId] = count;
    }

    if (songExtraInstruments.length > 0) {
      setState(prev => ({
        ...prev,
        instruments: [...prev.instruments, ...songExtraInstruments]
      }));
      songExtraInstruments.forEach(inst => {
        if (!(inst.id in mergedParts)) {
          mergedParts[inst.id] = 1;
        }
      });
    }

    const filteredParts: { [instId: string]: number } = {};
    for (const [instId, count] of Object.entries(mergedParts)) {
      if (count > 0) filteredParts[instId] = count;
    }

    const newSong: Song = {
      id: 'song-' + Date.now(),
      name,
      parts: filteredParts
    };

    setState(prev => ({
      ...prev,
      songs: [...prev.songs, newSong]
    }));
    setTempSongParts({});
    setSongExtraInstruments([]);
    e.currentTarget.reset();
  };

  const handleAddSongExtraInstrument = () => {
    const name = prompt('追加する楽器名を入力してください:');
    if (!name || name.trim() === '') return;
    if (state.instruments.some(i => i.name === name.trim()) || songExtraInstruments.some(i => i.name === name.trim())) {
      alert('この楽器は既に登録されています。');
      return;
    }
    const newInst = {
      id: 'inst-' + Date.now(),
      name: name.trim(),
      movementType: 'movable' as const
    };
    setSongExtraInstruments(prev => [...prev, newInst]);
    setTempSongParts(prev => ({ ...prev, [newInst.id]: 1 }));
  };

  const handleStartEditSong = (song: Song) => {
    setEditingSongId(song.id);
    const parts: { [instId: string]: number } = {};
    state.instruments.forEach(inst => {
      parts[inst.id] = song.parts[inst.id] ?? 0;
    });
    for (const instId of Object.keys(song.parts)) {
      if (!(instId in parts)) {
        parts[instId] = song.parts[instId];
      }
    }
    setEditSongParts(parts);
    setEditSongExtraInsts([]);
  };

  const handleSaveEditSong = (songId: string) => {
    const filteredParts: { [instId: string]: number } = {};
    for (const [instId, count] of Object.entries(editSongParts)) {
      if (count > 0) filteredParts[instId] = count;
    }
    setState(prev => {
      const nextInstruments = editSongExtraInsts.length > 0
        ? [...prev.instruments, ...editSongExtraInsts]
        : prev.instruments;
      const nextSongs = prev.songs.map(s => s.id === songId ? { ...s, parts: filteredParts } : s);
      return sanitizeScheduleState({
        ...prev,
        instruments: nextInstruments,
        songs: nextSongs
      });
    });
    setEditingSongId(null);
    setEditSongExtraInsts([]);
  };

  const handleCancelEditSong = () => {
    setEditingSongId(null);
    setEditSongExtraInsts([]);
  };

  const handleAddEditSongExtraInstrument = () => {
    const name = prompt('追加する楽器名を入力してください:');
    if (!name || name.trim() === '') return;
    if (state.instruments.some(i => i.name === name.trim()) || editSongExtraInsts.some(i => i.name === name.trim())) {
      alert('この楽器は既に登録されています。');
      return;
    }
    const newInst = {
      id: 'inst-' + Date.now(),
      name: name.trim(),
      movementType: 'movable' as const
    };
    setEditSongExtraInsts(prev => [...prev, newInst]);
    setEditSongParts(prev => ({ ...prev, [newInst.id]: 1 }));
  };

  const handleRemoveSong = (id: string) => {
    setState(prev => removeSongWithCascade(prev, id));
  };

  return (
    <div className="grid-2col">
      <div className="glass-card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>曲データ・パート編成登録</h2>

        {/* 曲登録フォーム */}
        <form onSubmit={handleAddSong}>
          <div className="form-group">
            <label className="form-label">曲名</label>
            <input name="name" placeholder="曲名 (例: 宝島)" className="form-control" required />
          </div>

          <div className="form-group">
            <label className="form-label">パート編成 (各楽器のパート数)</label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>標準パート数が自動セットされています。使わない楽器は「-」に設定してください。</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', padding: '0.25rem' }}>
              {state.instruments.map(inst => {
                const defaultCount = STANDARD_PART_COUNTS[inst.id] ?? 1;
                return (
                  <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', flex: '1', minWidth: '100px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {inst.name}
                    </span>
                    <select
                      className="form-control"
                      style={{ padding: '0.35rem 0.4rem', width: '75px', fontSize: '0.85rem' }}
                      value={tempSongParts[inst.id] ?? defaultCount}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setTempSongParts(prev => ({
                          ...prev,
                          [inst.id]: val
                        }));
                      }}
                    >
                      {PART_COUNT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {/* Song-specific extra instruments */}
              {songExtraInstruments.map(inst => (
                <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', flex: '1', minWidth: '100px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--primary)' }}>
                    {inst.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(追加)</span>
                  </span>
                  <select
                    className="form-control"
                    style={{ padding: '0.35rem 0.4rem', width: '75px', fontSize: '0.85rem' }}
                    value={tempSongParts[inst.id] ?? 1}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setTempSongParts(prev => ({
                        ...prev,
                        [inst.id]: val
                      }));
                    }}
                  >
                    {PART_COUNT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon"
                    onClick={() => {
                      setSongExtraInstruments(prev => prev.filter(i => i.id !== inst.id));
                      setTempSongParts(prev => {
                        const next = { ...prev };
                        delete next[inst.id];
                        return next;
                      });
                    }}
                  >
                    <Trash2 size={12} style={{ color: 'var(--danger)' }} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              onClick={handleAddSongExtraInstrument}
            >
              <Plus size={14} /> この曲に楽器を追加
            </button>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            <Plus size={16} /> 曲を追加
          </button>
        </form>
      </div>

      <div className="glass-card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>登録済み曲リスト</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {state.songs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>登録されている曲はありません。</p>
          ) : (
            state.songs.map(song => {
              const isEditing = editingSongId === song.id;
              return (
                <div key={song.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{song.name}</strong>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {isEditing ? (
                        <>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleSaveEditSong(song.id)}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          >
                            保存
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={handleCancelEditSong}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-secondary btn-icon"
                            onClick={() => handleStartEditSong(song)}
                            title="編集"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button className="btn btn-secondary btn-icon" onClick={() => handleRemoveSong(song.id)}>
                            <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.25rem 0' }}>パート数を変更 (「-」にすると編成から除外)</p>
                      {state.instruments.map(inst => (
                        <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', flex: '1', minWidth: '100px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {inst.name}
                          </span>
                          <select
                            className="form-control"
                            style={{ padding: '0.3rem 0.45rem', width: '75px', fontSize: '0.82rem' }}
                            value={editSongParts[inst.id] ?? 0}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setEditSongParts(prev => ({ ...prev, [inst.id]: val }));
                            }}
                          >
                            {PART_COUNT_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                      {/* Extra instruments only in this song */}
                      {Object.keys(song.parts)
                        .filter(instId => !state.instruments.some(i => i.id === instId))
                        .map(instId => {
                          const instName = instId;
                          return (
                            <div key={instId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.82rem', flex: '1', color: 'var(--text-muted)' }}>{instName}</span>
                              <select
                                className="form-control"
                                style={{ padding: '0.3rem 0.45rem', width: '75px', fontSize: '0.82rem' }}
                                value={editSongParts[instId] ?? 0}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setEditSongParts(prev => ({ ...prev, [instId]: val }));
                                }}
                              >
                                {PART_COUNT_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      {/* Edit mode: add extra instrument */}
                      {editSongExtraInsts.map(inst => (
                        <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', flex: '1', color: 'var(--primary)' }}>
                            {inst.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(追加)</span>
                          </span>
                          <select
                            className="form-control"
                            style={{ padding: '0.3rem 0.45rem', width: '75px', fontSize: '0.82rem' }}
                            value={editSongParts[inst.id] ?? 1}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setEditSongParts(prev => ({ ...prev, [inst.id]: val }));
                            }}
                          >
                            {PART_COUNT_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon"
                            onClick={() => {
                              setEditSongExtraInsts(prev => prev.filter(i => i.id !== inst.id));
                              setEditSongParts(prev => { const n = { ...prev }; delete n[inst.id]; return n; });
                            }}
                          >
                            <Trash2 size={12} style={{ color: 'var(--danger)' }} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ marginTop: '0.25rem', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                        onClick={handleAddEditSongExtraInstrument}
                      >
                        <Plus size={12} /> 楽器を追加
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {state.instruments.map(inst => {
                        const count = song.parts[inst.id] || 0;
                        if (count <= 0) return null;
                        return (
                          <span key={inst.id} className="badge badge-primary">
                            {inst.name}: {count}
                          </span>
                        );
                      })}
                      {Object.keys(song.parts)
                        .filter(instId => !state.instruments.some(i => i.id === instId) && song.parts[instId] > 0)
                        .map(instId => (
                          <span key={instId} className="badge badge-secondary">
                            {instId}: {song.parts[instId]}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 次のステップへ */}
        <div className="next-step-bar" style={{ marginTop: '1.5rem' }}>
          <button
            type="button"
            className="btn btn-primary btn-next-step"
            onClick={onProceedToNext}
          >
            次へ: 1-3 重複NG設定へ <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
