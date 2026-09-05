import React, { useState, useMemo } from 'react';
import type { ScheduleState, Assignment } from '../types';
import {
  calculateNumSlots,
  getSlotTimeRange,
  generateSchedule,
  evaluateSchedule,
  formatPartName
} from '../utils/scheduler';
import {
  Play,
  RotateCcw,
  Lock,
  Unlock,
  Copy,
  Camera,
  CheckCircle,
  AlertTriangle,
  Download,
  Upload,
  Info
} from 'lucide-react';

interface ScheduleTabProps {
  state: ScheduleState;
  setState: React.Dispatch<React.SetStateAction<ScheduleState>>;
}

export default function ScheduleTab({ state, setState }: ScheduleTabProps) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [mobileSlot, setMobileSlot] = useState(0);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const numSlots = useMemo(() => {
    return calculateNumSlots(
      state.timeSettings.startTime,
      state.timeSettings.endTime,
      state.timeSettings.slotDuration,
      state.timeSettings.intervalDuration
    );
  }, [state.timeSettings]);

  // 現在のスケジュールに対する評価結果（違反リスト）
  const evaluation = useMemo(() => {
    if (state.assignments.length === 0) return { score: 0, violations: [] };
    return evaluateSchedule(
      state.assignments,
      state.rooms,
      state.instruments,
      state.songs,
      state.duplicateNGPairs,
      state.entries,
      numSlots
    );
  }, [state.assignments, state.rooms, state.instruments, state.songs, state.duplicateNGPairs, state.entries, numSlots]);

  // 自動スケジュール生成を実行する
  const handleAutoGenerate = (startSlot: number = 0) => {
    const updatedAssignments = generateSchedule(state, startSlot);
    setState(prev => ({
      ...prev,
      assignments: updatedAssignments
    }));
  };

  // ロックの切り替え
  const toggleLock = (slotIndex: number, roomId: string) => {
    setState(prev => {
      const updated = prev.assignments.map(asm => {
        if (asm.slotIndex === slotIndex && asm.roomId === roomId) {
          return { ...asm, isLocked: !asm.isLocked };
        }
        return asm;
      });
      return { ...prev, assignments: updated };
    });
  };

  // --- HTML5 Drag and Drop ---
  const handleDragStart = (e: React.DragEvent, slotIndex: number, roomId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ slotIndex, roomId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, cellId: string) => {
    e.preventDefault();
    setDragOverCell(cellId);
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, destSlotIndex: number, destRoomId: string) => {
    e.preventDefault();
    setDragOverCell(null);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;

      const { slotIndex: srcSlotIndex, roomId: srcRoomId } = JSON.parse(dataStr);

      if (srcSlotIndex === destSlotIndex && srcRoomId === destRoomId) return;

      setState(prev => {
        // 元と先の Assignment を見つけて中身をスワップする
        const srcIdx = prev.assignments.findIndex(
          asm => asm.slotIndex === srcSlotIndex && asm.roomId === srcRoomId
        );
        const destIdx = prev.assignments.findIndex(
          asm => asm.slotIndex === destSlotIndex && asm.roomId === destRoomId
        );

        if (srcIdx === -1 || destIdx === -1) return prev;

        const updated = [...prev.assignments];
        const srcAsm = { ...updated[srcIdx] };
        const destAsm = { ...updated[destIdx] };

        // アサインデータのみを入れ替える (slotIndex や roomId はそのまま)
        updated[srcIdx] = {
          ...srcAsm,
          entryId: destAsm.entryId,
          parts: destAsm.parts,
          isPersonalPractice: destAsm.isPersonalPractice
        };

        updated[destIdx] = {
          ...destAsm,
          entryId: srcAsm.entryId,
          parts: srcAsm.parts,
          isPersonalPractice: srcAsm.isPersonalPractice
        };

        return { ...prev, assignments: updated };
      });
    } catch (err) {
      console.error('Drag drop failed', err);
    }
  };

  // 全体スケジュールのテキストコピー (Markdownフォーマット)
  const handleCopyText = () => {
    if (state.assignments.length === 0) return;

    let text = `## 吹奏楽練習タイムテーブル (${state.timeSettings.startTime} 〜 ${state.timeSettings.endTime})\n\n`;

    for (let s = 0; s < numSlots; s++) {
      const timeRange = getSlotTimeRange(
        s,
        state.timeSettings.startTime,
        state.timeSettings.slotDuration,
        state.timeSettings.intervalDuration
      );
      text += `### コマ ${s + 1} (${timeRange.start} 〜 ${timeRange.end})\n`;

      const slotAsms = state.assignments.filter(asm => asm.slotIndex === s);
      for (const asm of slotAsms) {
        const room = state.rooms.find(r => r.id === asm.roomId);
        if (asm.entryId) {
          const entry = state.entries.find(e => e.id === asm.entryId);
          const song = state.songs.find(sg => sg.id === entry?.songId);
          text += `- **[${room?.name}]** ${song?.name || ''} - ${entry?.section || ''} (参加: `;
          text += entry?.parts
            .map(p => {
              return formatPartName(p.instrumentId, p.partIndex, entry?.songId, state.songs, state.instruments);
            })
            .join(', ') || '';
          text += ')\n';
        } else if (asm.isPersonalPractice) {
          text += `- **[${room?.name}]** 個人練習部屋 (退避パート: `;
          text += asm.parts
            .map(p => {
              const song = state.songs.find(sg => sg.id === p.songId);
              return `${song?.name.substring(0,3)}:${formatPartName(p.instrumentId, p.partIndex, p.songId, state.songs, state.instruments)}`;
            })
            .join(', ') || 'なし';
          text += ')\n';
        } else {
          text += `- **[${room?.name}]** 空き部屋\n`;
        }
      }
      text += '\n';
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // 設定データをJSONとしてダウンロード
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `section_optimizer_settings_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 設定データをJSONからアップロード
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.rooms && parsed.songs && parsed.entries) {
          setState(parsed);
          alert('設定データを正常に読み込みました。');
        } else {
          alert('不正なファイルフォーマットです。');
        }
      } catch (err) {
        alert('ファイルの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
  };

  // --- ヘルパー: 部屋にアサインされている内容を取得 ---
  const renderCellContent = (asm: Assignment) => {
    const entry = state.entries.find(e => e.id === asm.entryId);
    const song = state.songs.find(s => s.id === entry?.songId);

    if (asm.entryId && entry) {
      return (
        <div
          className={`practice-card ${asm.isLocked ? 'is-locked' : ''}`}
          draggable
          onDragStart={e => handleDragStart(e, asm.slotIndex, asm.roomId)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
              {song?.name || '曲名なし'}
            </span>
            <button
              onClick={() => toggleLock(asm.slotIndex, asm.roomId)}
              className="btn btn-secondary btn-icon"
              style={{ padding: '2px', border: 'none', background: 'transparent' }}
              title={asm.isLocked ? '固定を解除' : '位置を固定 (自動生成対象外にする)'}
            >
              {asm.isLocked ? <Lock size={12} style={{ color: 'var(--warning)' }} /> : <Unlock size={12} style={{ color: 'var(--text-muted)' }} />}
            </button>
          </div>
          <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
            {entry.section}
          </strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '0.25rem', maxHeight: '35px', overflowY: 'auto' }}>
            {entry.parts.map(p => {
              return (
                <span key={`${p.instrumentId}_${p.partIndex}`} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '1px 3px', borderRadius: '2px' }}>
                  {formatPartName(p.instrumentId, p.partIndex, entry.songId, state.songs, state.instruments)}
                </span>
              );
            })}
          </div>
        </div>
      );
    }

    if (asm.isPersonalPractice) {
      return (
        <div
          className="practice-card personal-practice"
          draggable
          onDragStart={e => handleDragStart(e, asm.slotIndex, asm.roomId)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>個人練習部屋</span>
            <button
              onClick={() => toggleLock(asm.slotIndex, asm.roomId)}
              className="btn btn-secondary btn-icon"
              style={{ padding: '2px', border: 'none', background: 'transparent' }}
            >
              {asm.isLocked ? <Lock size={12} style={{ color: 'var(--warning)' }} /> : <Unlock size={12} />}
            </button>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            退避中: {asm.parts.length} パート
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '0.25rem', maxHeight: '35px', overflowY: 'auto' }}>
            {asm.parts.map((p, idx) => {
              const pSong = state.songs.find(sg => sg.id === p.songId);
              return (
                <span
                  key={idx}
                  style={{ fontSize: '0.65rem', background: 'rgba(6,182,212,0.1)', padding: '1px 3px', borderRadius: '2px', color: '#22d3ee' }}
                  title={`${pSong?.name || ''} - ${formatPartName(p.instrumentId, p.partIndex, p.songId, state.songs, state.instruments)}`}
                >
                  {pSong ? `${pSong.name.substring(0,2)}:${formatPartName(p.instrumentId, p.partIndex, p.songId, state.songs, state.instruments)}` : formatPartName(p.instrumentId, p.partIndex, undefined, state.songs, state.instruments)}
                </span>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        空き部屋
      </div>
    );
  };

  // スクショ用のシンプル画面切り替え
  if (screenshotMode) {
    return (
      <div style={{ padding: '2rem', background: 'var(--bg-main)', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 className="page-title">練習スケジュール全体タイムテーブル</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              練習時間: {state.timeSettings.startTime} 〜 {state.timeSettings.endTime} | 1コマ: {state.timeSettings.slotDuration}分
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => setScreenshotMode(false)}>
            コントロールに戻る
          </button>
        </div>

        {/* タイムテーブルのみを表示 */}
        <div className="glass-card" style={{ padding: '2rem', overflowX: 'auto' }}>
          <div className="timetable-grid">
            <div className="timetable-header">
              <div style={{ fontWeight: 600 }}>時間枠</div>
              {state.rooms.map(room => (
                <div key={room.id} style={{ fontWeight: 600, paddingLeft: '0.5rem' }}>
                  {room.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({room.capacity}人)</span>
                </div>
              ))}
            </div>

            {Array.from({ length: numSlots }).map((_, s) => {
              const timeRange = getSlotTimeRange(
                s,
                state.timeSettings.startTime,
                state.timeSettings.slotDuration,
                state.timeSettings.intervalDuration
              );
              return (
                <div key={s} className="timetable-row">
                  <div className="timetable-time-col">
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>コマ {s + 1}</span>
                    <strong style={{ fontSize: '0.95rem' }}>{timeRange.start} - {timeRange.end}</strong>
                  </div>
                  {state.rooms.map(room => {
                    const key = `${s}_${room.id}`;
                    const asm = state.assignments.find(a => a.slotIndex === s && a.roomId === room.id);
                    return (
                      <div
                        key={key}
                        className={`timetable-cell ${room.isPersonalPracticeCandidate ? 'personal-practice-room' : ''}`}
                      >
                        {asm ? renderCellContent(asm) : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>空き</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title">スケジュール自動生成・微調整</h1>
          <p className="page-subtitle">マスターデータと制約をもとに、最適な練習スケジュールを自動で生成およびドラッグ調整します。</p>
        </div>
        
        {/* インポート / エクスポート */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleExportJSON} title="JSONでエクスポート" style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}>
            <Download size={14} /> JSON保存
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }} title="JSONからインポート">
            <Upload size={14} /> JSON読み込み
            <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Control Actions */}
      <div className="glass-card" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => handleAutoGenerate(0)} style={{ fontSize: '0.82rem' }}>
            <Play size={16} /> 全体を自動生成
          </button>
          {state.assignments.length > 0 && (
            <>
              <button className="btn btn-secondary" onClick={handleCopyText}>
                <Copy size={16} /> {copySuccess ? 'コピーしました！' : 'テキストコピー'}
              </button>
              <button className="btn btn-secondary" onClick={() => setScreenshotMode(true)}>
                <Camera size={16} /> スクショ用画面
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            現在のスコア:
          </span>
          <span className={`badge ${evaluation.score >= 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.9rem', padding: '0.35rem 0.75rem' }}>
            {evaluation.score.toLocaleString()} 点
          </span>
        </div>
      </div>

      {/* 制約チェック結果（警告/エラー表示） */}
      {state.assignments.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '2rem', borderLeft: `4px solid ${evaluation.violations.length > 0 ? 'var(--warning)' : 'var(--success)'}` }}>
          <h2 style={{ fontSize: '1.05rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {evaluation.violations.length > 0 ? (
              <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
            ) : (
              <CheckCircle size={18} style={{ color: 'var(--success)' }} />
            )}
            制約・最適化チェック結果
          </h2>
          {evaluation.violations.length > 0 ? (
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {evaluation.violations.slice(0, 5).map((v, idx) => (
                <li key={idx} style={{ color: v.includes('超過') || v.includes('NG') || v.includes('移動不可') ? '#f87171' : 'var(--text-secondary)' }}>
                  {v}
                </li>
              ))}
              {evaluation.violations.length > 5 && (
                <li style={{ color: 'var(--text-muted)', listStyleType: 'none', marginTop: '0.25rem' }}>
                  ほか {evaluation.violations.length - 5} 件の警告があります...
                </li>
              )}
            </ul>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>すべてのハード制約（重複NG・キャパシティ・移動不可楽器アサイン）を満たしています！</p>
          )}
        </div>
      )}

      {/* タイムテーブル表示 */}
      {state.assignments.length === 0 ? (
        <div style={{ height: '300px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
          <Info size={36} />
          <div>「全体を自動生成」ボタンを押して、スケジュールを組みましょう。</div>
        </div>
      ) : isMobile ? (
        /* ==================== MOBILE: コマ別タイムライン表示 ==================== */
        <div>
          {/* コマ選択タブ */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', marginBottom: '1rem', paddingBottom: '0.5rem', WebkitOverflowScrolling: 'touch' }}>
            {Array.from({ length: numSlots }).map((_, s) => {
              const timeRange = getSlotTimeRange(s, state.timeSettings.startTime, state.timeSettings.slotDuration, state.timeSettings.intervalDuration);
              const isActive = mobileSlot === s;
              return (
                <button
                  key={s}
                  onClick={() => setMobileSlot(s)}
                  style={{
                    flex: '0 0 auto',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: isActive ? 'rgba(79, 70, 229, 0.15)' : 'var(--bg-surface)',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.1rem',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>コマ {s + 1}</span>
                  <span>{timeRange.start}-{timeRange.end}</span>
                </button>
              );
            })}
          </div>

          {/* 選択中のコマのヘッダー */}
          {(() => {
            const timeRange = getSlotTimeRange(mobileSlot, state.timeSettings.startTime, state.timeSettings.slotDuration, state.timeSettings.intervalDuration);
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>コマ {mobileSlot + 1}</span>
                  <strong style={{ fontSize: '1.15rem', display: 'block', color: 'var(--text-primary)' }}>{timeRange.start} - {timeRange.end}</strong>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                  onClick={() => handleAutoGenerate(mobileSlot)}
                  title="このコマ以降を再計算"
                >
                  <RotateCcw size={12} /> ここから再計算
                </button>
              </div>
            );
          })()}

          {/* 部屋カード一覧（縦並び） */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {state.rooms.map(room => {
              const asm = state.assignments.find(a => a.slotIndex === mobileSlot && a.roomId === room.id);
              const entry = asm?.entryId ? state.entries.find(e => e.id === asm.entryId) : null;
              const song = entry ? state.songs.find(sg => sg.id === entry.songId) : null;

              return (
                <div
                  key={room.id}
                  className="glass-card"
                  style={{
                    padding: '0.85rem',
                    borderLeft: asm?.entryId
                      ? '4px solid var(--primary)'
                      : asm?.isPersonalPractice
                        ? '4px solid var(--info)'
                        : '4px solid var(--border-color)'
                  }}
                >
                  {/* 部屋名ヘッダー */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{room.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({room.capacity}人)</span>
                    </div>
                    {asm && (
                      <button
                        onClick={() => toggleLock(mobileSlot, room.id)}
                        className="btn btn-secondary btn-icon"
                        style={{ padding: '4px', border: 'none', background: 'transparent' }}
                        title={asm.isLocked ? '固定を解除' : '位置を固定'}
                      >
                        {asm.isLocked ? <Lock size={14} style={{ color: 'var(--warning)' }} /> : <Unlock size={14} style={{ color: 'var(--text-muted)' }} />}
                      </button>
                    )}
                  </div>

                  {/* 内容 */}
                  {asm?.entryId && entry ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                        <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{song?.name || '曲名なし'}</span>
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                        {entry.section}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {entry.parts.map(p => (
                          <span
                            key={`${p.instrumentId}_${p.partIndex}`}
                            style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', padding: '2px 5px', borderRadius: '3px', border: '1px solid var(--border-color)' }}
                          >
                            {formatPartName(p.instrumentId, p.partIndex, entry.songId, state.songs, state.instruments)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : asm?.isPersonalPractice ? (
                    <div>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem', marginBottom: '0.35rem' }}>個人練習部屋</span>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        退避中: {asm.parts.length} パート
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                        {asm.parts.map((p, idx) => {
                          const pSong = state.songs.find(sg => sg.id === p.songId);
                          return (
                            <span
                              key={idx}
                              style={{ fontSize: '0.68rem', background: 'rgba(6,182,212,0.1)', padding: '2px 4px', borderRadius: '3px', color: '#22d3ee' }}
                            >
                              {pSong ? `${pSong.name.substring(0,3)}:` : ''}{formatPartName(p.instrumentId, p.partIndex, p.songId, state.songs, state.instruments)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                      空き部屋
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ==================== DESKTOP: 従来のグリッド表示 ==================== */
        <div className="glass-card" style={{ overflowX: 'auto', padding: '1.5rem' }}>
          <div className="timetable-grid">
            {/* Header */}
            <div className="timetable-header">
              <div style={{ fontWeight: 600 }}>時間枠</div>
              {state.rooms.map(room => (
                <div key={room.id} style={{ fontWeight: 600, paddingLeft: '0.5rem' }}>
                  {room.name}
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    定員: {room.capacity}人
                  </div>
                </div>
              ))}
            </div>

            {/* Rows */}
            {Array.from({ length: numSlots }).map((_, s) => {
              const timeRange = getSlotTimeRange(
                s,
                state.timeSettings.startTime,
                state.timeSettings.slotDuration,
                state.timeSettings.intervalDuration
              );
              return (
                <div key={s} className="timetable-row">
                  {/* 時間列＆再計算トリガー */}
                  <div className="timetable-time-col">
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>コマ {s + 1}</span>
                    <strong style={{ fontSize: '0.9rem' }}>{timeRange.start} - {timeRange.end}</strong>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '2px 6px', fontSize: '0.65rem', marginTop: '0.5rem', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '2px' }}
                      onClick={() => handleAutoGenerate(s)}
                      title="このコマ以降だけを対象に、現在の割り当て（ロック含む）を引き継いで再計算します。"
                    >
                      <RotateCcw size={10} /> ここから再計算
                    </button>
                  </div>

                  {/* 各部屋のセル */}
                  {state.rooms.map(room => {
                    const key = `${s}_${room.id}`;
                    const asm = state.assignments.find(a => a.slotIndex === s && a.roomId === room.id);
                    const isDragOver = dragOverCell === key;

                    return (
                      <div
                        key={key}
                        className={`timetable-cell ${room.isPersonalPracticeCandidate ? 'personal-practice-room' : ''} ${isDragOver ? 'drag-over' : ''}`}
                        onDragOver={e => handleDragOver(e, key)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, s, room.id)}
                      >
                        {asm ? renderCellContent(asm) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
