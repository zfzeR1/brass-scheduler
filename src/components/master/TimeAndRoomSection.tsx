import React from 'react';
import type { ScheduleState, TimeSettings, Room } from '../../types';
import { removeRoomWithCascade } from '../../utils/scheduleIntegrity';
import { Clock, MapPin, Plus, Trash2 } from 'lucide-react';

export interface TimeAndRoomSectionProps {
  state: ScheduleState;
  setState: React.Dispatch<React.SetStateAction<ScheduleState>>;
}

export default function TimeAndRoomSection({ state, setState }: TimeAndRoomSectionProps) {
  // プルダウン用の時間リスト (5分刻み)
  const generateTimeOptions = () => {
    const options: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 5) {
        const hrs = String(h).padStart(2, '0');
        const mins = String(m).padStart(2, '0');
        options.push(`${hrs}:${mins}`);
      }
    }
    return options;
  };
  const timeOptions = generateTimeOptions();

  const handleTimeChange = (key: keyof TimeSettings, value: string | number) => {
    let val = value;
    if (key === 'slotDuration') {
      const num = Number(value);
      if (!isNaN(num)) {
        val = Math.max(0, Math.min(90, num));
      }
    } else if (key === 'intervalDuration') {
      const num = Number(value);
      if (!isNaN(num)) {
        val = Math.max(0, Math.min(15, num));
      }
    }
    setState(prev => ({
      ...prev,
      timeSettings: {
        ...prev.timeSettings,
        [key]: val
      }
    }));
  };

  const handleAddRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const capacity = Number(formData.get('capacity'));
    const permanentInstrumentId = (formData.get('permanentInstrumentId') as string) || undefined;

    if (!name) return;

    const newRoom: Room = {
      id: 'room-' + Date.now(),
      name,
      capacity,
      isPersonalPracticeCandidate: true,
      permanentInstrumentId: permanentInstrumentId === 'none' ? undefined : permanentInstrumentId
    };

    setState(prev => ({
      ...prev,
      rooms: [...prev.rooms, newRoom]
    }));
    e.currentTarget.reset();
  };

  const handleRemoveRoom = (id: string) => {
    setState(prev => removeRoomWithCascade(prev, id));
  };

  return (
    <div className="grid-2col">
      {/* 時間設定 */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={20} className="badge-primary" />
          練習時間・コマ設定
        </h2>
        <div className="form-group">
          <label className="form-label">開始時刻</label>
          <select
            className="form-control"
            value={state.timeSettings.startTime}
            onChange={e => handleTimeChange('startTime', e.target.value)}
          >
            {timeOptions.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">終了時刻</label>
          <select
            className="form-control"
            value={state.timeSettings.endTime}
            onChange={e => handleTimeChange('endTime', e.target.value)}
          >
            {timeOptions.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">1コマの長さ (分)</label>
          <input
            type="number"
            min="0"
            max="90"
            className="form-control"
            value={state.timeSettings.slotDuration}
            onChange={e => handleTimeChange('slotDuration', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">移動インターバル (分)</label>
          <input
            type="number"
            min="0"
            max="15"
            className="form-control"
            value={state.timeSettings.intervalDuration}
            onChange={e => handleTimeChange('intervalDuration', e.target.value)}
          />
        </div>
      </div>

      {/* 部屋データ */}
      <div className="glass-card grid-span-2">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={20} className="badge-success" />
          部屋（練習室）管理
        </h2>
        <form onSubmit={handleAddRoom} className="form-grid-room">
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">部屋名</label>
            <input name="name" placeholder="部屋名 (例: 音楽室)" className="form-control" required />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">収容定員(人)</label>
            <input name="capacity" type="number" min="1" defaultValue="10" className="form-control" required />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">常設楽器 (移動不可)</label>
            <select name="permanentInstrumentId" className="form-control" defaultValue="none">
              <option value="none">なし (一般の部屋)</option>
              {state.instruments
                .filter(i => i.movementType === 'immovable')
                .map(i => (
                  <option key={i.id} value={i.id}>{i.name}常設</option>
                ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
            <Plus size={16} /> 登録
          </button>
        </form>

        <h3 style={{ fontSize: '1rem', marginTop: '1.5rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
          登録済み部屋
        </h3>
        {/* Desktop: table */}
        <div className="desktop-only">
          <table className="custom-table">
            <thead>
              <tr>
                <th>部屋名</th>
                <th>定員</th>
                <th>常設楽器</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {state.rooms.map(room => {
                const permanentInst = state.instruments.find(i => i.id === room.permanentInstrumentId);
                return (
                  <tr key={room.id}>
                    <td>{room.name}</td>
                    <td>{room.capacity} 人</td>
                    <td>{permanentInst ? permanentInst.name : '-'}</td>
                    <td>
                      <button className="btn btn-secondary btn-icon" onClick={() => handleRemoveRoom(room.id)}>
                        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile: card list */}
        <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {state.rooms.map(room => {
            const permanentInst = state.instruments.find(i => i.id === room.permanentInstrumentId);
            return (
              <div key={room.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    {room.name}
                    <span className="badge badge-primary" style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>{room.capacity}人</span>
                  </div>
                  {permanentInst && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>常設: {permanentInst.name}</div>
                  )}
                </div>
                <button className="btn btn-secondary btn-icon" onClick={() => handleRemoveRoom(room.id)} style={{ flexShrink: 0 }}>
                  <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
