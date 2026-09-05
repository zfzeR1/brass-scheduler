import { useState, useMemo } from 'react';
import type { ScheduleState, Assignment, Song, Instrument } from '../types';
import { calculateNumSlots, getSlotTimeRange, formatPartName } from '../utils/scheduler';
import { User, MapPin, AlertCircle, CheckCircle, Clock, Info } from 'lucide-react';

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

      {/* Part Selection Panel */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={18} className="badge-primary" />
          担当パートを選択してください (複数選択可)
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', padding: '0.25rem' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>コマ {item.slotIndex + 1}</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{timeRange.start} - {timeRange.end}</strong>
                </div>

                {/* 2. 練習内容と部屋 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {item.assignment && item.assignment.entryId ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge badge-primary">合同練習</span>
                        <strong style={{ fontSize: '1rem' }}>
                          {activeSong?.name} - {state.entries.find(e => e.id === item.assignment?.entryId)?.section}
                        </strong>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MapPin size={14} />
                        場所: <strong>{item.room?.name}</strong> (定員: {item.room?.capacity}人)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        アサインされた担当: {item.activePart ? formatPartName(item.activePart.instrumentId, item.activePart.partIndex, item.activePart.songId, state.songs, state.instruments) : ''}
                      </div>
                    </>
                  ) : item.isPersonal ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge badge-info">個人練習</span>
                        <strong style={{ fontSize: '1.05rem', color: '#22d3ee' }}>個人練習 / 自習</strong>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MapPin size={14} />
                        場所: <strong>{item.room?.name}</strong> (個人練習部屋として兼用中)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        対象パート: {item.activePart ? formatPartName(item.activePart.instrumentId, item.activePart.partIndex, item.activePart.songId, state.songs, state.instruments) : ''}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      このコマは練習アサインがありません (待機・自由時間)
                    </div>
                  )}
                </div>

                {/* 3. 移動指示 */}
                <div className="mypage-move-badge" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {isLastSlot ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <Clock size={16} />
                      <span>本日の練習は以上です</span>
                    </div>
                  ) : isMoveRequired ? (
                    <div className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <AlertCircle size={16} />
                      <div style={{ textAlign: 'left', fontSize: '0.75rem' }}>
                        <div style={{ fontWeight: 700 }}>要 {state.timeSettings.intervalDuration}分前退室</div>
                        <div>次の部屋「{state.rooms.find(r => r.id === nextRoomId)?.name}」へ移動</div>
                      </div>
                    </div>
                  ) : isStayOK ? (
                    <div className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)' }}>
                      <CheckCircle size={16} />
                      <div style={{ textAlign: 'left', fontSize: '0.75rem' }}>
                        <div style={{ fontWeight: 700 }}>移動なし (居残り)</div>
                        <div>インターバル中もノンストップ練習可能</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      次のスケジュール: {nextItem?.assignment?.entryId || nextItem?.isPersonal ? 'あり' : 'なし'}
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
