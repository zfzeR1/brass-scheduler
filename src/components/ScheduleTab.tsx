import React, { useState, useMemo } from 'react';
import type { ScheduleState, Assignment } from '../types';
import {
  calculateNumSlots,
  generateSchedule,
  evaluateSchedule
} from '../utils/scheduler';
import { useScheduleUndo, type ScheduleUndoManager } from '../hooks/useScheduleUndo';
import { useIsMobile } from '../hooks/useMediaQuery';
import { Play, RotateCcw, Camera, Info } from 'lucide-react';
import TimetableExportModal from './TimetableExportModal';
import ViolationSummaryPanel from './schedule/ViolationSummaryPanel';
import CellEditModal from './schedule/CellEditModal';
import TimetableGrid from './schedule/TimetableGrid';
import MobileSlotView from './schedule/MobileSlotView';

interface ScheduleTabProps {
  state: ScheduleState;
  setState: React.Dispatch<React.SetStateAction<ScheduleState>>;
  undoControls?: ScheduleUndoManager;
}

export default function ScheduleTab({ state, setState, undoControls }: ScheduleTabProps) {
  const fallbackUndo = useScheduleUndo(state.assignments, (newAssignments) => {
    setState(prev => ({
      ...prev,
      assignments: newAssignments
    }));
  });

  const {
    setAssignmentsWithHistory,
    undo,
    canUndo,
    historyLength
  } = undoControls ?? fallbackUndo;

  const isMobile = useIsMobile();
  const [mobileSlot, setMobileSlot] = useState(0);
  const [swapSource, setSwapSource] = useState<{ slotIndex: number; roomId: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ slotIndex: number; roomId: string } | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

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
    setAssignmentsWithHistory(updatedAssignments);
  };

  // ロックの切り替え
  const toggleLock = (slotIndex: number, roomId: string) => {
    setAssignmentsWithHistory(prev => {
      const updated = prev.map(asm => {
        if (asm.slotIndex === slotIndex && asm.roomId === roomId) {
          return { ...asm, isLocked: !asm.isLocked };
        }
        return asm;
      });
      return updated;
    });
  };

  // 2つの枠の割り当てを交換する（ドラッグ＆ドロップおよびタップ入れ替え共通）
  const handleSwapAssignments = (srcSlotIndex: number, srcRoomId: string, destSlotIndex: number, destRoomId: string) => {
    if (srcSlotIndex === destSlotIndex && srcRoomId === destRoomId) return;

    setAssignmentsWithHistory(prev => {
      const updated = [...prev];
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

      return updated;
    });
  };

  // 枠に特定の練習エントリーを直接割り当てる
  const handleAssignEntry = (slotIndex: number, roomId: string, entryId: string) => {
    const entry = state.entries.find(e => e.id === entryId);
    if (!entry) return;
    setAssignmentsWithHistory(prev => {
      const updated = [...prev];
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
      return updated;
    });
  };

  // 枠を個人練習部屋に設定する
  const handleSetPersonalPractice = (slotIndex: number, roomId: string) => {
    setAssignmentsWithHistory(prev => {
      const updated = [...prev];
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
      return updated;
    });
  };

  // 枠を空き部屋にする
  const handleSetEmpty = (slotIndex: number, roomId: string) => {
    setAssignmentsWithHistory(prev => {
      const updated = [...prev];
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
      return updated;
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">スケジュール自動生成・微調整</h1>
        <p className="page-subtitle">マスターデータと制約をもとに、最適な練習スケジュールを自動で生成およびドラッグ調整します。</p>
      </div>

      {/* Control Actions */}
      <div className="glass-card" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => handleAutoGenerate(0)} style={{ fontSize: '0.85rem', padding: '0.6rem 1.25rem' }}>
            <Play size={16} /> スケジュールを自動生成
          </button>

          <button
            className="btn btn-secondary"
            onClick={undo}
            disabled={!canUndo}
            title={canUndo ? `直前の状態に戻す (残り${historyLength}手)` : '元に戻す履歴がありません'}
            style={{
              fontSize: '0.85rem',
              padding: '0.6rem 1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              opacity: canUndo ? 1 : 0.45,
              cursor: canUndo ? 'pointer' : 'not-allowed'
            }}
          >
            <RotateCcw size={15} />
            <span>↩︎ 元に戻す (Undo)</span>
            {historyLength > 0 && (
              <span
                className="badge badge-primary"
                style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  marginLeft: '2px',
                  fontWeight: 600
                }}
              >
                {historyLength}
              </span>
            )}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setShowExportModal(true)}
            title="タイムテーブル全体をPNG画像として保存"
            style={{
              fontSize: '0.85rem',
              padding: '0.6rem 1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Camera size={15} />
            <span>📸 画像保存 (PNG)</span>
          </button>
        </div>

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
        <ViolationSummaryPanel violations={evaluation.violations} />
      )}

      {/* タイムテーブル表示 */}
      {state.assignments.length === 0 ? (
        <div style={{ height: '300px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
          <Info size={36} />
          <div>「スケジュールを自動生成」ボタンを押して、スケジュールを組みましょう。</div>
        </div>
      ) : (
        <div>
          {/* 操作ガイドバナー */}
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
            <MobileSlotView
              state={state}
              numSlots={numSlots}
              mobileSlot={mobileSlot}
              setMobileSlot={setMobileSlot}
              swapSource={swapSource}
              setSwapSource={setSwapSource}
              onAutoGenerate={handleAutoGenerate}
              onSwapAssignments={handleSwapAssignments}
              onToggleLock={toggleLock}
              onOpenEditModal={(target) => setEditTarget(target)}
            />
          ) : (
            /* ==================== DESKTOP: グリッド表示 ==================== */
            <TimetableGrid
              state={state}
              numSlots={numSlots}
              onAutoGenerate={handleAutoGenerate}
              onSwapAssignments={handleSwapAssignments}
              onToggleLock={toggleLock}
              onOpenEditModal={(target) => setEditTarget(target)}
            />
          )}
        </div>
      )}

      {/* 練習枠の変更・編集モーダル */}
      {editTarget && (
        <CellEditModal
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

      {/* タイムテーブルPNG画像エクスポートモーダル (R2) */}
      <TimetableExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        state={state}
      />
    </div>
  );
}
