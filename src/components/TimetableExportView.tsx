import { forwardRef } from 'react';
import type { ScheduleState } from '../types';
import { calculateNumSlots, getSlotTimeRange, formatPartName } from '../utils/scheduler';
import { calculateExportDimensions, formatExportDate, formatScheduleMeta } from '../utils/timetableExport';

export interface TimetableExportViewProps {
  state: ScheduleState;
  title?: string;
  date?: Date;
}

/**
 * Dedicated off-screen/printable timetable view component.
 * Renders the complete multi-room, multi-slot timetable in a high-contrast, clean format:
 * - Fixed computed width (never collapses on mobile)
 * - Complete unclipped part badges (overflow: visible, maxHeight: none)
 * - Free of editing handles, lock toggles, or interactive controls
 * - High-contrast light background with crisp borders for PNG export
 */
export const TimetableExportView = forwardRef<HTMLDivElement, TimetableExportViewProps>(
  function TimetableExportView({ state, title = '吹奏楽部 練習タイムテーブル', date = new Date() }, ref) {
    const { timeSettings, rooms, instruments, songs, entries, assignments } = state;
    const numSlots = calculateNumSlots(
      timeSettings.startTime,
      timeSettings.endTime,
      timeSettings.slotDuration,
      timeSettings.intervalDuration
    );
    const { width } = calculateExportDimensions(rooms.length);
    const meta = formatScheduleMeta(state);
    const formattedDate = formatExportDate(date);

    return (
      <div
        ref={ref}
        style={{
          width: `${width}px`,
          minWidth: `${width}px`,
          backgroundColor: '#ffffff',
          color: '#0f172a',
          padding: '24px 28px',
          boxSizing: 'border-box',
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          WebkitFontSmoothing: 'antialiased'
        }}
      >
        {/* Header Title & Date */}
        <div
          style={{
            borderBottom: '2px solid #0f172a',
            paddingBottom: '16px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end'
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.65rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>🎺</span> {title}
            </h1>
            <div
              style={{
                marginTop: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                alignItems: 'center'
              }}
            >
              <span
                style={{
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              >
                ⏰ {meta.timeRange}
              </span>
              <span
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1'
                }}
              >
                ⏱️ {meta.slotDurationInfo}
              </span>
              <span
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid #cbd5e1'
                }}
              >
                ☕ {meta.intervalInfo}
              </span>
              <span
                style={{
                  backgroundColor: '#e2e8f0',
                  color: '#1e293b',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              >
                📊 {meta.totalSlotsInfo} / {meta.totalRoomsInfo}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
              {formattedDate}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
              Brass Scheduler
            </div>
          </div>
        </div>

        {/* Timetable Grid Table */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#ffffff'
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `140px repeat(${rooms.length}, minmax(180px, 1fr))`,
              backgroundColor: '#f8fafc',
              borderBottom: '2px solid #cbd5e1'
            }}
          >
            {/* Time Column Header */}
            <div
              style={{
                padding: '12px 10px',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRight: '1px solid #cbd5e1'
              }}
            >
              時間帯
            </div>

            {/* Room Column Headers */}
            {rooms.map((room, idx) => {
              const permInst = room.permanentInstrumentId
                ? instruments.find(i => i.id === room.permanentInstrumentId)
                : null;
              return (
                <div
                  key={room.id}
                  style={{
                    padding: '12px 12px',
                    borderRight: idx === rooms.length - 1 ? 'none' : '1px solid #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                      {room.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '1px 6px',
                        backgroundColor: '#e2e8f0',
                        color: '#475569',
                        borderRadius: '4px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      定員 {room.capacity}名
                    </span>
                  </div>
                  {permInst && (
                    <div style={{ marginTop: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #fcd34d',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          fontWeight: 600
                        }}
                      >
                        常設: {permInst.name}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Table Slot Rows */}
          {Array.from({ length: numSlots }).map((_, slotIndex) => {
            const timeRange = getSlotTimeRange(
              slotIndex,
              timeSettings.startTime,
              timeSettings.slotDuration,
              timeSettings.intervalDuration
            );

            return (
              <div
                key={slotIndex}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `140px repeat(${rooms.length}, minmax(180px, 1fr))`,
                  borderBottom: slotIndex === numSlots - 1 ? 'none' : '1px solid #e2e8f0',
                  minHeight: '88px'
                }}
              >
                {/* Time Range Cell */}
                <div
                  style={{
                    padding: '12px 10px',
                    backgroundColor: '#f8fafc',
                    borderRight: '1px solid #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#64748b',
                      backgroundColor: '#e2e8f0',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    第{slotIndex + 1}コマ
                  </span>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      letterSpacing: '0.01em'
                    }}
                  >
                    {timeRange.start} - {timeRange.end}
                  </span>
                </div>

                {/* Room Assignment Cells */}
                {rooms.map((room, roomIdx) => {
                  const asm = assignments.find(
                    a => a.slotIndex === slotIndex && a.roomId === room.id
                  );
                  const entry = asm?.entryId ? entries.find(e => e.id === asm.entryId) : null;
                  const song = entry ? songs.find(s => s.id === entry.songId) : null;

                  return (
                    <div
                      key={room.id}
                      style={{
                        padding: '10px 10px',
                        borderRight: roomIdx === rooms.length - 1 ? 'none' : '1px solid #e2e8f0',
                        backgroundColor: asm?.isPersonalPractice
                          ? '#f5f3ff'
                          : entry
                          ? '#ffffff'
                          : '#fcfcfd',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        gap: '6px'
                      }}
                    >
                      {/* 1. Rehearsal Entry Card */}
                      {entry && (
                        <div
                          style={{
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            backgroundColor: '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            height: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          {/* Song Name & Section */}
                          <div style={{ marginBottom: '6px' }}>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                color: '#0f172a',
                                lineHeight: 1.3
                              }}
                            >
                              {song?.name || '未登録の曲'}
                            </div>
                            <div
                              style={{
                                marginTop: '3px',
                                display: 'inline-block',
                                backgroundColor: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                borderRadius: '4px',
                                padding: '1px 6px',
                                fontSize: '0.74rem',
                                fontWeight: 600
                              }}
                            >
                              🎵 {entry.section}
                            </div>
                          </div>

                          {/* Parts list - NO SCROLLBAR, OVERFLOW VISIBLE */}
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '4px',
                              overflow: 'visible',
                              maxHeight: 'none',
                              marginTop: '6px'
                            }}
                          >
                            {entry.parts.map((p, pIdx) => {
                              const partName = formatPartName(
                                p.instrumentId,
                                p.partIndex,
                                entry.songId,
                                songs,
                                instruments
                              );
                              return (
                                <span
                                  key={pIdx}
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    backgroundColor: '#f1f5f9',
                                    color: '#334155',
                                    border: '1px solid #cbd5e1',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {partName}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 2. Personal Practice Room */}
                      {asm?.isPersonalPractice && (
                        <div
                          style={{
                            border: '1px dashed #a78bfa',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            backgroundColor: '#f5f3ff',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            textAlign: 'center',
                            boxSizing: 'border-box'
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: '0.84rem',
                              color: '#6d28d9',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>🎻</span> 個人練習枠
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#7c3aed', marginTop: '2px' }}>
                            空き部員使用可 (定員 {room.capacity}名)
                          </div>
                        </div>
                      )}

                      {/* 3. Empty Room */}
                      {!entry && !asm?.isPersonalPractice && (
                        <div
                          style={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#94a3b8',
                            fontSize: '0.78rem',
                            fontStyle: 'normal'
                          }}
                        >
                          —
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div
          style={{
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.72rem',
            color: '#64748b',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '10px'
          }}
        >
          <div>
            ※ 練習開始の5分前には各部屋へ移動を完了してください。
          </div>
          <div>
            Generated by Brass Scheduler
          </div>
        </div>
      </div>
    );
  }
);

export default TimetableExportView;
