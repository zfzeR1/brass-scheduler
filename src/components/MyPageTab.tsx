import { useState, useMemo } from 'react';
import type { ScheduleState, Assignment, Song, Instrument } from '../types';
import { calculateNumSlots, getSlotTimeRange, formatPartName } from '../utils/scheduler';
import { User, MapPin, AlertCircle, CheckCircle, Clock, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface MyPageTabProps {
  state: ScheduleState;
}

interface SelectedPart {
  songId: string;
  instrumentId: string;
  partIndex: number;
}

export default function MyPageTab({ state }: MyPageTabProps) {
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const numSlots = useMemo(() => {
    return calculateNumSlots(
      state.timeSettings.startTime,
      state.timeSettings.endTime,
      state.timeSettings.slotDuration,
      state.timeSettings.intervalDuration
    );
  }, [state.timeSettings]);

  // 担当パートを追加・削除する
  const togglePartSelection = (songId: string, instrumentId: string, partIndex: number) => {
    const isSelected = selectedParts.some(
      p => p.songId === songId && p.instrumentId === instrumentId && p.partIndex === partIndex
    );

    if (isSelected) {
      setSelectedParts(prev =>
        prev.filter(p => !(p.songId === songId && p.instrumentId === instrumentId && p.partIndex === partIndex))
      );
    } else {
      setSelectedParts(prev => [...prev, { songId, instrumentId, partIndex }]);
    }
  };

  // 選択可能な全曲の全パートリストを作成
  const availableParts = useMemo(() => {
    const list: Array<{ song: Song; inst: Instrument; partIndex: number; key: string }> = [];
    for (const song of state.songs) {
      for (const instId of Object.keys(song.parts)) {
        const inst = state.instruments.find(i => i.id === instId);
        const count = song.parts[instId];
        if (inst) {
          for (let idx = 0; idx < count; idx++) {
            list.push({
              song,
              inst,
              partIndex: idx,
              key: `${song.id}_${instId}_${idx}`
            });
          }
        }
      }
    }
    return list;
  }, [state.songs, state.instruments]);

  // 各コマにおける特定のユーザー（選択した担当パートのセット）の現在位置（アサイン状態と部屋）をシミュレートする
  const userSchedule = useMemo(() => {
    if (selectedParts.length === 0 || state.assignments.length === 0) return [];

    const schedule = [];

    // 各コマでユーザーがどの部屋にいるべきかを判定
    for (let s = 0; s < numSlots; s++) {
      const slotAsms = state.assignments.filter(asm => asm.slotIndex === s);
      
      let assignedAsm: Assignment | null = null;
      let isPersonal = false;
      let activePart: SelectedPart | null = null;

      // 1. 合同練習を探す (自分が選択したパートのいずれかがアサインされているか)
      for (const part of selectedParts) {
        const found = slotAsms.find(asm => {
          if (!asm.entryId || asm.isPersonalPractice) return false;
          const entry = state.entries.find(e => e.id === asm.entryId);
          return (
            entry &&
            entry.songId === part.songId &&
            entry.parts.some(p => p.instrumentId === part.instrumentId && p.partIndex === part.partIndex)
          );
        });

        if (found) {
          assignedAsm = found;
          activePart = part;
          break;
        }
      }

      // 2. 合同練習がない場合、個人練習としてどの部屋にアサインされているかをシミュレートする
      if (!assignedAsm) {
        // 全パートリスト
        const allPartsList: Array<{ songId: string; instrumentId: string; partIndex: number }> = [];
        for (const song of state.songs) {
          for (const instId of Object.keys(song.parts)) {
            const partCount = song.parts[instId];
            for (let idx = 0; idx < partCount; idx++) {
              allPartsList.push({ songId: song.id, instrumentId: instId, partIndex: idx });
            }
          }
        }

        // コマ s で練習アサインされているパート
        const activeParts: typeof allPartsList = [];
        for (const asm of slotAsms) {
          if (asm.entryId) {
            const entry = state.entries.find(e => e.id === asm.entryId);
            if (entry) {
              for (const p of entry.parts) {
                activeParts.push({ songId: entry.songId, instrumentId: p.instrumentId, partIndex: p.partIndex });
              }
            }
          }
        }

        // 余りパート
        const idleParts = allPartsList.filter(
          ap => !activeParts.some(act => act.songId === ap.songId && act.instrumentId === ap.instrumentId && act.partIndex === ap.partIndex)
        );

        // 個人練習部屋候補
        const personalPracticeRooms: typeof state.rooms = [];
        for (const room of state.rooms) {
          const isAssigned = slotAsms.some(asm => asm.roomId === room.id && asm.entryId);
          if (!isAssigned) {
            if (room.isPersonalPracticeCandidate || room.permanentInstrumentId) {
              personalPracticeRooms.push(room);
            }
          }
        }

        // シミュレーション実行して、自分が選択した最初のパートの行き先を探す
        // (個人練習部屋は代表して 1 つの部屋にいるものとみなす)
        let currentRoomIdx = 0;
        let currentRoomRemainingCap = personalPracticeRooms[currentRoomIdx] ? personalPracticeRooms[currentRoomIdx].capacity : 0;
        let myPracticeRoomId: string | null = null;

        for (const idlePart of idleParts) {
          while (currentRoomIdx < personalPracticeRooms.length && currentRoomRemainingCap <= 0) {
            currentRoomIdx++;
            if (personalPracticeRooms[currentRoomIdx]) {
              currentRoomRemainingCap = personalPracticeRooms[currentRoomIdx].capacity;
            }
          }

          if (currentRoomIdx < personalPracticeRooms.length) {
            // 自分の担当パートのいずれかが一致するか
            const matchedMyPart = selectedParts.find(
              sp => sp.songId === idlePart.songId && sp.instrumentId === idlePart.instrumentId && sp.partIndex === idlePart.partIndex
            );

            if (matchedMyPart) {
              myPracticeRoomId = personalPracticeRooms[currentRoomIdx].id;
              activePart = matchedMyPart;
              break;
            }
            currentRoomRemainingCap--;
          } else {
            break;
          }
        }

        if (myPracticeRoomId) {
          assignedAsm = slotAsms.find(asm => asm.roomId === myPracticeRoomId) || null;
          isPersonal = true;
        }
      }

      const room = state.rooms.find(r => r.id === assignedAsm?.roomId);
      schedule.push({
        slotIndex: s,
        assignment: assignedAsm,
        room,
        isPersonal,
        activePart
      });
    }

    return schedule;
  }, [selectedParts, state.assignments, state.entries, state.rooms, state.songs, numSlots]);

  return (
    <div>
      <h1 className="page-title">個人時間割（マイページ）</h1>
      <p className="page-subtitle">ご自身の担当パートを選択すると、本日の練習スケジュールと移動指示が表示されます。</p>

      {/* Part Selection Panel (Collapsible) */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div
          className="part-selector-header"
          onClick={() => setIsPanelOpen(!isPanelOpen)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <User size={18} style={{ color: 'var(--primary)' }} />
              担当パート
            </h2>
            {selectedParts.length > 0 ? (
              <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                {selectedParts.length}パート選択中
              </span>
            ) : (
              <span className="badge badge-secondary" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                未選択
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            onClick={(e) => {
              e.stopPropagation();
              setIsPanelOpen(!isPanelOpen);
            }}
          >
            {isPanelOpen ? (
              <>
                <span>閉じる</span>
                <ChevronUp size={14} />
              </>
            ) : (
              <>
                <span>変更する</span>
                <ChevronDown size={14} />
              </>
            )}
          </button>
        </div>

        {/* 折りたたみ時: 選択中パートのコンパクト一覧 */}
        {!isPanelOpen && selectedParts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-color)' }}>
            {selectedParts.map((sp, idx) => {
              const song = state.songs.find(s => s.id === sp.songId);
              return (
                <span
                  key={idx}
                  className="badge badge-primary"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                >
                  {song ? `${song.name}: ` : ''}{formatPartName(sp.instrumentId, sp.partIndex, sp.songId, state.songs, state.instruments)}
                </span>
              );
            })}
          </div>
        )}

        {/* 展開時: パート選択ボタングループ */}
        {isPanelOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', padding: '0.25rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              あなたが担当するパートをタップしてください (複数選択可)
            </p>
            {state.songs.map(song => {
              const songParts = availableParts.filter(p => p.song.id === song.id);
              if (songParts.length === 0) return null;
              return (
                <div key={song.id}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    {song.name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {songParts.map(item => {
                      const isSelected = selectedParts.some(
                        p => p.songId === item.song.id && p.instrumentId === item.inst.id && p.partIndex === item.partIndex
                      );
                      return (
                        <button
                          key={item.key}
                          onClick={() => togglePartSelection(item.song.id, item.inst.id, item.partIndex)}
                          className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.45rem 0.7rem', fontSize: '0.78rem', fontWeight: 500, minHeight: '36px' }}
                        >
                          {formatPartName(item.inst.id, item.partIndex, item.song.id, state.songs, state.instruments)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Personal Schedule Display */}
      {selectedParts.length === 0 ? (
        <div style={{ height: '200px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
          <Info size={30} />
          <div>上部のパネルから、担当している「曲とパート」を選択してください。</div>
        </div>
      ) : state.assignments.length === 0 ? (
        <div style={{ height: '200px', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
          <Info size={30} />
          <div>本日の練習スケジュールはまだ生成されていません。管理者によるスケジュール生成をお待ちください。</div>
        </div>
      ) : (
        <div className="mypage-schedule">
          {userSchedule.map((item, idx) => {
            const timeRange = getSlotTimeRange(
              item.slotIndex,
              state.timeSettings.startTime,
              state.timeSettings.slotDuration,
              state.timeSettings.intervalDuration
            );

            // 移動判定 (次のコマでの部屋と比較)
            const nextItem = userSchedule[idx + 1];
            const currentRoomId = item.room?.id;
            const nextRoomId = nextItem?.room?.id;
            const isLastSlot = idx === numSlots - 1;

            const isMoveRequired = !isLastSlot && currentRoomId && nextRoomId && currentRoomId !== nextRoomId;
            const isStayOK = !isLastSlot && currentRoomId && nextRoomId && currentRoomId === nextRoomId;

            // アサインタイプ
            let cardClass = 'mypage-slot-card';
            if (isMoveRequired) cardClass += ' move-required';
            else if (isStayOK) cardClass += ' stay-ok';
            else if (item.isPersonal) cardClass += ' personal-practice';

            const activeSong = state.songs.find(s => s.id === item.activePart?.songId);

            return (
              <div key={item.slotIndex} className={cardClass}>
                {/* 1. 時間帯 */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span className="step-tag" style={{ fontSize: '0.75rem', fontWeight: 700 }}>コマ {item.slotIndex + 1}</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>{timeRange.start} - {timeRange.end}</strong>
                </div>

                {/* 2. 練習内容と部屋 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {item.assignment && item.assignment.entryId ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-primary">合同練習</span>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                          {activeSong?.name}
                        </strong>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          {state.entries.find(e => e.id === item.assignment?.entryId)?.section}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                        <MapPin size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span>練習場所: <strong style={{ color: 'var(--text-primary)' }}>{item.room?.name}</strong></span>
                      </div>
                      {item.activePart && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          担当: {formatPartName(item.activePart.instrumentId, item.activePart.partIndex, item.activePart.songId, state.songs, state.instruments)}
                        </div>
                      )}
                    </>
                  ) : item.isPersonal ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-info">個人練習</span>
                        <strong style={{ fontSize: '1.05rem', color: '#22d3ee' }}>個人練習 / 自習</strong>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                        <MapPin size={15} style={{ color: 'var(--info)', flexShrink: 0 }} />
                        <span>練習場所: <strong style={{ color: 'var(--text-primary)' }}>{item.room?.name}</strong></span>
                      </div>
                      {item.activePart && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          パート: {formatPartName(item.activePart.instrumentId, item.activePart.partIndex, item.activePart.songId, state.songs, state.instruments)}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                      ☕ このコマは練習アサインがありません (待機・自由時間)
                    </div>
                  )}
                </div>

                {/* 3. 移動指示 */}
                <div className="mypage-move-badge">
                  {isLastSlot ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '0.3rem 0' }}>
                      <Clock size={16} style={{ flexShrink: 0 }} />
                      <span>🏁 本日の練習は以上です（お疲れ様でした）</span>
                    </div>
                  ) : isMoveRequired ? (
                    <div className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-md)' }}>
                      <AlertCircle size={18} style={{ flexShrink: 0 }} />
                      <div style={{ textAlign: 'left', fontSize: '0.78rem', lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 700 }}>🔴 移動あり</div>
                        <div>➔ 次の部屋「<strong>{state.rooms.find(r => r.id === nextRoomId)?.name}</strong>」へ移動</div>
                      </div>
                    </div>
                  ) : isStayOK ? (
                    <div className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.85rem', borderRadius: 'var(--radius-md)' }}>
                      <CheckCircle size={18} style={{ flexShrink: 0 }} />
                      <div style={{ textAlign: 'left', fontSize: '0.78rem', lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 700 }}>🟢 移動なし (居残り)</div>
                        <div>インターバル中もこの部屋で練習可能</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      次のコマ: {nextItem?.assignment?.entryId || nextItem?.isPersonal ? '練習あり' : 'なし'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
