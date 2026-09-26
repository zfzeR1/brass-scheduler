import { useState, useEffect } from 'react';
import type { Entry, Song, Instrument } from '../../../types';
import { getSongParts } from './entryHelpers';
import { X, CheckCheck, XSquare } from 'lucide-react';

export interface SectionEntryEditModalProps {
  entry: Entry | null;
  isOpen: boolean;
  songs: Song[];
  instruments: Instrument[];
  onSave: (updatedEntry: Entry) => void;
  onClose: () => void;
}

export default function SectionEntryEditModal({
  entry,
  isOpen,
  songs,
  instruments,
  onSave,
  onClose
}: SectionEntryEditModalProps) {
  const [section, setSection] = useState<string>(() => entry?.section || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(() => entry?.priority || 'medium');
  const [parts, setParts] = useState<Array<{ instrumentId: string; partIndex: number }>>(() => entry ? [...entry.parts] : []);

  useEffect(() => {
    if (entry) {
      setSection(entry.section);
      setPriority(entry.priority);
      setParts([...entry.parts]);
    }
  }, [entry, isOpen]);

  if (!isOpen || !entry) {
    return null;
  }

  const song = songs.find(s => s.id === entry.songId);
  const availableParts = getSongParts(entry.songId, songs, instruments);

  const togglePart = (instrumentId: string, partIndex: number) => {
    const isChecked = parts.some(p => p.instrumentId === instrumentId && p.partIndex === partIndex);
    if (isChecked) {
      setParts(prev => prev.filter(p => !(p.instrumentId === instrumentId && p.partIndex === partIndex)));
    } else {
      setParts(prev => [...prev, { instrumentId, partIndex }]);
    }
  };

  const handleSelectAll = () => {
    setParts(availableParts.map(p => ({
      instrumentId: p.instrumentId,
      partIndex: p.partIndex
    })));
  };

  const handleClearAll = () => {
    setParts([]);
  };

  const handleSave = () => {
    const trimmedSection = section.trim();
    if (!trimmedSection || parts.length === 0) return;

    onSave({
      ...entry,
      section: trimmedSection,
      priority,
      parts: [...parts]
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '540px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              セクション練習の編集
            </h2>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              対象曲: <strong style={{ color: 'var(--text-primary)' }}>{song?.name || '不明'}</strong>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.82rem' }}>小節・セクション</label>
            <input
              type="text"
              className="form-control"
              value={section}
              onChange={e => setSection(e.target.value)}
              placeholder="例: 1-16小節、練習記号A"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.82rem' }}>優先度</label>
            <select
              className="form-control"
              value={priority}
              onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
            >
              <option value="high">高 (優先してスケジューリング)</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.82rem', margin: 0 }}>
                参加パート ({parts.length}/{availableParts.length}パート選択中)
              </label>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="btn btn-secondary"
                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  <CheckCheck size={12} /> 全選択
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="btn btn-secondary"
                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  <XSquare size={12} /> 全解除
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '220px', overflowY: 'auto', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
              {availableParts.map(p => {
                const isChecked = parts.some(
                  ep => ep.instrumentId === p.instrumentId && ep.partIndex === p.partIndex
                );
                return (
                  <button
                    key={`${p.instrumentId}_${p.partIndex}`}
                    type="button"
                    onClick={() => togglePart(p.instrumentId, p.partIndex)}
                    className={`badge ${isChecked ? 'badge-primary' : 'badge-secondary'}`}
                    style={{
                      cursor: 'pointer',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      opacity: isChecked ? 1 : 0.45,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {parts.length === 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.35rem' }}>
                ※ 少なくとも1つ以上の参加パートを選択してください。
              </div>
            )}
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
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!section.trim() || parts.length === 0}
              style={{ flex: 1, padding: '0.6rem' }}
            >
              変更を保存する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
