import React, { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';

export interface AddExtraInstrumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
  existingNames: string[];
}

export default function AddExtraInstrumentModal({
  isOpen,
  onClose,
  onAdd,
  existingNames
}: AddExtraInstrumentModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('楽器名を入力してください。');
      return;
    }
    if (existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
      setError('この楽器は既に登録されています。');
      return;
    }

    onAdd(trimmed);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '420px', width: '92%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            この曲に楽器を追加
          </h3>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.82rem' }}>追加する楽器名</label>
            <input
              ref={inputRef}
              type="text"
              className="form-control"
              placeholder="例: ピッコロ、ハープ、チェレスタ"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
            />
            {error && (
              <p style={{ fontSize: '0.75rem', color: 'var(--danger)', margin: '0.35rem 0 0 0' }}>
                {error}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Plus size={14} /> 追加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
