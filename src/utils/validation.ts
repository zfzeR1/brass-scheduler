import type { ScheduleState } from '../types';

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  targetSubTab?: 'settings' | 'songs' | 'entries';
}

/**
 * Validates whether the master data satisfies the minimum prerequisites
 * to transition to STEP 2 (Schedule Generation) or STEP 3 (Sharing).
 */
export function validateMasterDataRequirements(state: ScheduleState): ValidationResult {
  if (!state.rooms || state.rooms.length === 0) {
    return {
      isValid: false,
      message: '⚠️ 練習室が1部屋も登録されていません。\nまずは「1-1 基本設定(時間・部屋)」で練習室を登録してください。',
      targetSubTab: 'settings'
    };
  }
  if (!state.songs || state.songs.length === 0) {
    return {
      isValid: false,
      message: '⚠️ 演奏曲が1曲も登録されていません。\n「1-2 曲・パート編成」で演奏曲を登録してください。',
      targetSubTab: 'songs'
    };
  }
  if (!state.entries || state.entries.length === 0) {
    return {
      isValid: false,
      message: '⚠️ スケジュールを作成する「セクション練習」がまだ1件も登録されていません。\n「1-4 セクション練習」で練習内容を登録してください。',
      targetSubTab: 'entries'
    };
  }
  return { isValid: true };
}
