import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ScheduleTab from '../ScheduleTab';
import ShareTab from '../ShareTab';
import MasterDataTab from '../MasterDataTab';
import type { ScheduleState } from '../../types';

describe('Top-level Tab Components', () => {
  const mockState: ScheduleState = {
    timeSettings: {
      startTime: '09:00',
      endTime: '11:00',
      slotDuration: 60,
      intervalDuration: 0
    },
    rooms: [
      { id: 'room-1', name: '第1練習室', capacity: 10, isPersonalPracticeCandidate: true }
    ],
    instruments: [
      { id: 'fl', name: 'フルート', movementType: 'movable' }
    ],
    songs: [
      { id: 'song-1', name: '宝島', parts: { fl: 2 } }
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
      { id: 'asm-2', slotIndex: 1, roomId: 'room-1', entryId: undefined, isLocked: false }
    ]
  };

  describe('ScheduleTab', () => {
    it('renders control action buttons and timetable grid', () => {
      render(
        <ScheduleTab
          state={mockState}
          setState={vi.fn()}
        />
      );

      expect(screen.getByText('スケジュール自動生成・微調整')).toBeDefined();
      expect(screen.getByText(/スケジュールを自動生成/)).toBeDefined();
      expect(screen.getByText(/画像保存 \(PNG\)/)).toBeDefined();
      expect(screen.getByText(/元に戻す/)).toBeDefined();
      expect(screen.getByText('宝島')).toBeDefined();
      expect(screen.getByText('A〜B')).toBeDefined();
    });

    it('opens export modal when PNG export button is clicked', () => {
      render(
        <ScheduleTab
          state={mockState}
          setState={vi.fn()}
        />
      );

      const exportBtn = screen.getByText(/画像保存 \(PNG\)/);
      fireEvent.click(exportBtn);

      expect(screen.getByText(/タイムテーブル画像保存 \(PNG\)/)).toBeDefined();
    });
  });

  describe('ShareTab', () => {
    it('renders share options and buttons', () => {
      render(
        <ShareTab
          state={mockState}
          onNavigateToSchedule={vi.fn()}
        />
      );

      expect(screen.getByText('共有・個人時間割確認')).toBeDefined();
      expect(screen.getByText('部員用共有リンク')).toBeDefined();
      expect(screen.getByText('URLのみコピー')).toBeDefined();
      expect(screen.getByText('QRコードを表示')).toBeDefined();
      expect(screen.getByText('📸 タイムテーブル画像保存 (PNG)')).toBeDefined();
    });

    it('toggles QR code modal when QR code button is clicked', () => {
      render(
        <ShareTab
          state={mockState}
          onNavigateToSchedule={vi.fn()}
        />
      );

      const qrBtn = screen.getByText('QRコードを表示');
      fireEvent.click(qrBtn);

      expect(screen.getByText('📱 部員用QRコード')).toBeDefined();
    });
  });

  describe('MasterDataTab', () => {
    it('renders step dashboard and switches subtabs when clicked', () => {
      render(
        <MasterDataTab
          state={mockState}
          setState={vi.fn()}
          onProceedToSchedule={vi.fn()}
        />
      );

      expect(screen.getByText('基本条件設定')).toBeDefined();
      expect(screen.getByText('1-1')).toBeDefined();
      expect(screen.getByText('1-2')).toBeDefined();
      expect(screen.getByText('1-3')).toBeDefined();
      expect(screen.getByText('1-4')).toBeDefined();

      // 初期は 1-1（時間・部屋）
      expect(screen.getByText('練習時間・コマ設定')).toBeDefined();

      // 1-2（曲・パート）へ切り替え
      const step12 = screen.getByText('1-2').closest('.dashboard-card');
      expect(step12).not.toBeNull();
      if (step12) fireEvent.click(step12);

      expect(screen.getByText('曲データ・パート編成登録')).toBeDefined();

      // 1-3（重複NG）へ切り替え
      const step13 = screen.getByText('1-3').closest('.dashboard-card');
      expect(step13).not.toBeNull();
      if (step13) fireEvent.click(step13);

      expect(screen.getByText('重複NG設定')).toBeDefined();

      // 1-4（セクション練習）へ切り替え
      const step14 = screen.getByText('1-4').closest('.dashboard-card');
      expect(step14).not.toBeNull();
      if (step14) fireEvent.click(step14);

      expect(screen.getByText('セクション練習の追加')).toBeDefined();
    });
  });
});
