import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TimeAndRoomSection from '../TimeAndRoomSection';
import type { ScheduleState } from '../../../types';

describe('TimeAndRoomSection Component', () => {
  const mockState: ScheduleState = {
    timeSettings: {
      startTime: '09:00',
      endTime: '12:00',
      slotDuration: 45,
      intervalDuration: 5
    },
    rooms: [
      { id: 'room-1', name: '第1練習室', capacity: 10, isPersonalPracticeCandidate: true },
      { id: 'room-2', name: '大合奏室', capacity: 40, isPersonalPracticeCandidate: false }
    ],
    instruments: [
      { id: 'fl', name: 'フルート', movementType: 'movable' },
      { id: 'pno', name: 'ピアノ', movementType: 'immovable' }
    ],
    songs: [],
    duplicateNGPairs: [],
    entries: [],
    assignments: []
  };

  it('renders time settings and calculates slot count display', () => {
    render(<TimeAndRoomSection state={mockState} setState={vi.fn()} />);

    expect(screen.getByText('練習時間・コマ設定')).toBeDefined();
    expect(screen.getByText('部屋（練習室）管理')).toBeDefined();
    expect(screen.getByText(/計算されるコマ数/)).toBeDefined();
  });

  it('renders room list with room names and capacities', () => {
    render(<TimeAndRoomSection state={mockState} setState={vi.fn()} />);

    expect(screen.getAllByText('第1練習室').length).toBeGreaterThan(0);
    expect(screen.getAllByText('大合奏室').length).toBeGreaterThan(0);
    expect(screen.getByText('10 人')).toBeDefined();
    expect(screen.getByText('40 人')).toBeDefined();
  });

  it('handles room removal', () => {
    const setState = vi.fn();
    const { container } = render(<TimeAndRoomSection state={mockState} setState={setState} />);

    const removeButtons = container.querySelectorAll('.desktop-only button.btn-icon');
    expect(removeButtons.length).toBe(2);
    fireEvent.click(removeButtons[0]);

    expect(setState).toHaveBeenCalled();
  });

  it('handles time changes within valid boundaries', () => {
    const setState = vi.fn();
    const { container } = render(<TimeAndRoomSection state={mockState} setState={setState} />);

    const slotInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(slotInput).not.toBeNull();
    fireEvent.change(slotInput, { target: { value: '60' } });

    expect(setState).toHaveBeenCalled();
  });
});
