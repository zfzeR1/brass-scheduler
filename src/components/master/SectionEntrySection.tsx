import React, { useState } from 'react';
import type { ScheduleState, Entry } from '../../types';
import { removeEntryWithCascade } from '../../utils/scheduleIntegrity';
import { useOptionalSchedule } from '../../context/ScheduleContext';
import SectionEntryForm from './entry/SectionEntryForm';
import SectionEntryList from './entry/SectionEntryList';
import SectionEntryEditModal from './entry/SectionEntryEditModal';
import { ChevronRight } from 'lucide-react';

export interface SectionEntrySectionProps {
  state?: ScheduleState;
  setState?: React.Dispatch<React.SetStateAction<ScheduleState>>;
  onProceedToSchedule: () => void;
}

export default function SectionEntrySection(props: SectionEntrySectionProps) {
  const scheduleCtx = useOptionalSchedule();
  const state = props.state ?? scheduleCtx?.state;
  const setState = props.setState ?? scheduleCtx?.setState;
  const { onProceedToSchedule } = props;

  if (!state || !setState) {
    throw new Error('SectionEntrySection requires ScheduleProvider or state/setState props');
  }

  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  // 新規エントリーの追加
  const handleAddEntry = (entryData: Omit<Entry, 'id'>) => {
    const newEntry: Entry = {
      ...entryData,
      id: 'entry-' + Date.now()
    };

    setState(prev => ({
      ...prev,
      entries: [...prev.entries, newEntry]
    }));
  };

  // エントリーの削除（カスケード削除により割り当て枠も同期して安全にクリア）
  const handleRemoveEntry = (id: string) => {
    setState(prev => removeEntryWithCascade(prev, id));
  };

  // エントリーの並び替え
  const handleMoveEntry = (index: number, direction: 'up' | 'down') => {
    setState(prev => {
      const list = [...prev.entries];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;

      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;

      return {
        ...prev,
        entries: list
      };
    });
  };

  // 編集内容の保存（割り当て枠内の参加パートも同期）
  const handleSaveEditEntry = (updatedEntry: Entry) => {
    setState(prev => {
      const nextEntries = prev.entries.map(e => e.id === updatedEntry.id ? updatedEntry : e);
      const nextAssignments = prev.assignments.map(asm => {
        if (asm.entryId === updatedEntry.id) {
          return {
            ...asm,
            parts: updatedEntry.parts.map(p => ({
              instrumentId: p.instrumentId,
              partIndex: p.partIndex,
              songId: updatedEntry.songId
            }))
          };
        }
        return asm;
      });

      return {
        ...prev,
        entries: nextEntries,
        assignments: nextAssignments
      };
    });
    setEditingEntry(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 1. 新規エントリー作成フォーム */}
      <SectionEntryForm
        songs={state.songs}
        instruments={state.instruments}
        onAddEntry={handleAddEntry}
      />

      {/* 2. 登録済みエントリー一覧（PCテーブル＆スマホカード） */}
      <SectionEntryList
        entries={state.entries}
        songs={state.songs}
        instruments={state.instruments}
        onRemoveEntry={handleRemoveEntry}
        onMoveEntry={handleMoveEntry}
        onEditEntry={setEditingEntry}
      />

      {/* 3. エントリー編集モーダル */}
      <SectionEntryEditModal
        entry={editingEntry}
        isOpen={editingEntry !== null}
        songs={state.songs}
        instruments={state.instruments}
        onSave={handleSaveEditEntry}
        onClose={() => setEditingEntry(null)}
      />

      {/* 4. 全設定完了！STEP 2へ進むボタン */}
      <div className="next-step-bar" style={{ marginTop: '1.5rem' }}>
        <button
          type="button"
          className="btn btn-primary btn-next-step"
          onClick={onProceedToSchedule}
        >
          全設定完了！STEP 2: スケジュール生成へ進む <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
