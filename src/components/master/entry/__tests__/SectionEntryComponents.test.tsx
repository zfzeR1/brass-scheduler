import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { getSongParts } from '../entryHelpers';
import SectionEntryForm from '../SectionEntryForm';
import SectionEntryList from '../SectionEntryList';
import SectionEntryEditModal from '../SectionEntryEditModal';
import SectionEntrySection from '../../SectionEntrySection';
import type { Song, Instrument, Entry, ScheduleState } from '../../../../types';

describe('SectionEntry Components (Phase 7 Refactoring)', () => {
  const mockSongs: Song[] = [
    {
      id: 'song-1',
      name: 'テストマーチ',
      parts: { fl: 2, trp: 2 },
    },
    {
      id: 'song-2',
      name: 'テストシンフォニー',
      parts: { hrn: 4 },
    },
  ];

  const mockInstruments: Instrument[] = [
    { id: 'fl', name: 'フルート', movementType: 'movable' },
    { id: 'trp', name: 'トランペット', movementType: 'movable' },
    { id: 'hrn', name: 'ホルン', movementType: 'movable' },
  ];

  const mockEntries: Entry[] = [
    {
      id: 'entry-1',
      songId: 'song-1',
      section: 'イントロ〜A',
      priority: 'high',
      parts: [
        { instrumentId: 'fl', partIndex: 0 },
        { instrumentId: 'fl', partIndex: 1 },
      ],
    },
    {
      id: 'entry-2',
      songId: 'song-1',
      section: 'B〜C',
      priority: 'medium',
      parts: [
        { instrumentId: 'trp', partIndex: 0 },
      ],
    },
  ];

  const mockState: ScheduleState = {
    timeSettings: {
      startTime: '09:00',
      endTime: '12:00',
      slotDuration: 45,
      intervalDuration: 5,
    },
    rooms: [
      { id: 'room-1', name: '第1練習室', capacity: 10, isPersonalPracticeCandidate: true },
    ],
    instruments: mockInstruments,
    songs: mockSongs,
    duplicateNGPairs: [],
    entries: mockEntries,
    assignments: [],
  };

  describe('entryHelpers: getSongParts', () => {
    it('returns empty array when songId is not found', () => {
      const parts = getSongParts('unknown-song', mockSongs, mockInstruments);
      expect(parts).toEqual([]);
    });

    it('returns formatted part list for valid song', () => {
      const parts = getSongParts('song-1', mockSongs, mockInstruments);
      expect(parts).toHaveLength(4); // 2 fl + 2 trp
      expect(parts[0].instrumentId).toBe('fl');
      expect(parts[0].partIndex).toBe(0);
      expect(parts[0].label).toContain('フルート 1');
      expect(parts[1].label).toContain('フルート 2');
      expect(parts[2].label).toContain('トランペット 1');
    });
  });

  describe('SectionEntryForm', () => {
    it('renders form with song options and empty placeholder', () => {
      const handleAdd = vi.fn();
      const html = renderToString(
        React.createElement(SectionEntryForm, {
          songs: mockSongs,
          instruments: mockInstruments,
          onAddEntry: handleAdd,
        })
      );

      expect(html).toContain('セクション練習の追加');
      expect(html).toContain('テストマーチ');
      expect(html).toContain('テストシンフォニー');
      expect(html).toContain('対象曲を選択すると');
    });
  });

  describe('SectionEntryList', () => {
    it('renders empty message when no entries are present', () => {
      const html = renderToString(
        React.createElement(SectionEntryList, {
          entries: [],
          songs: mockSongs,
          instruments: mockInstruments,
          onRemoveEntry: vi.fn(),
          onMoveEntry: vi.fn(),
          onEditEntry: vi.fn(),
        })
      );

      expect(html).toContain('まだセクション練習が登録されていません');
    });

    it('renders table headers and entries with song names and priority tags', () => {
      const html = renderToString(
        React.createElement(SectionEntryList, {
          entries: mockEntries,
          songs: mockSongs,
          instruments: mockInstruments,
          onRemoveEntry: vi.fn(),
          onMoveEntry: vi.fn(),
          onEditEntry: vi.fn(),
        })
      );

      expect(html).toContain('登録済みのセクション練習一覧 (2件)');
      expect(html).toContain('イントロ〜A');
      expect(html).toContain('B〜C');
      expect(html).toContain('テストマーチ');
      expect(html).toContain('高');
      expect(html).toContain('中');
    });
  });

  describe('SectionEntryEditModal', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToString(
        React.createElement(SectionEntryEditModal, {
          entry: mockEntries[0],
          isOpen: false,
          songs: mockSongs,
          instruments: mockInstruments,
          onSave: vi.fn(),
          onClose: vi.fn(),
        })
      );

      expect(html).toBe('');
    });

    it('renders modal dialog when isOpen is true and entry is present', () => {
      const html = renderToString(
        React.createElement(SectionEntryEditModal, {
          entry: mockEntries[0],
          isOpen: true,
          songs: mockSongs,
          instruments: mockInstruments,
          onSave: vi.fn(),
          onClose: vi.fn(),
        })
      );

      expect(html).toContain('セクション練習の編集');
      expect(html).toContain('テストマーチ');
      expect(html).toContain('イントロ〜A');
      expect(html).toContain('変更を保存する');
      expect(html).toContain('キャンセル');
    });
  });

  describe('SectionEntrySection coordinator', () => {
    it('renders form, list, and next step button seamlessly', () => {
      const handleProceed = vi.fn();
      const setState = vi.fn();

      const html = renderToString(
        React.createElement(SectionEntrySection, {
          state: mockState,
          setState,
          onProceedToSchedule: handleProceed,
        })
      );

      expect(html).toContain('セクション練習の追加');
      expect(html).toContain('登録済みのセクション練習一覧 (2件)');
      expect(html).toContain('全設定完了！STEP 2: スケジュール生成へ進む');
    });
  });
});
