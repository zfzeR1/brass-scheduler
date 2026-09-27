import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import InstrumentPartPicker from '../InstrumentPartPicker';
import AddExtraInstrumentModal from '../AddExtraInstrumentModal';
import SongCreateForm from '../SongCreateForm';
import SongListView from '../SongListView';
import SongEditModal from '../SongEditModal';
import SongFormSection from '../../SongFormSection';
import type { Song, Instrument, ScheduleState } from '../../../../types';

describe('Song Components (Phase 14 Refactoring)', () => {
  const mockInstruments: Instrument[] = [
    { id: 'fl', name: 'フルート', movementType: 'movable' },
    { id: 'cl', name: 'クラリネット', movementType: 'movable' },
    { id: 'trp', name: 'トランペット', movementType: 'movable' }
  ];

  const mockSongs: Song[] = [
    {
      id: 'song-1',
      name: '宝島',
      parts: { fl: 2, cl: 3, trp: 2 }
    },
    {
      id: 'song-2',
      name: 'ディスコ・キッド',
      parts: { fl: 1, trp: 1 }
    }
  ];

  const mockState: ScheduleState = {
    timeSettings: {
      startTime: '09:00',
      endTime: '12:00',
      slotDuration: 45,
      intervalDuration: 5
    },
    rooms: [
      { id: 'room-1', name: '大練習室', capacity: 30, isPersonalPracticeCandidate: false }
    ],
    instruments: mockInstruments,
    songs: mockSongs,
    duplicateNGPairs: [],
    entries: [],
    assignments: []
  };

  describe('InstrumentPartPicker', () => {
    it('renders all instruments with their assigned or default part counts', () => {
      const parts = { fl: 2, cl: 3 };
      const defaultParts = { fl: 1, cl: 1, trp: 1 };
      const handleChange = vi.fn();

      const html = renderToString(
        React.createElement(InstrumentPartPicker, {
          instruments: mockInstruments,
          extraInstruments: [],
          parts,
          defaultParts,
          onChangePartCount: handleChange
        })
      );

      expect(html).toContain('フルート');
      expect(html).toContain('クラリネット');
      expect(html).toContain('トランペット');
      expect(html).toContain('1st');
      expect(html).toContain('2nd');
      expect(html).toContain('3rd');
    });

    it('renders extra instruments with (追加) badge', () => {
      const extraInsts: Instrument[] = [
        { id: 'inst-custom', name: 'チェレスタ', movementType: 'movable' }
      ];

      const html = renderToString(
        React.createElement(InstrumentPartPicker, {
          instruments: mockInstruments,
          extraInstruments: extraInsts,
          parts: { 'inst-custom': 1 },
          onChangePartCount: vi.fn(),
          onRemoveExtraInstrument: vi.fn()
        })
      );

      expect(html).toContain('チェレスタ');
      expect(html).toContain('(追加)');
    });
  });

  describe('AddExtraInstrumentModal', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToString(
        React.createElement(AddExtraInstrumentModal, {
          isOpen: false,
          onClose: vi.fn(),
          onAdd: vi.fn(),
          existingNames: ['フルート']
        })
      );
      expect(html).toBe('');
    });

    it('renders modal when isOpen is true', () => {
      const html = renderToString(
        React.createElement(AddExtraInstrumentModal, {
          isOpen: true,
          onClose: vi.fn(),
          onAdd: vi.fn(),
          existingNames: ['フルート']
        })
      );
      expect(html).toContain('この曲に楽器を追加');
      expect(html).toContain('追加する楽器名');
      expect(html).toContain('キャンセル');
    });
  });

  describe('SongCreateForm', () => {
    it('renders song creation form with instrument picker and submit button', () => {
      const handleAdd = vi.fn();
      const html = renderToString(
        React.createElement(SongCreateForm, {
          instruments: mockInstruments,
          onAddSong: handleAdd
        })
      );

      expect(html).toContain('曲データ・パート編成登録');
      expect(html).toContain('曲名 (例: 宝島)');
      expect(html).toContain('パート編成 (各楽器のパート数)');
      expect(html).toContain('曲を追加');
    });
  });

  describe('SongListView', () => {
    it('renders empty prompt when songs list is empty', () => {
      const html = renderToString(
        React.createElement(SongListView, {
          songs: [],
          instruments: mockInstruments,
          onStartEditSong: vi.fn(),
          onDeleteSong: vi.fn(),
          onProceedToNext: vi.fn()
        })
      );

      expect(html).toContain('登録されている曲はありません。');
    });

    it('renders registered songs with their part count badges and next button', () => {
      const html = renderToString(
        React.createElement(SongListView, {
          songs: mockSongs,
          instruments: mockInstruments,
          onStartEditSong: vi.fn(),
          onDeleteSong: vi.fn(),
          onProceedToNext: vi.fn()
        })
      );

      expect(html).toContain('宝島');
      expect(html).toContain('ディスコ・キッド');
      expect(html).toContain('フルート');
      expect(html).toContain('クラリネット');
      expect(html).toContain('次へ: 1-3 重複NG設定へ');
    });
  });

  describe('SongEditModal', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToString(
        React.createElement(SongEditModal, {
          song: mockSongs[0],
          isOpen: false,
          instruments: mockInstruments,
          onSave: vi.fn(),
          onClose: vi.fn()
        })
      );
      expect(html).toBe('');
    });

    it('renders modal dialog with song details when isOpen is true', () => {
      const html = renderToString(
        React.createElement(SongEditModal, {
          song: mockSongs[0],
          isOpen: true,
          instruments: mockInstruments,
          onSave: vi.fn(),
          onClose: vi.fn()
        })
      );

      expect(html).toContain('曲データの編集');
      expect(html).toContain('宝島');
      expect(html).toContain('変更を保存する');
      expect(html).toContain('キャンセル');
    });
  });

  describe('SongFormSection orchestrator', () => {
    it('renders creation form and song list seamlessly', () => {
      const html = renderToString(
        React.createElement(SongFormSection, {
          state: mockState,
          setState: vi.fn(),
          onProceedToNext: vi.fn()
        })
      );

      expect(html).toContain('曲データ・パート編成登録');
      expect(html).toContain('登録済み曲リスト');
      expect(html).toContain('宝島');
      expect(html).toContain('ディスコ・キッド');
    });
  });
});
