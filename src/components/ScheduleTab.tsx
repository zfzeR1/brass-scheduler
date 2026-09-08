import React, { useState, useMemo } from 'react';
import type { ScheduleState, Assignment } from '../types';
import {
  calculateNumSlots,
  getSlotTimeRange,
  generateSchedule,
  evaluateSchedule,
  formatPartName
} from '../utils/scheduler';
import {
  Play,
  RotateCcw,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  Info,
  GripVertical,
  ArrowLeftRight,
  Edit3,
  X,
  Plus
} from 'lucide-react';

interface ScheduleTabProps {
  state: ScheduleState;
  setState: React.Dispatch<React.SetStateAction<ScheduleState>>;
}

export default function ScheduleTab({ state, setState }: ScheduleTabProps) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [mobileSlot, setMobileSlot] = useState(0);
  const [swapSource, setSwapSource] = useState<{ slotIndex: number; roomId: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ slotIndex: number; roomId: string } | null>(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const numSlots = useMemo(() => {
    return calculateNumSlots(
      state.timeSettings.startTime,
      state.timeSettings.endTime,
      state.timeSettings.slotDuration,
      state.timeSettings.intervalDuration
    );
  }, [state.timeSettings]);

  // 現在のスケジュールに対する評価結果（違反リスト）
  const evaluation = useMemo(() => {
    if (state.assignments.length === 0) return { score: 0, violations: [] };
    return evaluateSchedule(
      state.assignments,
      state.rooms,
      state.instruments,
      state.songs,
      state.duplicateNGPairs,
      state.entries,
      numSlots
    );
  }, [state.assignments, state.rooms, state.instruments, state.songs, state.duplicateNGPairs, state.entries, numSlots]);

  // 自動スケジュール生成を実行する
  const handleAutoGenerate = (startSlot: number = 0) => {
    const updatedAssignments = generateSchedule(state, startSlot);
    setState(prev => ({
      ...prev,
      assignments: updatedAssignments
    }));
  };

  // ロックの切り替え
  const toggleLock = (slotIndex: number, roomId: string) => {
    setState(prev => {
      const updated = prev.assignments.map(asm => {
        if (asm.slotIndex === slotIndex && asm.roomId === roomId) {
          return { ...asm, isLocked: !asm.isLocked };
        }
        return asm;
      });
      return { ...prev, assignments: updated };
    });
  };

  // 2つの枠の割り当てを交換する（ドラッグ＆ドロップおよびタップ入れ替え共通）
  const handleSwapAssignments = (srcSlotIndex: number, srcRoomId: string, destSlotIndex: number, destRoomId: string) => {
    if (srcSlotIndex === destSlotIndex && srcRoomId === destRoomId) return;

    setState(prev => {
      const updated = [...prev.assignments];
      let srcIdx = updated.findIndex(
        asm => asm.slotIndex === srcSlotIndex && asm.roomId === srcRoomId
      );
      let destIdx = updated.findIndex(
        asm => asm.slotIndex === destSlotIndex && asm.roomId === destRoomId
      );

      if (srcIdx === -1) {
        updated.push({
          id: `${srcSlotIndex}_${srcRoomId}`,
          slotIndex: srcSlotIndex,
          roomId: srcRoomId,
          entryId: undefined,
          parts: [],
          isLocked: false,
          isPersonalPractice: false
        });
        srcIdx = updated.length - 1;
      }
      if (destIdx === -1) {
        updated.push({
          id: `${destSlotIndex}_${destRoomId}`,
          slotIndex: destSlotIndex,
          roomId: destRoomId,
          entryId: undefined,
          parts: [],
          isLocked: false,
          isPersonalPractice: false
        });
        destIdx = updated.length - 1;
      }

      const srcAsm = { ...updated[srcIdx] };
      const destAsm = { ...updated[destIdx] };

      // アサインデータのみを入れ替える (slotIndex や roomId はそのまま)
      updated[srcIdx] = {
        ...srcAsm,
        entryId: destAsm.entryId,
        parts: destAsm.parts,
        isPersonalPractice: destAsm.isPersonalPractice
      };

      updated[destIdx] = {
        ...destAsm,
        entryId: srcAsm.entryId,
        parts: srcAsm.parts,
        isPersonalPractice: srcAsm.isPersonalPractice
      };

      return { ...prev, assignments: updated };
    });
  };

  // 枠に特定の練習エントリーを直接割り当てる
  const handleAssignEntry = (slotIndex: number, roomId: string, entryId: string) => {
    const entry = state.entries.find(e => e.id === entryId);
    if (!entry) return;
    setState(prev => {
      const updated = [...prev.assignments];
      const idx = updated.findIndex(a => a.slotIndex === slotIndex && a.roomId === roomId);
      const newAsm: Assignment = {
        id: `${slotIndex}_${roomId}`,
        slotIndex,
        roomId,
        entryId: entry.id,
        isPersonalPractice: false,
        isLocked: idx !== -1 ? updated[idx].isLocked : false,
        parts: entry.parts.map(p => ({
          songId: entry.songId,
          instrumentId: p.instrumentId,
          partIndex: p.partIndex
        }))
      };
      if (idx !== -1) {
        updated[idx] = newAsm;
      } else {
        updated.push(newAsm);
      }
      return { ...prev, assignments: updated };
    });
  };

  // 枠を個人練習部屋に設定する
  const handleSetPersonalPractice = (slotIndex: number, roomId: string) => {
    setState(prev => {
      const updated = [...prev.assignments];
      const idx = updated.findIndex(a => a.slotIndex === slotIndex && a.roomId === roomId);
      const newAsm: Assignment = {
        id: `${slotIndex}_${roomId}`,
        slotIndex,
        roomId,
        entryId: undefined,
        isPersonalPractice: true,
        isLocked: idx !== -1 ? updated[idx].isLocked : false,
        parts: []
      };
      if (idx !== -1) {
        updated[idx] = newAsm;
      } else {
        updated.push(newAsm);
      }
      return { ...prev, assignments: updated };
    });
  };

  // 枠を空き部屋にする
  const handleSetEmpty = (slotIndex: number, roomId: string) => {
    setState(prev => {
      const updated = [...prev.assignments];
      const idx = updated.findIndex(a => a.slotIndex === slotIndex && a.roomId === roomId);
      const newAsm: Assignment = {
        id: `${slotIndex}_${roomId}`,
        slotIndex,
        roomId,
        entryId: undefined,
        isPersonalPractice: false,
        isLocked: false,
        parts: []
      };
      if (idx !== -1) {
        updated[idx] = newAsm;
      } else {
        updated.push(newAsm);
      }
      return { ...prev, assignments: updated };
    });
  };

  // --- HTML5 Drag and Drop ---
  const handleDragStart = (e: React.DragEvent, slotIndex: number, roomId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ slotIndex, roomId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, cellId: string) => {
    e.preventDefault();
    setDragOverCell(cellId);
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, destSlotIndex: number, destRoomId: string) => {
    e.preventDefault();
    setDragOverCell(null);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;

      const { slotIndex: srcSlotIndex, roomId: srcRoomId } = JSON.parse(dataStr);
      handleSwapAssignments(srcSlotIndex, srcRoomId, destSlotIndex, destRoomId);
    } catch (err) {
      console.error('Drag drop failed', err);
    }
  };



  // --- ヘルパー: 部屋にアサインされている内容を取得 ---
  const renderCellContent = (asm: Assignment) => {
    const entry = state.entries.find(e => e.id === asm.entryId);
    const song = state.songs.find(s => s.id === entry?.songId);

    if (asm.entryId && entry) {
      return (
        <div
          className={`practice-card ${asm.isLocked ? 'is-locked' : ''}`}
          draggable
          onDragStart={e => handleDragStart(e, asm.slotIndex, asm.roomId)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span title="ドラッグして部屋を入れ替え" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <GripVertical size={13} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                {song?.name || '曲名なし'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTarget({ slotIndex: asm.slotIndex, roomId: asm.roomId });
                }}
                className="btn btn-secondary btn-icon"
                style={{ padding: '2px', border: 'none', background: 'transparent' }}
                title="練習内容の変更・入替"
              >
                <Edit3 size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLock(asm.slotIndex, asm.roomId);
                }}
                className="btn btn-secondary btn-icon"
                style={{ padding: '2px', border: 'none', background: 'transparent' }}
                title={asm.isLocked ? '固定を解除' : '位置を固定 (自動生成対象外にする)'}
              >
                {asm.isLocked ? <Lock size={12} style={{ color: 'var(--warning)' }} /> : <Unlock size={12} style={{ color: 'var(--text-muted)' }} />}
              </button>
            </div>
          </div>
          <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
            {entry.section}
          </strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '0.25rem', maxHeight: '35px', overflowY: 'auto' }}>
            {entry.parts.map(p => {
              return (
                <span key={`${p.instrumentId}_${p.partIndex}`} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '1px 3px', borderRadius: '2px' }}>
                  {formatPartName(p.instrumentId, p.partIndex, entry.songId, state.songs, state.instruments)}
                </span>
              );
            })}
          </div>
        </div>
      );
    }

    if (asm.isPersonalPractice) {
      return (
        <div
          className="practice-card personal-practice"
          draggable
          onDragStart={e => handleDragStart(e, asm.slotIndex, asm.roomId)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span title="ドラッグして部屋を入れ替え" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <GripVertical size={13} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
              </span>
              <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>個人練習部屋</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTarget({ slotIndex: asm.slotIndex, roomId: asm.roomId });
                }}
                className="btn btn-secondary btn-icon"
                style={{ padding: '2px', border: 'none', background: 'transparent' }}
                title="練習内容の変更・入替"
              >
                <Edit3 size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLock(asm.slotIndex, asm.roomId);
                }}
                className="btn btn-secondary btn-icon"
                style={{ padding: '2px', border: 'none', background: 'transparent' }}
              >
                {asm.isLocked ? <Lock size={12} style={{ color: 'var(--warning)' }} /> : <Unlock size={12} />}
              </button>
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            退避中: {asm.parts.length} パート
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '0.25rem', maxHeight: '35px', overflowY: 'auto' }}>
            {asm.parts.map((p, idx) => {
              const pSong = state.songs.find(sg => sg.id === p.songId);
              return (
                <span
                  key={idx}
                  style={{ fontSize: '0.65rem', background: 'rgba(6,182,212,0.1)', padding: '1px 3px', borderRadius: '2px', color: '#22d3ee' }}
                  title={`${pSong?.name || ''} - ${formatPartName(p.instrumentId, p.partIndex, p.songId, state.songs, state.instruments)}`}
                >
                  {pSong ? `${pSong.name.substring(0,2)}:${formatPartName(p.instrumentId, p.partIndex, p.songId, state.songs, state.instruments)}` : formatPartName(p.instrumentId, p.partIndex, undefined, state.songs, state.instruments)}
                </span>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div
        onClick={() => setEditTarget({ slotIndex: asm.slotIndex, roomId: asm.roomId })}
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          cursor: 'pointer',
          borderRadius: 'var(--radius-sm)',
          transition: 'background 0.15s ease'
        }}
        title="クリックして練習を割り当て・変更"
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Plus size={12} style={{ marginRight: '3px', opacity: 0.6 }} /> 空き部屋
      </div>
    );
  };

  // スクショ用のシンプル画面切り替え
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">スケジュール自動生成・微調整</h1>
        <p className="page-subtitle">マスターデータと制約をもとに、最適な練習スケジュールを自動で生成およびドラッグ調整します。</p>
      </div>

      {/* Control Actions */}
      <div className="glass-card" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button className="btn btn-primary" onClick={() => handleAutoGenerate(0)} style={{ fontSize: '0.85rem', padding: '0.6rem 1.25rem' }}>
          <Play size={16} /> スケジュールを自動生成
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            現在のスコア:
          </span>
          <span className={`badge ${evaluation.score >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.9rem', padding: '0.35rem 0.75rem' }}>
            {evaluation.score.toLocaleString()} 点
          </span>
        </div>
      </div>

      {/* 制約チェック結果（警告/エラー表示） */}
      {state.assignments.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '2rem', borderLeft: `4px solid ${evaluation.violations.length > 0 ? 'var(--warning)' : 'var(--success)'}` }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {evaluation.violations.length > 0 ? (
              <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
            ) : (
              <CheckCircle size={18} style={{ color: 'var(--success)' }} />
            )}
            制約・最適化チェック結果
          </h2>
          {evaluation.violations.length > 0 ? (
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {evaluation.violations.slice(0, 5).map((v, idx) => (
                <li key={idx} style={{ color: v.includes('超過') || v.includes('NG') || v.includes('移動不可') ? '#f87171' : 'var(--text-secondary)' }}>
                  {v}
                </li>
              ))}
              {evaluation.violations.length > 5 && (
                <li style={{ color: 'var(--text-muted)', listStyleType: 'none', marginTop: '0.25rem' }}>
                  ほか {evaluation.violations.length - 5} 件の警告があります...
                </li>
              )}
            </ul>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>すべてのハード制約（重複NG・キャパシティ・移動不可楽器アサイン）を満たしています！</p>
          )}
        </div>
      )}

      {/* タイムテーブル表示 */}
      {state.assignments.length === 0 ? (
        <div style={{ height: '300px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
          <Info size={36} />
          <div>「スケジュールを自動生成」ボタンを押して、スケジュールを組みましょう。</div>
        </div>
      ) : (
        <div>
          {/* 操作ガイドバナー (Proposal 3) */}
          <div
            className="glass-card"
            style={{
              marginBottom: '1.25rem',
              padding: '0.85rem 1.1rem',
              borderLeft: '4px solid var(--primary)',
              background: 'rgba(79, 70, 229, 0.08)',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start'
            }}
          >
            <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>💡</span>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
                スケジュール手動調整のヒント
              </strong>
              {isMobile ? (
                <div>
                  ・部屋カードの「<strong style={{ color: 'var(--primary)' }}>⇄ 入替</strong>」をタップし、移動・入れ替え先の部屋をタップすると直感的に配置を変更できます。<br />
                  ・「<strong style={{ color: 'var(--text-primary)' }}>✏️ 変更</strong>」をタップすると、セクション練習の直接指定や空き部屋・個人練習部屋への切り替えが可能です。
                </div>
              ) : (
                <div>
                  ・カード左上の「<strong style={{ color: 'var(--text-primary)' }}>⠿</strong>」をドラッグ＆ドロップして、部屋やコマの間で自由に練習を移動・入れ替えできます。<br />
                  ・カードや空き部屋の「<strong style={{ color: 'var(--primary)' }}>✏️</strong>」をクリックすると、練習内容の直接変更や部屋の入替が可能です。
                </div>
              )}
            </div>
          </div>

          {isMobile ? (
            /* ==================== MOBILE: コマ別タイムライン表示 ==================== */
            <div>
              {/* コマ選択タブ */}
              <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', marginBottom: '1rem', paddingBottom: '0.5rem', WebkitOverflowScrolling: 'touch' }}>
                {Array.from({ length: numSlots }).map((_, s) => {
                  const timeRange = getSlotTimeRange(s, state.timeSettings.startTime, state.timeSettings.slotDuration, state.timeSettings.intervalDuration);
                  const isActive = mobileSlot === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setMobileSlot(s)}
                      style={{
                        flex: '0 0 auto',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        background: isActive ? 'rgba(79, 70, 229, 0.15)' : 'var(--bg-surface)',
                        color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.1rem',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>コマ {s + 1}</span>
                      <span>{timeRange.start}-{timeRange.end}</span>
                    </button>
                  );
                })}
              </div>

              {/* スワップ（入替/移動）選択中の案内バナー */}
              {swapSource && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid var(--warning)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <ArrowLeftRight size={14} /> 入れ替え対象を選択中
                    </div>
                    {(() => {
                      const srcSlotTime = getSlotTimeRange(swapSource.slotIndex, state.timeSettings.startTime, state.timeSettings.slotDuration, state.timeSettings.intervalDuration);
                      const srcRoom = state.rooms.find(r => r.id === swapSource.roomId);
                      const srcAsm = state.assignments.find(a => a.slotIndex === swapSource.slotIndex && a.roomId === swapSource.roomId);
                      const srcEntry = srcAsm?.entryId ? state.entries.find(e => e.id === srcAsm.entryId) : null;
                      const srcSong = srcEntry ? state.songs.find(s => s.id === srcEntry.songId) : null;
                      const label = srcEntry ? `「${srcSong?.name || ''} - ${srcEntry.section}」` : srcAsm?.isPersonalPractice ? '「個人練習」' : '「空き部屋」';
                      return (
                        <div>
                          コマ {swapSource.slotIndex + 1} ({srcSlotTime.start}-{srcSlotTime.end}) の【{srcRoom?.name}】{label}
                        </div>
                      );
                    })()}
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      👉 入れ替えたい部屋の「ここと入替」または「ここへ移動」をタップしてください
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSwapSource(null)}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', whiteSpace: 'nowrap' }}
                  >
                    <X size={12} /> 解除
                  </button>
                </div>
              )}

              {/* 選択中のコマのヘッダー */}
              {(() => {
                const timeRange = getSlotTimeRange(mobileSlot, state.timeSettings.startTime, state.timeSettings.slotDuration, state.timeSettings.intervalDuration);
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>コマ {mobileSlot + 1}</span>
                      <strong style={{ fontSize: '1.15rem', display: 'block', color: 'var(--text-primary)' }}>{timeRange.start} - {timeRange.end}</strong>
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                      onClick={() => handleAutoGenerate(mobileSlot)}
                      title="このコマ以降を再計算"
                    >
                      <RotateCcw size={12} /> ここから再計算
                    </button>
                  </div>
                );
              })()}

              {/* 部屋カード一覧（縦並び） */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {state.rooms.map(room => {
                  const asm = state.assignments.find(a => a.slotIndex === mobileSlot && a.roomId === room.id);
                  const entry = asm?.entryId ? state.entries.find(e => e.id === asm.entryId) : null;
                  const song = entry ? state.songs.find(sg => sg.id === entry.songId) : null;
                  const isSource = swapSource?.slotIndex === mobileSlot && swapSource?.roomId === room.id;
                  const hasAssignment = !!(asm?.entryId || asm?.isPersonalPractice);

                  return (
                    <div
                      key={room.id}
                      className="glass-card"
                      style={{
                        padding: '0.85rem',
                        border: isSource ? '2px solid var(--warning)' : undefined,
                        background: isSource ? 'rgba(234, 179, 8, 0.08)' : undefined,
                        borderLeft: isSource
                          ? '4px solid var(--warning)'
                          : asm?.entryId
                            ? '4px solid var(--primary)'
                            : asm?.isPersonalPractice
                              ? '4px solid var(--info)'
                              : '4px solid var(--border-color)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* 部屋名ヘッダー */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{room.name}</strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({room.capacity}人)</span>
                        </div>
                        {asm && (
                          <button
                            onClick={() => toggleLock(mobileSlot, room.id)}
                            className="btn btn-secondary btn-icon"
                            style={{ padding: '4px', border: 'none', background: 'transparent' }}
                            title={asm.isLocked ? '固定を解除' : '位置を固定'}
                          >
                            {asm.isLocked ? <Lock size={14} style={{ color: 'var(--warning)' }} /> : <Unlock size={14} style={{ color: 'var(--text-muted)' }} />}
                          </button>
                        )}
                      </div>

                      {/* 内容 */}
                      {asm?.entryId && entry ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{song?.name || '曲名なし'}</span>
                          </div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                            {entry.section}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {entry.parts.map(p => (
                              <span
                                key={`${p.instrumentId}_${p.partIndex}`}
                                style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', padding: '2px 5px', borderRadius: '3px', border: '1px solid var(--border-color)' }}
                              >
                                {formatPartName(p.instrumentId, p.partIndex, entry.songId, state.songs, state.instruments)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : asm?.isPersonalPractice ? (
                        <div>
                          <span className="badge badge-info" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>個人練習部屋</span>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            退避中: {asm.parts.length} パート
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                            {asm.parts.map((p, idx) => {
                              const pSong = state.songs.find(sg => sg.id === p.songId);
                              return (
                                <span
                                  key={idx}
                                  style={{ fontSize: '0.68rem', background: 'rgba(6,182,212,0.1)', padding: '2px 4px', borderRadius: '3px', color: '#22d3ee' }}
                                >
                                  {pSong ? `${pSong.name.substring(0,3)}:` : ''}{formatPartName(p.instrumentId, p.partIndex, p.songId, state.songs, state.instruments)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                          空き部屋
                        </div>
                      )}

                      {/* アクションボタン (入替・変更) */}
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                        {swapSource ? (
                          isSource ? (
                            <button
                              className="btn btn-secondary"
                              onClick={() => setSwapSource(null)}
                              style={{
                                width: '100%',
                                fontSize: '0.78rem',
                                padding: '0.45rem',
                                color: 'var(--warning)',
                                borderColor: 'var(--warning)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                              }}
                            >
                              <X size={13} /> 選択中 (タップして選択解除)
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary"
                              onClick={() => {
                                handleSwapAssignments(swapSource.slotIndex, swapSource.roomId, mobileSlot, room.id);
                                setSwapSource(null);
                              }}
                              style={{
                                width: '100%',
                                fontSize: '0.82rem',
                                padding: '0.45rem',
                                background: hasAssignment ? 'var(--warning)' : 'var(--primary)',
                                borderColor: hasAssignment ? 'var(--warning)' : 'var(--primary)',
                                color: hasAssignment ? '#000' : '#fff',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                              }}
                            >
                              <ArrowLeftRight size={13} /> {hasAssignment ? 'この部屋と入れ替える' : 'この空き部屋へ移動する'}
                            </button>
                          )
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setEditTarget({ slotIndex: mobileSlot, roomId: room.id })}
                              style={{
                                flex: 1,
                                fontSize: '0.76rem',
                                padding: '0.35rem 0.6rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px'
                              }}
                            >
                              <Edit3 size={12} /> 変更
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setSwapSource({ slotIndex: mobileSlot, roomId: room.id })}
                              style={{
                                flex: 1,
                                fontSize: '0.76rem',
                                padding: '0.35rem 0.6rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                color: 'var(--primary)'
                              }}
                            >
                              <ArrowLeftRight size={12} /> 入替
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ==================== DESKTOP: 従来のグリッド表示 ==================== */
            <div className="glass-card" style={{ overflowX: 'auto', padding: '1.5rem' }}>
              <div className="timetable-grid">
                {/* Header */}
                <div className="timetable-header">
                  <div style={{ fontWeight: 600 }}>時間枠</div>
                  {state.rooms.map(room => (
                    <div key={room.id} style={{ fontWeight: 600, paddingLeft: '0.5rem' }}>
                      {room.name}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                        定員: {room.capacity}人
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {Array.from({ length: numSlots }).map((_, s) => {
                  const timeRange = getSlotTimeRange(
                    s,
                    state.timeSettings.startTime,
                    state.timeSettings.slotDuration,
                    state.timeSettings.intervalDuration
                  );
                  return (
                    <div key={s} className="timetable-row">
                      {/* 時間列＆再計算トリガー */}
                      <div className="timetable-time-col">
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>コマ {s + 1}</span>
                        <strong style={{ fontSize: '0.9rem' }}>{timeRange.start} - {timeRange.end}</strong>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '0.65rem', marginTop: '0.5rem', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '2px' }}
                          onClick={() => handleAutoGenerate(s)}
                          title="このコマ以降だけを対象に、現在の割り当て（ロック含む）を引き継いで再計算します。"
                        >
                          <RotateCcw size={10} /> ここから再計算
                        </button>
                      </div>

                      {/* 各部屋のセル */}
                      {state.rooms.map(room => {
                        const key = `${s}_${room.id}`;
                        const asm = state.assignments.find(a => a.slotIndex === s && a.roomId === room.id);
                        const isDragOver = dragOverCell === key;

                        return (
                          <div
                            key={key}
                            className={`timetable-cell ${room.isPersonalPracticeCandidate ? 'personal-practice-room' : ''} ${isDragOver ? 'drag-over' : ''}`}
                            onDragOver={e => handleDragOver(e, key)}
                            onDragLeave={handleDragLeave}
                            onDrop={e => handleDrop(e, s, room.id)}
                          >
                            {asm ? renderCellContent(asm) : null}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 練習枠の変更・編集モーダル (Proposal 2) */}
      {editTarget && (
        <EditAssignmentModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          state={state}
          onAssignEntry={(entryId) => handleAssignEntry(editTarget.slotIndex, editTarget.roomId, entryId)}
          onSetPersonal={() => handleSetPersonalPractice(editTarget.slotIndex, editTarget.roomId)}
          onSetEmpty={() => handleSetEmpty(editTarget.slotIndex, editTarget.roomId)}
          onSwapWith={(otherRoomId) => handleSwapAssignments(editTarget.slotIndex, editTarget.roomId, editTarget.slotIndex, otherRoomId)}
          onToggleLock={() => toggleLock(editTarget.slotIndex, editTarget.roomId)}
        />
      )}
    </div>
  );
}

// 練習枠の直接変更・手動調整用モーダル
interface EditAssignmentModalProps {
  target: { slotIndex: number; roomId: string };
  onClose: () => void;
  state: ScheduleState;
  onAssignEntry: (entryId: string) => void;
  onSetPersonal: () => void;
  onSetEmpty: () => void;
  onSwapWith: (otherRoomId: string) => void;
  onToggleLock: () => void;
}

function EditAssignmentModal({
  target,
  onClose,
  state,
  onAssignEntry,
  onSetPersonal,
  onSetEmpty,
  onSwapWith,
  onToggleLock
}: EditAssignmentModalProps) {
  const room = state.rooms.find(r => r.id === target.roomId);
  const timeRange = getSlotTimeRange(
    target.slotIndex,
    state.timeSettings.startTime,
    state.timeSettings.slotDuration,
    state.timeSettings.intervalDuration
  );
  const asm = state.assignments.find(a => a.slotIndex === target.slotIndex && a.roomId === target.roomId);
  const currentEntry = asm?.entryId ? state.entries.find(e => e.id === asm.entryId) : null;
  const currentSong = currentEntry ? state.songs.find(s => s.id === currentEntry.songId) : null;

  const [selectedEntryId, setSelectedEntryId] = useState<string>(asm?.entryId || '');
  const [swapTargetRoomId, setSwapTargetRoomId] = useState<string>('');

  const otherRooms = state.rooms.filter(r => r.id !== target.roomId);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '520px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              練習枠の変更・手動調整
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              コマ {target.slotIndex + 1} ({timeRange.start} - {timeRange.end}) ｜ 部屋: <strong style={{ color: 'var(--text-primary)' }}>{room?.name}</strong> (定員: {room?.capacity}人)
            </div>
          </div>
          <button
            className="btn btn-secondary btn-icon"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 現在の状態 */}
        <div
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            marginBottom: '1.25rem',
            fontSize: '0.82rem'
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>現在の状態: </span>
          {currentEntry ? (
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              【{currentSong?.name || '曲名なし'}】{currentEntry.section} ({currentEntry.parts.length}パート)
            </span>
          ) : asm?.isPersonalPractice ? (
            <span style={{ fontWeight: 600, color: 'var(--info)' }}>個人練習部屋 ({asm.parts.length}パート退避中)</span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>空き部屋</span>
          )}
          {asm?.isLocked && (
            <span className="badge badge-warning" style={{ fontSize: '0.68rem', marginLeft: '0.5rem' }}>
              <Lock size={10} style={{ marginRight: '2px' }} /> 固定中
            </span>
          )}
        </div>

        {/* 1: セクション練習を割り当てる */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
            1. セクション練習を割り当てる
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              className="input"
              value={selectedEntryId}
              onChange={e => setSelectedEntryId(e.target.value)}
              style={{ flex: 1, minWidth: '200px', fontSize: '0.82rem' }}
            >
              <option value="">-- 練習エントリーを選択 --</option>
              {state.songs.map(song => {
                const songEntries = state.entries.filter(e => e.songId === song.id);
                if (songEntries.length === 0) return null;
                return (
                  <optgroup key={song.id} label={song.name}>
                    {songEntries.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.section} ({e.parts.length}パート){e.priority === 'high' ? ' [優先高]' : ''}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <button
              className="btn btn-primary"
              disabled={!selectedEntryId}
              onClick={() => {
                onAssignEntry(selectedEntryId);
                onClose();
              }}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', whiteSpace: 'nowrap' }}
            >
              割り当てる
            </button>
          </div>
        </div>

        {/* 2: 部屋の種別変更 */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
            2. 部屋の種別変更
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                onSetPersonal();
                onClose();
              }}
              style={{ flex: 1, fontSize: '0.8rem', color: 'var(--info)' }}
            >
              個人練習部屋にする
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                onSetEmpty();
                onClose();
              }}
              style={{ flex: 1, fontSize: '0.8rem' }}
            >
              空き部屋にする
            </button>
          </div>
        </div>

        {/* 3: このコマ内の別部屋と入れ替える */}
        {otherRooms.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              3. このコマ内の別部屋と入れ替える
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="input"
                value={swapTargetRoomId}
                onChange={e => setSwapTargetRoomId(e.target.value)}
                style={{ flex: 1, minWidth: '180px', fontSize: '0.82rem' }}
              >
                <option value="">-- 入替先を選択 --</option>
                {otherRooms.map(r => {
                  const oAsm = state.assignments.find(a => a.slotIndex === target.slotIndex && a.roomId === r.id);
                  const oEntry = oAsm?.entryId ? state.entries.find(e => e.id === oAsm.entryId) : null;
                  const oSong = oEntry ? state.songs.find(s => s.id === oEntry.songId) : null;
                  const label = oEntry ? `${oSong?.name || ''} - ${oEntry.section}` : oAsm?.isPersonalPractice ? '個人練習' : '空き部屋';
                  return (
                    <option key={r.id} value={r.id}>
                      {r.name}（{label}）
                    </option>
                  );
                })}
              </select>
              <button
                className="btn btn-secondary"
                disabled={!swapTargetRoomId}
                onClick={() => {
                  onSwapWith(swapTargetRoomId);
                  onClose();
                }}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeftRight size={13} /> 入れ替え
              </button>
            </div>
          </div>
        )}

        {/* 4: 位置の固定 (再計算時に維持) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              onToggleLock();
            }}
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {asm?.isLocked ? (
              <>
                <Unlock size={14} style={{ color: 'var(--warning)' }} /> 固定を解除
              </>
            ) : (
              <>
                <Lock size={14} /> この位置を固定（再計算時に維持）
              </>
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
