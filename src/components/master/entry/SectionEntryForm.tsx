import React, { useState } from 'react';
import type { Song, Instrument, Entry } from '../../../types';
import { getSongParts } from './entryHelpers';
import { Plus, CheckSquare, Square, CheckCheck, XSquare } from 'lucide-react';

export interface SectionEntryFormProps {
  songs: Song[];
  instruments: Instrument[];
  onAddEntry: (entry: Omit<Entry, 'id'>) => void;
}

export default function SectionEntryForm({
  songs,
  instruments,
  onAddEntry
}: SectionEntryFormProps) {
  const [entrySongId, setEntrySongId] = useState<string>('');
  const [section, setSection] = useState<string>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [entryParts, setEntryParts] = useState<Array<{ instrumentId: string; partIndex: number }>>([]);

  const availableParts = entrySongId ? getSongParts(entrySongId, songs, instruments) : [];

  const toggleEntryPart = (instrumentId: string, partIndex: number) => {
    const exists = entryParts.some(p => p.instrumentId === instrumentId && p.partIndex === partIndex);
    if (exists) {
      setEntryParts(prev => prev.filter(p => !(p.instrumentId === instrumentId && p.partIndex === partIndex)));
    } else {
      setEntryParts(prev => [...prev, { instrumentId, partIndex }]);
    }
  };

  const handleSelectAllParts = () => {
    setEntryParts(availableParts.map(p => ({
      instrumentId: p.instrumentId,
      partIndex: p.partIndex
    })));
  };

  const handleClearAllParts = () => {
    setEntryParts([]);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedSection = section.trim();

    if (!entrySongId || !trimmedSection || entryParts.length === 0) {
      return;
    }

    onAddEntry({
      songId: entrySongId,
      section: trimmedSection,
      priority,
      parts: [...entryParts]
    });

    // 入力欄のリセット
    setSection('');
    setEntryParts([]);
  };

  return (
    <div className="glass-card">
      <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>セクション練習の追加</h2>
      <form onSubmit={handleSubmit} className="form-grid-entry">
        {/* 左側: 基本情報 */}
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
              {songs.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">小節・セクション</label>
            <input
              name="section"
              value={section}
              onChange={e => setSection(e.target.value)}
              placeholder="例: 1-16小節、練習記号A"
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">優先度</label>
            <select
              name="priority"
              className="form-control"
              value={priority}
              onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
            >
              <option value="high">高 (優先してスケジューリング)</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: 'auto' }}
            disabled={!entrySongId || !section.trim() || entryParts.length === 0}
          >
            <Plus size={16} /> セクション練習を追加
          </button>
        </div>

        {/* 右側: 参加パート選択 */}
        <div className="grid-span-2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ margin: 0 }}>
              参加パート (複数選択)
              {entryParts.length > 0 && (
                <span style={{ marginLeft: '0.5rem', color: 'var(--primary)', fontWeight: 600 }}>
                  ({entryParts.length}パート選択中)
                </span>
              )}
            </label>
            {entrySongId && availableParts.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={handleSelectAllParts}
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <CheckCheck size={13} /> 全選択
                </button>
                <button
                  type="button"
                  onClick={handleClearAllParts}
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <XSquare size={13} /> 全解除
                </button>
              </div>
            )}
          </div>

          {entrySongId ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              {availableParts.map(p => {
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
  );
}
