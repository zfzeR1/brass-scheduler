/**
 * スケジューラーモジュール（ファサード）
 * 責務ごとに分割された各モジュールから再エクスポートし、後方互換性を完全に維持します。
 */

// 時間計算・フォーマット
export {
  parseTimeToMinutes,
  formatMinutesToTime,
  calculateNumSlots,
  getSlotTimeRange
} from './timeUtils';

// パート名・比較フォーマッター
export {
  isSamePart,
  formatPartName
} from './partFormatters';

// スケジュール評価エンジン
export {
  type EvaluationContext,
  createEvaluationContext,
  evaluateScheduleWithContext,
  evaluateSchedule
} from './scheduleEvaluator';

// スケジュール最適化・自動生成
export {
  generateSchedule,
  generateScheduleAsync
} from './scheduleGenerator';
