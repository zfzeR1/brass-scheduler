import React, { useState } from 'react';
import type { ScheduleState, DuplicateNGPair, PartReference } from '../../types';
import { removeNGPairWithCascade } from '../../utils/scheduleIntegrity';
import { formatPartName } from '../../utils/scheduler';
import { Plus, Trash2, ChevronRight } from 'lucide-react';

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">曲</label>
                <select
                  className="form-control"
                  value={ngPartA.songId}
                  onChange={e => setNgPartA({ songId: e.target.value, instrumentId: '', partIndex: 0 })}
                  required
                >
                  <option value="">曲を選択</option>
                  {state.songs.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">楽器</label>
                <select
                  className="form-control"
                  value={ngPartA.instrumentId}
                  onChange={e => setNgPartA(prev => ({ ...prev, instrumentId: e.target.value, partIndex: 0 }))}
                  required
                  disabled={!ngPartA.songId}
                >
                  <option value="">{ngPartA.songId ? '選択' : '曲を先に選択'}</option>
                  {ngPartA.songId && (() => {
                    const songA = state.songs.find(s => s.id === ngPartA.songId);
                    return state.instruments
                      .filter(i => songA?.parts[i.id] && songA.parts[i.id] > 0)
                      .map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ));
                  })()}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">パート</label>
                <select
                  className="form-control"
                  value={ngPartA.partIndex}
                  onChange={e => setNgPartA(prev => ({ ...prev, partIndex: Number(e.target.value) }))}
                  required
                  disabled={!ngPartA.instrumentId}
                >
                  {!ngPartA.instrumentId ? (
                    <option value="0">楽器を先に選択</option>
                  ) : (
                    Array.from({
                      length: state.songs.find(s => s.id === ngPartA.songId)?.parts[ngPartA.instrumentId] || 0
                    }).map((_, idx) => (
                      <option key={idx} value={idx}>
                        {formatPartName(ngPartA.instrumentId, idx, ngPartA.songId, state.songs, state.instruments)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Separator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingTop: '1.5rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-muted)', userSelect: 'none' }}>⇔</span>
            </div>

            {/* Side B */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">曲</label>
                <select
                  className="form-control"
                  value={ngPartB.songId}
                  onChange={e => setNgPartB({ songId: e.target.value, instrumentId: '', partIndex: 0 })}
                  required
                >
                  <option value="">曲を選択</option>
                  {state.songs.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">楽器</label>
                <select
                  className="form-control"
                  value={ngPartB.instrumentId}
                  onChange={e => setNgPartB(prev => ({ ...prev, instrumentId: e.target.value, partIndex: 0 }))}
                  required
                  disabled={!ngPartB.songId}
                >
                  <option value="">{ngPartB.songId ? '選択' : '曲を先に選択'}</option>
                  {ngPartB.songId && (() => {
                    const songB = state.songs.find(s => s.id === ngPartB.songId);
                    return state.instruments
                      .filter(i => songB?.parts[i.id] && songB.parts[i.id] > 0)
                      .map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ));
                  })()}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">パート</label>
                <select
                  className="form-control"
                  value={ngPartB.partIndex}
                  onChange={e => setNgPartB(prev => ({ ...prev, partIndex: Number(e.target.value) }))}
                  required
                  disabled={!ngPartB.instrumentId}
                >
                  {!ngPartB.instrumentId ? (
                    <option value="0">楽器を先に選択</option>
                  ) : (
                    Array.from({
                      length: state.songs.find(s => s.id === ngPartB.songId)?.parts[ngPartB.instrumentId] || 0
                    }).map((_, idx) => (
                      <option key={idx} value={idx}>
                        {formatPartName(ngPartB.instrumentId, idx, ngPartB.songId, state.songs, state.instruments)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
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
