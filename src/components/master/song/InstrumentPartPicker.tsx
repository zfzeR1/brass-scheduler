import type { Instrument } from '../../../types';
import { Plus, Trash2 } from 'lucide-react';

export const PART_COUNT_OPTIONS = [
  { value: 0, label: '-' },
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3rd' },
  { value: 4, label: '4th' }
];

export interface InstrumentPartPickerProps {
  instruments: Instrument[];
  extraInstruments: Instrument[];
  parts: Record<string, number>;
  defaultParts?: Record<string, number>;
  onChangePartCount: (instrumentId: string, count: number) => void;
  onRemoveExtraInstrument?: (instrumentId: string) => void;
  onOpenAddExtraInstrument?: () => void;
  maxHeight?: string;
  isCompact?: boolean;
}

export default function InstrumentPartPicker({
  instruments,
  extraInstruments,
  parts,
  defaultParts = {},
  onChangePartCount,
  onRemoveExtraInstrument,
  onOpenAddExtraInstrument,
  maxHeight = '300px',
  isCompact = false
}: InstrumentPartPickerProps) {
  // マスタにも extraInstruments にも含まれていないが、parts にキーが存在する楽器（既存データの保全）
  const knownIds = new Set([...instruments.map(i => i.id), ...extraInstruments.map(i => i.id)]);
  const customIds = Object.keys(parts).filter(id => !knownIds.has(id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: isCompact ? '0.35rem' : '0.5rem',
          maxHeight,
          overflowY: 'auto',
          padding: '0.25rem'
        }}
      >
        {/* 標準楽器 */}
        {instruments.map(inst => {
          const currentCount = parts[inst.id] ?? defaultParts[inst.id] ?? 0;
          return (
            <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: isCompact ? '0.82rem' : '0.85rem',
                  flex: '1',
                  minWidth: '100px',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
              >
                {inst.name}
              </span>
              <select
                className="form-control"
                style={{
                  padding: isCompact ? '0.3rem 0.45rem' : '0.35rem 0.4rem',
                  width: '75px',
                  fontSize: isCompact ? '0.82rem' : '0.85rem'
                }}
                value={currentCount}
                onChange={e => onChangePartCount(inst.id, Number(e.target.value))}
              >
                {PART_COUNT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          );
        })}

        {/* 固有・追加楽器 (extraInstruments) */}
        {extraInstruments.map(inst => {
          const currentCount = parts[inst.id] ?? 1;
          return (
            <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: isCompact ? '0.82rem' : '0.85rem',
                  flex: '1',
                  minWidth: '100px',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  color: 'var(--primary)'
                }}
              >
                {inst.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(追加)</span>
              </span>
              <select
                className="form-control"
                style={{
                  padding: isCompact ? '0.3rem 0.45rem' : '0.35rem 0.4rem',
                  width: '75px',
                  fontSize: isCompact ? '0.82rem' : '0.85rem'
                }}
                value={currentCount}
                onChange={e => onChangePartCount(inst.id, Number(e.target.value))}
              >
                {PART_COUNT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {onRemoveExtraInstrument && (
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  onClick={() => onRemoveExtraInstrument(inst.id)}
                  title="削除"
                  aria-label={`${inst.name}を削除`}
                >
                  <Trash2 size={12} style={{ color: 'var(--danger)' }} />
                </button>
              )}
            </div>
          );
        })}

        {/* 過去データ等で登録されているその他楽器 */}
        {customIds.map(instId => {
          const currentCount = parts[instId] ?? 0;
          return (
            <div key={instId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: isCompact ? '0.82rem' : '0.85rem',
                  flex: '1',
                  minWidth: '100px',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  color: 'var(--text-muted)'
                }}
              >
                {instId}
              </span>
              <select
                className="form-control"
                style={{
                  padding: isCompact ? '0.3rem 0.45rem' : '0.35rem 0.4rem',
                  width: '75px',
                  fontSize: isCompact ? '0.82rem' : '0.85rem'
                }}
                value={currentCount}
                onChange={e => onChangePartCount(instId, Number(e.target.value))}
              >
                {PART_COUNT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {onOpenAddExtraInstrument && (
        <button
          type="button"
          className="btn btn-secondary"
          style={{
            alignSelf: 'flex-start',
            marginTop: '0.25rem',
            fontSize: isCompact ? '0.75rem' : '0.8rem',
            padding: isCompact ? '0.3rem 0.6rem' : '0.4rem 0.75rem'
          }}
          onClick={onOpenAddExtraInstrument}
        >
          <Plus size={14} /> この曲に楽器を追加
        </button>
      )}
    </div>
  );
}
