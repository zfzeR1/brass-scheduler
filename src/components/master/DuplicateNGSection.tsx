import React, { useState } from 'react';
import type { ScheduleState, DuplicateNGPair, PartReference } from '../../types';
import { removeNGPairWithCascade } from '../../utils/scheduleIntegrity';
import { formatPartName } from '../../utils/scheduler';
import { Plus, Trash2, ChevronRight } from 'lucide-react';
import PartReferencePicker from '../shared/PartReferencePicker';

export interface DuplicateNGSectionProps {
  state: ScheduleState;
  setState: React.Dispatch<React.SetStateAction<ScheduleState>>;
  onProceedToNext: () => void;
}

export default function DuplicateNGSection({ state, setState, onProceedToNext }: DuplicateNGSectionProps) {
  const [ngPartA, setNgPartA] = useState<PartReference>({ songId: '', instrumentId: '', partIndex: 0 });
  const [ngPartB, setNgPartB] = useState<PartReference>({ songId: '', instrumentId: '', partIndex: 0 });

  const handleAddNGPair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ngPartA.songId || !ngPartA.instrumentId || !ngPartB.songId || !ngPartB.instrumentId) return;

    const newPair: DuplicateNGPair = {
      id: 'ng-' + Date.now(),
      partA: { ...ngPartA },
      partB: { ...ngPartB }
    };

    setState(prev => ({
      ...prev,
      duplicateNGPairs: [...prev.duplicateNGPairs, newPair]
    }));
  };

  const handleRemoveNGPair = (id: string) => {
    setState(prev => removeNGPairWithCascade(prev, id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 重複NG設定フォーム */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>重複NG設定</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          異なる曲の間で、同じ人が兼任しているパートを登録します。登録されたパート同士は、絶対に同じ時間帯に並行して割り当てられません。
        </p>

        <form onSubmit={handleAddNGPair} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-grid-ng">
            {/* Side A */}
            <PartReferencePicker
              songs={state.songs}
              instruments={state.instruments}
              value={ngPartA}
              onChange={setNgPartA}
              required
            />

            {/* Separator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingTop: '1.5rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-muted)', userSelect: 'none' }}>⇔</span>
            </div>

            {/* Side B */}
            <PartReferencePicker
              songs={state.songs}
              instruments={state.instruments}
              value={ngPartB}
              onChange={setNgPartB}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            <Plus size={16} /> 重複NGペアを追加
          </button>
        </form>
      </div>

      {/* 登録済みの重複NG一覧 */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>登録済みの重複NG一覧 ({state.duplicateNGPairs.length}件)</h2>
        {state.duplicateNGPairs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            現在、手動登録された重複NGはありません。（異なる曲で同一楽器・同一パートの場合は自動で重複回避されます）
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>パートA</th>
                  <th>パートB</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {state.duplicateNGPairs.map(pair => {
                  const songA = state.songs.find(s => s.id === pair.partA.songId);
                  const songB = state.songs.find(s => s.id === pair.partB.songId);

                  return (
                    <tr key={pair.id}>
                      <td style={{ fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600 }}>{songA?.name || '不明'}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{formatPartName(pair.partA.instrumentId, pair.partA.partIndex, pair.partA.songId, state.songs, state.instruments)}</div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 600 }}>{songB?.name || '不明'}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{formatPartName(pair.partB.instrumentId, pair.partB.partIndex, pair.partB.songId, state.songs, state.instruments)}</div>
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-icon" onClick={() => handleRemoveNGPair(pair.id)} title="削除">
                          <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 次のステップへ */}
      <div className="next-step-bar" style={{ marginTop: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-primary btn-next-step"
          onClick={onProceedToNext}
        >
          次へ: 1-4 セクション練習へ (スキップ可) <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
