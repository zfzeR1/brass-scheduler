/**
 * 時間計算および時間帯フォーマットユーティリティ
 */

/**
 * 'HH:MM' 形式の文字列を分単位の数値に変換します。
 * 不正な入力（空文字、区切りなし、NaN）に対しては NaN を返します。
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return NaN;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return NaN;
  const [hrs, mins] = parts.map(Number);
  if (isNaN(hrs) || isNaN(mins)) return NaN;
  return hrs * 60 + mins;
}

/**
 * 分単位の数値を 'HH:MM' 形式の文字列に変換します。
 */
export function formatMinutesToTime(mins: number): string {
  if (isNaN(mins) || mins < 0) return '00:00';
  const hrs = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${String(hrs).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 開始時刻・終了時刻・1コマの長さ・インターバル時間から全体の総コマ数を計算します。
 */
export function calculateNumSlots(
  startTime: string,
  endTime: string,
  slotDuration: number,
  intervalDuration: number
): number {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  if (isNaN(startMins) || isNaN(endMins)) return 0;
  const totalMinutes = endMins - startMins;

  if (isNaN(totalMinutes) || totalMinutes <= 0) return 0;

  const cycle = slotDuration + intervalDuration;
  if (isNaN(cycle) || cycle <= 0) return 0;

  const slots = Math.floor((totalMinutes + intervalDuration) / cycle);
  return Math.max(0, isNaN(slots) ? 0 : slots);
}

/**
 * 指定したコマインデックスの時間帯（開始・終了文字列）を取得します。
 */
export function getSlotTimeRange(
  slotIndex: number,
  startTime: string,
  slotDuration: number,
  intervalDuration: number
): { start: string; end: string } {
  const startMins = parseTimeToMinutes(startTime);
  const safeStartMins = isNaN(startMins) ? 0 : startMins;
  const slotStart = safeStartMins + slotIndex * (slotDuration + intervalDuration);
  const slotEnd = slotStart + slotDuration;

  return {
    start: formatMinutesToTime(slotStart),
    end: formatMinutesToTime(slotEnd)
  };
}
