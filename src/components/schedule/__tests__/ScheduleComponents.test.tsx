import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ViolationSummaryPanel from '../ViolationSummaryPanel';
import CellEditModal from '../CellEditModal';
import TimetableGrid from '../TimetableGrid';
import type { ScheduleState } from '../../../types';

describe('Schedule Sub-Components', () => {
  const mockState: ScheduleState = {
    timeSettings: {
      startTime: '09:00',
      endTime: '11:00',
      slotDuration: 60,
      intervalDuration: 0
    },
    rooms: [
      { id: 'room-1', name: '第1練習室', capacity: 10, isPersonalPracticeCandidate: true },
      { id: 'room-2', name: '大合奏室', capacity: 40, isPersonalPracticeCandidate: false }
    ],
    instruments: [
      { id: 'fl', name: 'フルート', movementType: 'movable' },
      { id: 'trp', name: 'トランペット', movementType: 'movable' }
    ],
    songs: [
      { id: 'song-1', name: '宝島', parts: { fl: 2, trp: 2 } }
    ],
    duplicateNGPairs: [],
    entries: [
      {
        id: 'entry-1',
        songId: 'song-1',
        section: 'A〜B',
        priority: 'high',
        parts: [{ instrumentId: 'fl', partIndex: 0 }]
      }
    ],
    assignments: [
      { id: 'asm-1', slotIndex: 0, roomId: 'room-1', entryId: 'entry-1', isLocked: false },
      { id: 'asm-2', slotIndex: 0, roomId: 'room-2', entryId: undefined, isLocked: false, isPersonalPractice: true, parts: [{ songId: 'song-1', instrumentId: 'trp', partIndex: 0 }] },
      { id: 'asm-3', slotIndex: 1, roomId: 'room-1', entryId: undefined, isLocked: true },
      { id: 'asm-4', slotIndex: 1, roomId: 'room-2', entryId: undefined, isLocked: false }
    ]
  };

  describe('ViolationSummaryPanel', () => {
    it('renders success state when violations list is empty', () => {
      render(<ViolationSummaryPanel violations={[]} />);
      expect(screen.getByText('制約・最適化チェック結果')).toBeDefined();
      expect(screen.getByText(/すべてのハード制約/)).toBeDefined();
    });

    it('renders violation warnings when violations exist', () => {
      const violations = [
        'コマ 1: パート重複エラー',
        'コマ 2: 移動困難楽器の移動NG'
      ];
      render(<ViolationSummaryPanel violations={violations} />);
      expect(screen.getByText('制約・最適化チェック結果')).toBeDefined();
      expect(screen.getByText('コマ 1: パート重複エラー')).toBeDefined();
      expect(screen.getByText('コマ 2: 移動困難楽器の移動NG')).toBeDefined();
    });
  });

  describe('CellEditModal', () => {
    it('renders slot and room info and handles entry change and save', () => {
      const handleAssignEntry = vi.fn();
      const handleClose = vi.fn();

      render(
        <CellEditModal
          target={{ slotIndex: 0, roomId: 'room-1' }}
          state={mockState}
          onAssignEntry={handleAssignEntry}
          onSetPersonal={vi.fn()}
          onSetEmpty={vi.fn()}
          onSwapWith={vi.fn()}
          onToggleLock={vi.fn()}
          onClose={handleClose}
        />
      );

      expect(screen.getByText('練習枠の変更・手動調整')).toBeDefined();
      expect(screen.getByText(/第1練習室/)).toBeDefined();

      // エントリーの選択肢があることを確認
      const selects = screen.getAllByRole('combobox');
      const select = selects[0];
      expect(select).toBeDefined();

      // entry-1 を割り当て
      fireEvent.change(select, { target: { value: 'entry-1' } });
      const assignBtn = screen.getByText('割り当てる');
      fireEvent.click(assignBtn);

      expect(handleAssignEntry).toHaveBeenCalledWith('entry-1');
      expect(handleClose).toHaveBeenCalled();
    });

    it('handles setting personal practice mode', () => {
      const handleSetPersonal = vi.fn();
      const handleClose = vi.fn();

      render(
        <CellEditModal
          target={{ slotIndex: 0, roomId: 'room-1' }}
          state={mockState}
          onAssignEntry={vi.fn()}
          onSetPersonal={handleSetPersonal}
          onSetEmpty={vi.fn()}
          onSwapWith={vi.fn()}
          onToggleLock={vi.fn()}
          onClose={handleClose}
        />
      );

      const personalBtn = screen.getByText('個人練習部屋にする');
      fireEvent.click(personalBtn);

      expect(handleSetPersonal).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });

    it('handles setting empty slot', () => {
      const handleSetEmpty = vi.fn();
      const handleClose = vi.fn();

      render(
        <CellEditModal
          target={{ slotIndex: 0, roomId: 'room-1' }}
          state={mockState}
          onAssignEntry={vi.fn()}
          onSetPersonal={vi.fn()}
          onSetEmpty={handleSetEmpty}
          onSwapWith={vi.fn()}
          onToggleLock={vi.fn()}
          onClose={handleClose}
        />
      );

      const emptyBtn = screen.getByText('空き部屋にする');
      fireEvent.click(emptyBtn);

      expect(handleSetEmpty).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('TimetableGrid', () => {
    it('renders time headers and room columns with assignments', () => {
      const handleOpenEdit = vi.fn();
      const handleToggleLock = vi.fn();

      render(
        <TimetableGrid
          state={mockState}
          numSlots={2}
          onAutoGenerate={vi.fn()}
          onSwapAssignments={vi.fn()}
          onToggleLock={handleToggleLock}
          onOpenEditModal={handleOpenEdit}
        />
      );

      // 部屋名が表示されているか
      expect(screen.getByText('第1練習室')).toBeDefined();
      expect(screen.getByText('大合奏室')).toBeDefined();

      // 曲名・セクション名が表示されているか
      expect(screen.getByText('宝島')).toBeDefined();
      expect(screen.getByText('A〜B')).toBeDefined();

      // 個人練習バッジが表示されているか
      expect(screen.getByText(/個人練習部屋/)).toBeDefined();
    });

    it('triggers onOpenEditModal when edit button is clicked', () => {
      const handleOpenEdit = vi.fn();
      render(
        <TimetableGrid
          state={mockState}
          numSlots={2}
          onAutoGenerate={vi.fn()}
          onSwapAssignments={vi.fn()}
          onToggleLock={vi.fn()}
          onOpenEditModal={handleOpenEdit}
        />
      );

      // 編集ボタンをクリック
      const editButtons = screen.getAllByTitle('練習内容の変更・入替');
      expect(editButtons.length).toBeGreaterThan(0);
      fireEvent.click(editButtons[0]);

      expect(handleOpenEdit).toHaveBeenCalledWith({ slotIndex: 0, roomId: 'room-1' });
    });

    it('triggers onToggleLock when lock button is clicked', () => {
      const handleToggleLock = vi.fn();
      render(
        <TimetableGrid
          state={mockState}
          numSlots={2}
          onAutoGenerate={vi.fn()}
          onSwapAssignments={vi.fn()}
          onToggleLock={handleToggleLock}
          onOpenEditModal={vi.fn()}
        />
      );

      const lockButtons = screen.getAllByTitle('位置を固定 (自動生成対象外にする)');
      expect(lockButtons.length).toBeGreaterThan(0);
      fireEvent.click(lockButtons[0]);

      expect(handleToggleLock).toHaveBeenCalledWith(0, 'room-1');
    });
  });
});
