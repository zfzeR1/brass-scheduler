import React, { useState } from 'react';
import type { ScheduleState, Assignment } from '../../types';
import { getSlotTimeRange, formatPartName } from '../../utils/scheduler';
import { GripVertical, Edit3, Lock, Unlock, Plus, RotateCcw } from 'lucide-react';

interface TimetableGridProps {
  state: ScheduleState;
  numSlots: number;
  onAutoGenerate: (startSlot: number) => void;
  onSwapAssignments: (srcSlotIndex: number, srcRoomId: string, destSlotIndex: number, destRoomId: string) => void;
  onToggleLock: (slotIndex: number, roomId: string) => void;
  onOpenEditModal: (target: { slotIndex: number; roomId: string }) => void;
}

export default function TimetableGrid({
  state,
  numSlots,
  onAutoGenerate,
  onSwapAssignments,
  onToggleLock,
  onOpenEditModal
}: TimetableGridProps) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  // --- HTML5 Drag and Drop Handlers ---
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
      onSwapAssignments(srcSlotIndex, srcRoomId, destSlotIndex, destRoomId);
    } catch (err) {
      console.error('Drag drop failed', err);
    }
  };

  // --- Cell Rendering ---
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
                  onOpenEditModal({ slotIndex: asm.slotIndex, roomId: asm.roomId });
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
                  onToggleLock(asm.slotIndex, asm.roomId);
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
            {entry.parts.map(p => (
              <span key={`${p.instrumentId}_${p.partIndex}`} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '1px 3px', borderRadius: '2px' }}>
                {formatPartName(p.instrumentId, p.partIndex, entry.songId, state.songs, state.instruments)}
              </span>
            ))}
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
                  onOpenEditModal({ slotIndex: asm.slotIndex, roomId: asm.roomId });
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
                  onToggleLock(asm.slotIndex, asm.roomId);
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
                  {pSong ? `${pSong.name.substring(0, 2)}:${formatPartName(p.instrumentId, p.partIndex, p.songId, state.songs, state.instruments)}` : formatPartName(p.instrumentId, p.partIndex, undefined, state.songs, state.instruments)}
                </span>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div
        onClick={() => onOpenEditModal({ slotIndex: asm.slotIndex, roomId: asm.roomId })}
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

  return (
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
                  onClick={() => onAutoGenerate(s)}
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
  );
}
