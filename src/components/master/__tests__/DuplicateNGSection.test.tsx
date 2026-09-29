import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DuplicateNGSection from '../DuplicateNGSection';
import type { ScheduleState } from '../../../types';

describe('DuplicateNGSection Component', () => {
  const mockState: ScheduleState = {
    timeSettings: {
      startTime: '09:00',
      endTime: '12:00',
      slotDuration: 45,
      intervalDuration: 5
    },
    rooms: [
      { id: 'room-1', name: '第1練習室', capacity: 10, isPersonalPracticeCandidate: true }
    ],
    instruments: [
      { id: 'fl', name: 'フルート', movementType: 'movable' },
      { id: 'cl', name: 'クラリネット', movementType: 'movable' }
    ],
    songs: [
      { id: 'song-1', name: '宝島', parts: { fl: 2 } },
      { id: 'song-2', name: 'エル・クンバンチェロ', parts: { cl: 2 } }
    ],
    duplicateNGPairs: [
      {
        id: 'ng-1',
        partA: { songId: 'song-1', instrumentId: 'fl', partIndex: 0 },
        partB: { songId: 'song-2', instrumentId: 'cl', partIndex: 0 }
      }
    ],
    entries: [],
    assignments: []
  };

  it('renders form and list of registered duplicate NG pairs', () => {
    render(
      <DuplicateNGSection
        state={mockState}
        setState={vi.fn()}
        onProceedToNext={vi.fn()}
      />
    );

    expect(screen.getByText('重複NG設定')).toBeDefined();
    expect(screen.getByText(/登録済みの重複NG一覧 \(1件\)/)).toBeDefined();
    expect(screen.getAllByText('宝島').length).toBeGreaterThan(0);
    expect(screen.getAllByText('エル・クンバンチェロ').length).toBeGreaterThan(0);
  });

  it('renders empty message when no duplicate NG pairs exist', () => {
    const emptyState = { ...mockState, duplicateNGPairs: [] };
    render(
      <DuplicateNGSection
        state={emptyState}
        setState={vi.fn()}
        onProceedToNext={vi.fn()}
      />
    );

    expect(screen.getByText(/現在、手動登録された重複NGはありません/)).toBeDefined();
  });

  it('handles pair deletion', () => {
    const setState = vi.fn();
    render(
      <DuplicateNGSection
        state={mockState}
        setState={setState}
        onProceedToNext={vi.fn()}
      />
    );

    const deleteBtn = screen.getByTitle('削除');
    fireEvent.click(deleteBtn);

    expect(setState).toHaveBeenCalled();
  });

  it('handles onProceedToNext when clicked', () => {
    const handleProceed = vi.fn();
    render(
      <DuplicateNGSection
        state={mockState}
        setState={vi.fn()}
        onProceedToNext={handleProceed}
      />
    );

    const nextBtn = screen.getByText(/次へ: 1-4 セクション練習へ/);
    fireEvent.click(nextBtn);

    expect(handleProceed).toHaveBeenCalled();
  });
});
