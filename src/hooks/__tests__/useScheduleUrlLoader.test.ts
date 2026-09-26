import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  parseScheduleUrlParams,
  loadScheduleFromShortId,
  useScheduleUrlLoader,
} from '../useScheduleUrlLoader';
import { encodeScheduleData } from '../../utils/shareEncoding';
import type { ScheduleState } from '../../types';

describe('useScheduleUrlLoader & parseScheduleUrlParams', () => {
  const mockState: ScheduleState = {
    timeSettings: {
      startTime: '10:00',
      endTime: '13:00',
      slotDuration: 40,
      intervalDuration: 5,
    },
    rooms: [
      { id: 'r1', name: 'Room 1', capacity: 10, isPersonalPracticeCandidate: true },
    ],
    instruments: [
      { id: 'fl', name: 'フルート', movementType: 'movable' },
    ],
    songs: [
      { id: 's1', name: 'Song 1', parts: { fl: 2 } },
    ],
    duplicateNGPairs: [],
    entries: [
      {
        id: 'e1',
        songId: 's1',
        section: 'A',
        priority: 'high',
        parts: [{ instrumentId: 'fl', partIndex: 0 }],
      },
    ],
    assignments: [],
  };

  describe('parseScheduleUrlParams', () => {
    it('returns nulls for empty search and hash', () => {
      const result = parseScheduleUrlParams('', '');
      expect(result).toEqual({
        shortId: null,
        view: null,
        data: null,
      });
    });

    it('extracts direct 6-character short ID from hash', () => {
      const result = parseScheduleUrlParams('', '#k8w2m9');
      expect(result.shortId).toBe('k8w2m9');
      expect(result.view).toBeNull();
      expect(result.data).toBeNull();
    });

    it('does not treat hashes with length !== 6 or with = as direct short ID', () => {
      const result1 = parseScheduleUrlParams('', '#abc');
      expect(result1.shortId).toBeNull();

      const result2 = parseScheduleUrlParams('', '#toolongid123');
      expect(result2.shortId).toBeNull();

      const result3 = parseScheduleUrlParams('', '#a=12345');
      expect(result3.shortId).toBeNull();
    });

    it('extracts shortId from hash parameter #s=xxx', () => {
      const result = parseScheduleUrlParams('', '#s=m7p3q2');
      expect(result.shortId).toBe('m7p3q2');
    });

    it('extracts shortId from search query parameter ?s=xxx', () => {
      const result = parseScheduleUrlParams('?s=r9v4b1', '');
      expect(result.shortId).toBe('r9v4b1');
    });

    it('extracts view and data from hash #view=member&d=enc123', () => {
      const result = parseScheduleUrlParams('', '#view=member&d=enc123');
      expect(result.view).toBe('member');
      expect(result.data).toBe('enc123');
      expect(result.shortId).toBeNull();
    });

    it('extracts view and data from query ?view=member&d=enc456', () => {
      const result = parseScheduleUrlParams('?view=member&d=enc456', '');
      expect(result.view).toBe('member');
      expect(result.data).toBe('enc456');
      expect(result.shortId).toBeNull();
    });

    it('prioritizes hash shortId over search query', () => {
      const result = parseScheduleUrlParams('?s=queryId', '#s=hashId');
      expect(result.shortId).toBe('hashId');
    });
  });

  describe('loadScheduleFromShortId', () => {
    it('successfully retrieves and decodes schedule from short ID', async () => {
      const encoded = encodeScheduleData(mockState);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: encoded }),
      });

      const loaded = await loadScheduleFromShortId('abc123', mockFetch as any);
      expect(mockFetch).toHaveBeenCalledWith('/api/schedule?id=abc123');
      expect(loaded.timeSettings.startTime).toBe('10:00');
      expect(loaded.songs[0].name).toBe('Song 1');
    });

    it('throws when server returns 404', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(loadScheduleFromShortId('notfound', mockFetch as any)).rejects.toThrow(
        'スケジュールが見つかりません。期限切れ（30日経過）の可能性があります。'
      );
    });

    it('throws when payload cannot be restored', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'CORRUPTED_BASE64' }),
      });

      await expect(loadScheduleFromShortId('badpayload', mockFetch as any)).rejects.toThrow(
        'スケジュールデータの復元に失敗しました。'
      );
    });
  });

  describe('useScheduleUrlLoader hook integration', () => {
    it('decodes member state immediately on initial render when full data is provided in options', () => {
      const encoded = encodeScheduleData(mockState);
      let capturedResult: ReturnType<typeof useScheduleUrlLoader> | null = null;

      function TestComponent() {
        capturedResult = useScheduleUrlLoader({
          locationHash: `#view=member&d=${encoded}`,
          locationSearch: '',
        });
        return React.createElement('div', null, capturedResult.isMemberMode ? 'member' : 'admin');
      }

      renderToString(React.createElement(TestComponent));

      expect(capturedResult).not.toBeNull();
      expect(capturedResult!.isMemberMode).toBe(true);
      expect(capturedResult!.memberData).not.toBeNull();
      expect(capturedResult!.memberData?.timeSettings.startTime).toBe('10:00');
      expect(capturedResult!.isLoadingSchedule).toBe(false);
      expect(capturedResult!.scheduleLoadError).toBeNull();
    });

    it('handles empty parameters gracefully', () => {
      let capturedResult: ReturnType<typeof useScheduleUrlLoader> | null = null;

      function TestComponent() {
        capturedResult = useScheduleUrlLoader({
          locationHash: '',
          locationSearch: '',
        });
        return React.createElement('div', null, 'test');
      }

      renderToString(React.createElement(TestComponent));

      expect(capturedResult).not.toBeNull();
      expect(capturedResult!.isMemberMode).toBe(false);
      expect(capturedResult!.memberData).toBeNull();
      expect(capturedResult!.isLoadingSchedule).toBe(false);
      expect(capturedResult!.scheduleLoadError).toBeNull();
    });

    it('flags isLoadingSchedule as true on initial render when shortId is detected', () => {
      let capturedResult: ReturnType<typeof useScheduleUrlLoader> | null = null;

      function TestComponent() {
        capturedResult = useScheduleUrlLoader({
          locationHash: '#abc123',
          locationSearch: '',
        });
        return React.createElement('div', null, 'test');
      }

      renderToString(React.createElement(TestComponent));

      expect(capturedResult!.isLoadingSchedule).toBe(true);
      expect(capturedResult!.isMemberMode).toBe(false);
    });
  });
});
