import { describe, it, expect } from 'vitest';
import type { ScheduleState } from '../../types';
import { validateMasterDataRequirements } from '../validation';

describe('validateMasterDataRequirements', () => {
  const validState: ScheduleState = {
    timeSettings: { startTime: '09:00', endTime: '12:00', slotDuration: 45, intervalDuration: 5 },
    rooms: [{ id: 'r1', name: 'Room 1', capacity: 10, isPersonalPracticeCandidate: true }],
    instruments: [],
    songs: [{ id: 's1', name: 'Song 1', parts: { fl: 1 } }],
    entries: [{ id: 'e1', songId: 's1', section: 'A', priority: 'high', parts: [{ instrumentId: 'fl', partIndex: 0 }] }],
    duplicateNGPairs: [],
    assignments: []
  };

  it('passes when rooms, songs, and entries are all present', () => {
    const res = validateMasterDataRequirements(validState);
    expect(res.isValid).toBe(true);
    expect(res.message).toBeUndefined();
  });

  it('fails with settings subtab when rooms is empty', () => {
    const res = validateMasterDataRequirements({ ...validState, rooms: [] });
    expect(res.isValid).toBe(false);
    expect(res.targetSubTab).toBe('settings');
    expect(res.message).toContain('練習室が1部屋も登録されていません');
  });

  it('fails with songs subtab when songs is empty', () => {
    const res = validateMasterDataRequirements({ ...validState, songs: [] });
    expect(res.isValid).toBe(false);
    expect(res.targetSubTab).toBe('songs');
    expect(res.message).toContain('演奏曲が1曲も登録されていません');
  });

  it('fails with entries subtab when entries is empty', () => {
    const res = validateMasterDataRequirements({ ...validState, entries: [] });
    expect(res.isValid).toBe(false);
    expect(res.targetSubTab).toBe('entries');
    expect(res.message).toContain('セクション練習」がまだ1件も登録されていません');
  });
});
