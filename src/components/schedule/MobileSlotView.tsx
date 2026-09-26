import type { ScheduleState } from '../../types';
import { getSlotTimeRange, formatPartName } from '../../utils/scheduler';
import { RotateCcw, ArrowLeftRight, X, Lock, Unlock, Edit3 } from 'lucide-react';

interface MobileSlotViewProps {
  state: ScheduleState;
  numSlots: number;
  mobileSlot: number;
  setMobileSlot: (slot: number) => void;
  swapSource: { slotIndex: number; roomId: string } | null;
  setSwapSource: (source: { slotIndex: number; roomId: string } | null) => void;
  onAutoGenerate: (startSlot: number) => void;
  onSwapAssignments: (srcSlotIndex: number, srcRoomId: string, destSlotIndex: number, destRoomId: string) => void;
  onToggleLock: (slotIndex: number, roomId: string) => void;
  onOpenEditModal: (target: { slotIndex: number; roomId: string }) => void;
}

export default function MobileSlotView({
  state,
  numSlots,
  mobileSlot,
  setMobileSlot,
  swapSource,
  setSwapSource,
  onAutoGenerate,
  onSwapAssignments,
  onToggleLock,
  onOpenEditModal
}: MobileSlotViewProps) {
  const currentSlotTime = getSlotTimeRange(
    mobileSlot,
    state.timeSettings.startTime,
    state.timeSettings.slotDuration,
    state.timeSettings.intervalDuration
  );

  return (
    <div>
      {/* コマ選択タブ */}
      <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', marginBottom: '1rem', paddingBottom: '0.5rem', WebkitOverflowScrolling: 'touch' }}>
        {Array.from({ length: numSlots }).map((_, s) => {
          const timeRange = getSlotTimeRange(
            s,
            state.timeSettings.startTime,
            state.timeSettings.slotDuration,
            state.timeSettings.intervalDuration
          );
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
              const srcSlotTime = getSlotTimeRange(
                swapSource.slotIndex,
                state.timeSettings.startTime,
                state.timeSettings.slotDuration,
                state.timeSettings.intervalDuration
              );
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>コマ {mobileSlot + 1}</span>
          <strong style={{ fontSize: '1.15rem', display: 'block', color: 'var(--text-primary)' }}>{currentSlotTime.start} - {currentSlotTime.end}</strong>
        </div>
        <button
          className="btn btn-secondary"
          style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}
          onClick={() => onAutoGenerate(mobileSlot)}
          title="このコマ以降を再計算"
        >
          <RotateCcw size={12} /> ここから再計算
        </button>
      </div>

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
                    onClick={() => onToggleLock(mobileSlot, room.id)}
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
                          {pSong ? `${pSong.name.substring(0, 3)}:` : ''}{formatPartName(p.instrumentId, p.partIndex, p.songId, state.songs, state.instruments)}
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
                        onSwapAssignments(swapSource.slotIndex, swapSource.roomId, mobileSlot, room.id);
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
                      onClick={() => onOpenEditModal({ slotIndex: mobileSlot, roomId: room.id })}
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
  );
}
