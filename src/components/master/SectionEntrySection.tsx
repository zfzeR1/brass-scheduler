import React, { useState } from 'react';
import type { ScheduleState, Entry } from '../../types';
import { removeEntryWithCascade } from '../../utils/scheduleIntegrity';
import { formatPartName } from '../../utils/scheduler';
import { Plus, Trash2, Edit3, ArrowUp, ArrowDown, CheckSquare, Square, ChevronRight } from 'lucide-react';

export interface SectionEntrySectionProps {
  state: ScheduleState;
  setState: React.Dispatch<React.SetStateAction<ScheduleState>>;
  onProceedToSchedule: () => void;
}

export default function SectionEntrySection({
  state,
  setState,
  onProceedToSchedule
}: SectionEntrySectionProps) {
  const [entrySongId, setEntrySongId] = useState<string>('');
  const [entryParts, setEntryParts] = useState<Array<{ instrumentId: string; partIndex: number }>>([]);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editSection, setEditSection] = useState<string>('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editParts, setEditParts] = useState<Array<{ instrumentId: string; partIndex: number }>>([]);

  const getSongParts = (songId: string): Array<{ instrumentId: string; partIndex: number; label: string }> => {
    const song = state.songs.find(s => s.id === songId);
    if (!song) return [];

    const list: Array<{ instrumentId: string; partIndex: number; label: string }> = [];
    for (const instId of Object.keys(song.parts)) {
      const count = song.parts[instId];
      for (let idx = 0; idx < count; idx++) {
        list.push({
          instrumentId: instId,
          partIndex: idx,
          label: formatPartName(instId, idx, songId, state.songs, state.instruments)
        });
      }
    }
    return list;
  };

  const toggleEntryPart = (instrumentId: string, partIndex: number) => {
    const exists = entryParts.some(p => p.instrumentId === instrumentId && p.partIndex === partIndex);
    if (exists) {
      setEntryParts(prev => prev.filter(p => !(p.instrumentId === instrumentId && p.partIndex === partIndex)));
    } else {
      setEntryParts(prev => [...prev, { instrumentId, partIndex }]);
    }
  };

  const handleAddEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const section = formData.get('section') as string;
    const priority = (formData.get('priority') as 'low' | 'medium' | 'high') || 'medium';

    if (!entrySongId || !section || entryParts.length === 0) return;

    const newEntry: Entry = {
      id: 'entry-' + Date.now(),
      songId: entrySongId,
      section,
      parts: [...entryParts],
      priority
    };

    setState(prev => ({
      ...prev,
      entries: [...prev.entries, newEntry]
    }));

    setEntryParts([]);
    e.currentTarget.reset();
  };

  const handleRemoveEntry = (id: string) => {
    setState(prev => removeEntryWithCascade(prev, id));
  };

  const handleStartEditEntry = (entry: Entry) => {
    setEditingEntryId(entry.id);
    setEditSection(entry.section);
    setEditPriority(entry.priority);
    setEditParts([...entry.parts]);
  };

  const handleSaveEditEntry = (id: string) => {
    setState(prev => {
      const nextEntries = prev.entries.map(e => e.id === id ? { ...e, section: editSection, priority: editPriority, parts: editParts } : e);
      const targetEntry = nextEntries.find(e => e.id === id);
      const nextAssignments = prev.assignments.map(asm => {
        if (asm.entryId === id && targetEntry) {
          return {
            ...asm,
            parts: targetEntry.parts.map(p => ({
              instrumentId: p.instrumentId,
              partIndex: p.partIndex,
              songId: targetEntry.songId
            }))
          };
        }
        return asm;
      });
      return {
        ...prev,
        entries: nextEntries,
        assignments: nextAssignments
      };
    });
    setEditingEntryId(null);
  };

  const handleCancelEditEntry = () => {
    setEditingEntryId(null);
  };

  const handleMoveEntry = (index: number, direction: 'up' | 'down') => {
    setState(prev => {
      const list = [...prev.entries];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      
      return {
        ...prev,
        entries: list
      };
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 新規追加 */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>セクション練習の追加</h2>
        <form onSubmit={handleAddEntry} className="form-grid-entry">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">対象曲</label>
              <select
                className="form-control"
                value={entrySongId}
                onChange={e => {
                  setEntrySongId(e.target.value);
                  setEntryParts([]);
                }}
                required
              >
                <option value="">曲を選択</option>
                {state.songs.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">小節・セクション</label>
              <input name="section" placeholder="例: 1-16小節、練習記号A" className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">優先度</label>
              <select name="priority" className="form-control" defaultValue="medium">
                <option value="high">高 (優先してスケジューリング)</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 'auto' }}>
              <Plus size={16} /> セクション練習を追加
            </button>
          </div>

          {/* 参加パート選択 */}
          <div className="grid-span-2">
            <label className="form-label" style={{ marginBottom: '1rem' }}>参加パート (複数選択)</label>
            {entrySongId ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                {getSongParts(entrySongId).map(p => {
                  const isChecked = entryParts.some(
                    ep => ep.instrumentId === p.instrumentId && ep.partIndex === p.partIndex
                  );
                  return (
                    <div
                      key={`${p.instrumentId}_${p.partIndex}`}
                      onClick={() => toggleEntryPart(p.instrumentId, p.partIndex)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        background: isChecked ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border-color)'}`,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {isChecked ? <CheckSquare size={16} style={{ color: 'var(--primary)' }} /> : <Square size={16} />}
                      <span style={{ fontSize: '0.85rem' }}>{p.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ height: '150px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                対象曲を選択すると、参加可能なパート一覧が表示されます。
              </div>
            )}
          </div>
        </form>
      </div>

      {/* 一覧 */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>登録済みのセクション練習一覧 ({state.entries.length}件)</h2>
        {state.entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            まだセクション練習が登録されていません。上のフォームから登録してください。
          </div>
        ) : (
          <>
            {/* PC用: テーブル表示 */}
            <div className="entries-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>曲名</th>
                    <th>小節・セクション</th>
                    <th>参加パート ({state.instruments.length}種)</th>
                    <th>優先度</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {state.entries.map((entry, idx) => {
                    const song = state.songs.find(s => s.id === entry.songId);
                    const isEditing = editingEntryId === entry.id;
                    return (
                      <tr key={entry.id}>
                        <td style={{ fontWeight: 600 }}>{song?.name || '不明'}</td>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              className="form-control"
                              value={editSection}
                              onChange={e => setEditSection(e.target.value)}
                              style={{ minWidth: '120px' }}
                            />
                          ) : (
                            entry.section
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '400px' }}>
                              {getSongParts(entry.songId).map(p => {
                                const isChecked = editParts.some(
                                  ep => ep.instrumentId === p.instrumentId && ep.partIndex === p.partIndex
                                );
                                return (
                                  <span
                                    key={`${p.instrumentId}_${p.partIndex}`}
                                    onClick={() => {
                                      if (isChecked) {
                                        setEditParts(prev => prev.filter(ep => !(ep.instrumentId === p.instrumentId && ep.partIndex === p.partIndex)));
                                      } else {
                                        setEditParts(prev => [...prev, { instrumentId: p.instrumentId, partIndex: p.partIndex }]);
                                      }
                                    }}
                                    className={`badge ${isChecked ? 'badge-primary' : 'badge-secondary'}`}
                                    style={{ cursor: 'pointer', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', opacity: isChecked ? 1 : 0.4 }}
                                  >
                                    {p.label}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '400px' }}>
                              {entry.parts.map(p => {
                                return (
                                  <span key={`${p.instrumentId}_${p.partIndex}`} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                    {formatPartName(p.instrumentId, p.partIndex, entry.songId, state.songs, state.instruments)}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <select
                              className="form-control"
                              value={editPriority}
                              onChange={e => setEditPriority(e.target.value as 'low' | 'medium' | 'high')}
                              style={{ width: '80px', padding: '0.2rem' }}
                            >
                              <option value="high">高</option>
                              <option value="medium">中</option>
                              <option value="low">低</option>
                            </select>
                          ) : (
                            <>
                              {entry.priority === 'high' && <span className="badge badge-danger">高</span>}
                              {entry.priority === 'medium' && <span className="badge badge-warning">中</span>}
                              {entry.priority === 'low' && <span className="badge badge-success">低</span>}
                            </>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button className="btn btn-primary" onClick={() => handleSaveEditEntry(entry.id)} style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                                保存
                              </button>
                              <button className="btn btn-secondary" onClick={handleCancelEditEntry} style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                                取消
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-icon"
                                disabled={idx === 0}
                                onClick={() => handleMoveEntry(idx, 'up')}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-icon"
                                disabled={idx === state.entries.length - 1}
                                onClick={() => handleMoveEntry(idx, 'down')}
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => handleStartEditEntry(entry)}
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                              >
                                編集
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-icon"
                                onClick={() => handleRemoveEntry(entry.id)}
                              >
                                <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* スマホ用: 1カラム・カード型スタック表示 */}
            <div className="entries-cards-container">
              {state.entries.map((entry, idx) => {
                const song = state.songs.find(s => s.id === entry.songId);
                const isEditing = editingEntryId === entry.id;

                if (isEditing) {
                  return (
                    <div key={entry.id} className="entry-card entry-card-editing">
                      <div className="entry-card-header">
                        <span className="entry-card-song">{song?.name || '不明'}</span>
                        <span className="badge badge-primary">編集中</span>
                      </div>

                      <div className="entry-card-edit-body">
                        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>小節・セクション</label>
                          <input
                            type="text"
                            className="form-control"
                            value={editSection}
                            onChange={e => setEditSection(e.target.value)}
                            placeholder="例: 1-16小節、練習記号A"
                            required
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>優先度</label>
                          <select
                            className="form-control"
                            value={editPriority}
                            onChange={e => setEditPriority(e.target.value as 'low' | 'medium' | 'high')}
                          >
                            <option value="high">高 (優先してスケジューリング)</option>
                            <option value="medium">中</option>
                            <option value="low">低</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>参加パート (タップで選択/解除)</label>
                          <div className="entry-card-part-badges">
                            {getSongParts(entry.songId).map(p => {
                              const isChecked = editParts.some(
                                ep => ep.instrumentId === p.instrumentId && ep.partIndex === p.partIndex
                              );
                              return (
                                <button
                                  key={`${p.instrumentId}_${p.partIndex}`}
                                  type="button"
                                  onClick={() => {
                                    if (isChecked) {
                                      setEditParts(prev => prev.filter(ep => !(ep.instrumentId === p.instrumentId && ep.partIndex === p.partIndex)));
                                    } else {
                                      setEditParts(prev => [...prev, { instrumentId: p.instrumentId, partIndex: p.partIndex }]);
                                    }
                                  }}
                                  className={`badge ${isChecked ? 'badge-primary' : 'badge-secondary'}`}
                                  style={{
                                    cursor: 'pointer',
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: '6px',
                                    fontSize: '0.8rem',
                                    border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                    opacity: isChecked ? 1 : 0.5,
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="entry-card-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleCancelEditEntry}
                            style={{ flex: 1, padding: '0.55rem' }}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleSaveEditEntry(entry.id)}
                            style={{ flex: 1, padding: '0.55rem' }}
                          >
                            保存する
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={entry.id} className="entry-card">
                    <div className="entry-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {entry.priority === 'high' && <span className="badge badge-danger">高</span>}
                        {entry.priority === 'medium' && <span className="badge badge-warning">中</span>}
                        {entry.priority === 'low' && <span className="badge badge-success">低</span>}
                        <span className="entry-card-song">{song?.name || '不明'}</span>
                      </div>

                      <div className="entry-card-order-btns">
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon"
                          disabled={idx === 0}
                          onClick={() => handleMoveEntry(idx, 'up')}
                          title="上へ移動"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon"
                          disabled={idx === state.entries.length - 1}
                          onClick={() => handleMoveEntry(idx, 'down')}
                          title="下へ移動"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="entry-card-section-title">
                      {entry.section}
                    </div>

                    <div className="entry-card-parts-section">
                      <div className="entry-card-parts-label">
                        参加パート ({entry.parts.length}パート)
                      </div>
                      <div className="entry-card-part-tags">
                        {entry.parts.map(p => (
                          <span
                            key={`${p.instrumentId}_${p.partIndex}`}
                            className="entry-part-tag"
                          >
                            {formatPartName(p.instrumentId, p.partIndex, entry.songId, state.songs, state.instruments)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="entry-card-footer">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleStartEditEntry(entry)}
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Edit3 size={14} /> 編集
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon"
                        onClick={() => handleRemoveEntry(entry.id)}
                        title="削除"
                        style={{ padding: '0.45rem' }}
                      >
                        <Trash2 size={15} style={{ color: 'var(--danger)' }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 全設定完了！STEP 2へ */}
      <div className="next-step-bar" style={{ marginTop: '1.5rem' }}>
        <button
          type="button"
          className="btn btn-primary btn-next-step"
          onClick={onProceedToSchedule}
        >
          全設定完了！STEP 2: スケジュール生成へ進む <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
