import { useState } from 'react';
import type { ScheduleState } from '../../types';
import { getSlotTimeRange } from '../../utils/scheduler';
import { Lock, Unlock, ArrowLeftRight, X } from 'lucide-react';

export interface CellEditModalProps {
  target: { slotIndex: number; roomId: string };
  onClose: () => void;
  state: ScheduleState;
  onAssignEntry: (entryId: string) => void;
  onSetPersonal: () => void;
  onSetEmpty: () => void;
  onSwapWith: (otherRoomId: string) => void;
  onToggleLock: () => void;
}

export default function CellEditModal({
  target,
  onClose,
  state,
  onAssignEntry,
  onSetPersonal,
  onSetEmpty,
  onSwapWith,
  onToggleLock
}: CellEditModalProps) {
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
