import { toPng } from 'html-to-image';
import type { ScheduleState } from '../types';
import { calculateNumSlots } from './scheduler';

export interface ExportOptions {
  pixelRatio?: number;
  cacheBust?: boolean;
  backgroundColor?: string;
  quality?: number;
  width?: number;
  height?: number;
}

/**
 * Generates formatted filename `brass-timetable-YYYYMMDD.png`
 */
export function formatExportFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `brass-timetable-${year}${month}${day}.png`;
}

/**
 * Calculates export view width ensuring full grid layout without collapsing on mobile screens.
 * Formula: max(1000px, 140px + state.rooms.length * 200px)
 */
export function calculateExportDimensions(roomCount: number): { width: number; minWidth: number } {
  const count = Math.max(0, roomCount);
  const calculatedWidth = 140 + count * 200;
  const width = Math.max(1000, calculatedWidth);
  return { width, minWidth: width };
}

/**
 * Formats date string for the timetable title (e.g. "2026年9月12日")
 */
export function formatExportDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${year}年${month}月${day}日(${dayOfWeek})`;
}

/**
 * Formats timetable meta summary info (slot duration, interval, total slots, total rooms)
 */
export function formatScheduleMeta(state: ScheduleState): {
  timeRange: string;
  slotDurationInfo: string;
  intervalInfo: string;
  totalSlotsInfo: string;
  totalRoomsInfo: string;
} {
  const { startTime, endTime, slotDuration, intervalDuration } = state.timeSettings;
  const numSlots = calculateNumSlots(startTime, endTime, slotDuration, intervalDuration);

  return {
    timeRange: `${startTime} - ${endTime}`,
    slotDurationInfo: `1コマ: ${slotDuration}分`,
    intervalInfo: `休憩・移動: ${intervalDuration}分`,
    totalSlotsInfo: `全${numSlots}コマ`,
    totalRoomsInfo: `練習場所: 全${state.rooms.length}室`
  };
}

/**
 * Generates PNG data URL from a DOM element using html-to-image with retina pixelRatio.
 */
export async function generateTimetableDataUrl(
  element: HTMLElement,
  options?: ExportOptions
): Promise<string> {
  if (!element) {
    throw new Error('Target DOM element for export is not provided.');
  }

  const exportOptions = {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#ffffff',
    style: {
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    },
    ...options
  };

  return await toPng(element, exportOptions);
}

/**
 * Triggers a browser download for a given data URL and filename.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  if (typeof document === 'undefined') return;

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Complete export helper: captures DOM element to PNG and initiates browser download.
 * Returns the generated PNG data URL for preview modals or further usage.
 */
export async function exportTimetableToPng(
  element: HTMLElement,
  filename?: string,
  options?: ExportOptions
): Promise<string> {
  const targetFilename = filename || formatExportFilename();
  const dataUrl = await generateTimetableDataUrl(element, options);
  downloadDataUrl(dataUrl, targetFilename);
  return dataUrl;
}
