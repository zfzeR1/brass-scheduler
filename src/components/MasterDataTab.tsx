import React, { useState } from 'react';
import type {
  ScheduleState,
  TimeSettings,
  Room,
  Song,
  DuplicateNGPair,
  Entry,
  PartReference
} from '../types';
import { STANDARD_PART_COUNTS } from '../types';
import { Plus, Trash2, Clock, MapPin, CheckSquare, Square, ArrowUp, ArrowDown, Edit3, ChevronRight } from 'lucide-react';
import { formatPartName } from '../utils/scheduler';

interface MasterDataTabProps {
  state: ScheduleState;
  setState: React.Dispatch<React.SetStateAction<ScheduleState>>;
  onProceedToSchedule?: () => void;
}

export default function MasterDataTab({ state, setState, onProceedToSchedule }: MasterDataTabProps) {
  const [subTab, setSubTab] = useState<'settings' | 'songs' | 'ng-pairs' | 'entries'>('settings');

  // 未入力事前チェック（ガード機能）
  const validateAndProceedToSchedule = () => {
    if (state.rooms.length === 0) {
      alert('⚠️ 練習室が1部屋も登録されていません。\nまずは「1-1 基本設定(時間・部屋)」で練習室を登録してください。');
      setSubTab('settings');
      return;
    }
    if (state.songs.length === 0) {
      alert('⚠️ 演奏曲が1曲も登録されていません。\n「1-2 曲・パート編成」で演奏曲を登録してください。');
      setSubTab('songs');
      return;
    }
    if (state.entries.length === 0) {
      alert('⚠️ スケジュールを作成する「セクション練習」がまだ1件も登録されていません。\n「1-4 セクション練習」で練習内容を登録してください。');
      setSubTab('entries');
      return;
    }
    if (onProceedToSchedule) {
      onProceedToSchedule();
    }
  };

  // --- セクション練習 編集用ステート ---
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editSection, setEditSection] = useState<string>('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editParts, setEditParts] = useState<Array<{ instrumentId: string; partIndex: number }>>([]);

  // --- 1. 時間・部屋・楽器設定のハンドラー ---
  const handleTimeChange = (key: keyof TimeSettings, value: any) => {
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
    const permanentInstrumentId = formData.get('permanentInstrumentId') as string || undefined;

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
    setState(prev => ({
      ...prev,
      rooms: prev.rooms.filter(r => r.id !== id)
    }));
  };


  // --- 2. 曲データ設定のハンドラー ---
  const [tempSongParts, setTempSongParts] = useState<{ [instId: string]: number }>({});
  const [songExtraInstruments, setSongExtraInstruments] = useState<Array<{ id: string; name: string; movementType: 'movable' | 'avoid_movement' | 'immovable' }>>([]);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editSongParts, setEditSongParts] = useState<{ [instId: string]: number }>({});
  const [editSongExtraInsts, setEditSongExtraInsts] = useState<Array<{ id: string; name: string; movementType: 'movable' | 'avoid_movement' | 'immovable' }>>([]);

  // Initialize tempSongParts with registered instruments defaults when instruments change
  const getDefaultSongParts = (): { [instId: string]: number } => {
    const defaults: { [instId: string]: number } = {};
    state.instruments.forEach(inst => {
      defaults[inst.id] = STANDARD_PART_COUNTS[inst.id] ?? 1;
    });
    return defaults;
  };

  const handleAddSong = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    if (!name) return;

    // Merge default parts with user overrides
    const defaults = getDefaultSongParts();
    const mergedParts: { [instId: string]: number } = { ...defaults };
    for (const [instId, count] of Object.entries(tempSongParts)) {
      mergedParts[instId] = count;
    }
    // Add song-specific extra instruments to global instruments list
    if (songExtraInstruments.length > 0) {
      setState(prev => ({
        ...prev,
        instruments: [...prev.instruments, ...songExtraInstruments]
      }));
      // Also include them in song parts
      songExtraInstruments.forEach(inst => {
        if (!(inst.id in mergedParts)) {
          mergedParts[inst.id] = 1;
        }
      });
    }
    // Filter out parts with 0 count
    const filteredParts: { [instId: string]: number } = {};
    for (const [instId, count] of Object.entries(mergedParts)) {
      if (count > 0) filteredParts[instId] = count;
    }

    const newSong: Song = {
      id: 'song-' + Date.now(),
      name,
      parts: filteredParts
    };

    setState(prev => ({
      ...prev,
      songs: [...prev.songs, newSong]
    }));
    setTempSongParts({});
    setSongExtraInstruments([]);
    e.currentTarget.reset();
  };

  // Song-specific extra instrument add handler
  const handleAddSongExtraInstrument = () => {
    const name = prompt('追加する楽器名を入力してください:');
    if (!name || name.trim() === '') return;
    // Check if already registered
    if (state.instruments.some(i => i.name === name.trim()) || songExtraInstruments.some(i => i.name === name.trim())) {
      alert('この楽器は既に登録されています。');
      return;
    }
    const newInst = {
      id: 'inst-' + Date.now(),
      name: name.trim(),
      movementType: 'movable' as const
    };
    setSongExtraInstruments(prev => [...prev, newInst]);
    setTempSongParts(prev => ({ ...prev, [newInst.id]: 1 }));
  };

  // Edit song handlers
  const handleStartEditSong = (song: Song) => {
    setEditingSongId(song.id);
    // Build edit parts: include all registered instruments + any song-specific ones
    const parts: { [instId: string]: number } = {};
    state.instruments.forEach(inst => {
      parts[inst.id] = song.parts[inst.id] ?? 0;
    });
    // Include any instruments in the song that aren't in the global list
    for (const instId of Object.keys(song.parts)) {
      if (!(instId in parts)) {
        parts[instId] = song.parts[instId];
      }
    }
    setEditSongParts(parts);
    setEditSongExtraInsts([]);
  };

  const handleSaveEditSong = (songId: string) => {
    // Register any extra instruments globally
    if (editSongExtraInsts.length > 0) {
      setState(prev => ({
        ...prev,
        instruments: [...prev.instruments, ...editSongExtraInsts]
      }));
    }
    // Merge and filter parts
    const filteredParts: { [instId: string]: number } = {};
    for (const [instId, count] of Object.entries(editSongParts)) {
      if (count > 0) filteredParts[instId] = count;
    }
    setState(prev => ({
      ...prev,
      songs: prev.songs.map(s => s.id === songId ? { ...s, parts: filteredParts } : s)
    }));
    setEditingSongId(null);
    setEditSongExtraInsts([]);
  };

  const handleCancelEditSong = () => {
    setEditingSongId(null);
    setEditSongExtraInsts([]);
  };

  const handleAddEditSongExtraInstrument = () => {
    const name = prompt('追加する楽器名を入力してください:');
    if (!name || name.trim() === '') return;
    if (state.instruments.some(i => i.name === name.trim()) || editSongExtraInsts.some(i => i.name === name.trim())) {
      alert('この楽器は既に登録されています。');
      return;
    }
    const newInst = {
      id: 'inst-' + Date.now(),
      name: name.trim(),
      movementType: 'movable' as const
    };
    setEditSongExtraInsts(prev => [...prev, newInst]);
    setEditSongParts(prev => ({ ...prev, [newInst.id]: 1 }));
  };

  const handleRemoveSong = (id: string) => {
    setState(prev => ({
      ...prev,
      songs: prev.songs.filter(s => s.id !== id)
    }));
  };

  // --- 3. 重複NG設定（兼任）のハンドラー ---
  const [ngPartA, setNgPartA] = useState<PartReference>({ songId: '', instrumentId: '', partIndex: 0 });
  const [ngPartB, setNgPartB] = useState<PartReference>({ songId: '', instrumentId: '', partIndex: 0 });

  const getSongParts = (songId: string): Array<{ instrumentId: string; partIndex: number; label: string }> => {
    const song = state.songs.find(s => s.id === songId);
    if (!song) return [];

    const list: Array<{ instrumentId: string; partIndex: number; label: string }> = [];
    for (const instId of Object.keys(song.parts)) {
      const count = song.parts[instId];
      for (let idx = 0; idx < count; idx++) {
        list.push({
          instrumentId: instId,
          partIndex: idx,
          label: formatPartName(instId, idx, songId, state.songs, state.instruments)
        });
      }
    }
    return list;
  };

  const handleAddNGPair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ngPartA.songId || !ngPartA.instrumentId || !ngPartB.songId || !ngPartB.instrumentId) return;

    const newPair: DuplicateNGPair = {
      id: 'ng-' + Date.now(),
      partA: { ...ngPartA },
      partB: { ...ngPartB }
    };

    setState(prev => ({
      ...prev,
      duplicateNGPairs: [...prev.duplicateNGPairs, newPair]
    }));
  };

  const handleRemoveNGPair = (id: string) => {
    setState(prev => ({
      ...prev,
      duplicateNGPairs: prev.duplicateNGPairs.filter(p => p.id !== id)
    }));
  };

  // --- 4. 練習エントリー登録のハンドラー ---
  const [entrySongId, setEntrySongId] = useState<string>('');
  const [entryParts, setEntryParts] = useState<Array<{ instrumentId: string; partIndex: number }>>([]);

  const toggleEntryPart = (instrumentId: string, partIndex: number) => {
    const exists = entryParts.some(p => p.instrumentId === instrumentId && p.partIndex === partIndex);
    if (exists) {
      setEntryParts(prev => prev.filter(p => !(p.instrumentId === instrumentId && p.partIndex === partIndex)));
    } else {
      setEntryParts(prev => [...prev, { instrumentId, partIndex }]);
    }
  };

  const handleAddEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const section = formData.get('section') as string;
    const priority = formData.get('priority') as any;

    if (!entrySongId || !section || entryParts.length === 0) return;

    const newEntry: Entry = {
      id: 'entry-' + Date.now(),
      songId: entrySongId,
      section,
      parts: [...entryParts],
      priority
    };

    setState(prev => ({
      ...prev,
      entries: [...prev.entries, newEntry]
    }));

    setEntryParts([]);
    e.currentTarget.reset();
  };

  const handleRemoveEntry = (id: string) => {
    setState(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e.id !== id)
    }));
  };

  const handleStartEditEntry = (entry: Entry) => {
    setEditingEntryId(entry.id);
    setEditSection(entry.section);
    setEditPriority(entry.priority);
    setEditParts([...entry.parts]);
  };

  const handleSaveEditEntry = (id: string) => {
    setState(prev => ({
      ...prev,
      entries: prev.entries.map(e => e.id === id ? { ...e, section: editSection, priority: editPriority, parts: editParts } : e)
    }));
    setEditingEntryId(null);
  };

  const handleCancelEditEntry = () => {
    setEditingEntryId(null);
  };

  const handleMoveEntry = (index: number, direction: 'up' | 'down') => {
    setState(prev => {
      const list = [...prev.entries];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      
      return {
        ...prev,
        entries: list
      };
    });
  };

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

  return (
    <div>
      <h1 className="page-title">基本条件設定</h1>
      <p className="page-subtitle">スケジュール割り当ての前提となる基本条件を設定します。</p>

      {/* 準備状況ダッシュボード */}
      <div className="status-dashboard glass-card" style={{ marginBottom: '1.5rem', padding: '0.85rem 1rem' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CheckSquare size={16} style={{ color: 'var(--primary)' }} />
          <span>設定ステップ（タップで項目を切り替え）</span>
        </div>
        <div className="dashboard-grid">
          {/* 1-1 時間・部屋 */}
          <div
            className={`dashboard-card ${subTab === 'settings' ? 'active' : ''}`}
            onClick={() => setSubTab('settings')}
          >
            <div className="dashboard-card-header">
              <span className="step-tag">1-1</span>
              <span className="card-title">時間・部屋</span>
            </div>
            <div className="card-status">
              {state.rooms.length > 0 ? (
                <span className="status-badge success">✅ {state.rooms.length}部屋</span>
              ) : (
                <span className="status-badge warning">⚠️ 未登録</span>
              )}
            </div>
          </div>

          {/* 1-2 演奏曲 */}
          <div
            className={`dashboard-card ${subTab === 'songs' ? 'active' : ''}`}
            onClick={() => setSubTab('songs')}
          >
            <div className="dashboard-card-header">
              <span className="step-tag">1-2</span>
              <span className="card-title">演奏曲・編成</span>
            </div>
            <div className="card-status">
              {state.songs.length > 0 ? (
                <span className="status-badge success">✅ {state.songs.length}曲</span>
              ) : (
                <span className="status-badge danger">⚠️ 未登録(必須)</span>
              )}
            </div>
          </div>

          {/* 1-3 重複NG */}
          <div
            className={`dashboard-card ${subTab === 'ng-pairs' ? 'active' : ''}`}
            onClick={() => setSubTab('ng-pairs')}
          >
            <div className="dashboard-card-header">
              <span className="step-tag">1-3</span>
              <span className="card-title">重複NG</span>
            </div>
            <div className="card-status">
              <span className="status-badge neutral">⚪ 任意 ({state.duplicateNGPairs.length}件)</span>
            </div>
          </div>

          {/* 1-4 練習内容 */}
          <div
            className={`dashboard-card ${subTab === 'entries' ? 'active' : ''}`}
            onClick={() => setSubTab('entries')}
          >
            <div className="dashboard-card-header">
              <span className="step-tag">1-4</span>
              <span className="card-title">セクション練習</span>
            </div>
            <div className="card-status">
              {state.entries.length > 0 ? (
                <span className="status-badge success">✅ {state.entries.length}件</span>
              ) : (
                <span className="status-badge danger">⚠️ 未登録(必須)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SUB TAB: BASIC SETTINGS */}
      {subTab === 'settings' && (
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

            {/* 次のステップへ */}
            <div className="next-step-bar" style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-primary btn-next-step"
                onClick={() => {
                  if (state.rooms.length === 0) {
                    alert('⚠️ 練習室を最低1部屋登録してください。');
                    return;
                  }
                  setSubTab('songs');
                }}
              >
                次へ: 1-2 曲・パート編成へ <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB: SONG & PARTS */}
      {subTab === 'songs' && (
        <div className="grid-2col">
          <div className="glass-card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>曲データ・パート編成登録</h2>

            {/* 曲登録フォーム */}
            <form onSubmit={handleAddSong}>
              <div className="form-group">
                <label className="form-label">曲名</label>
                <input name="name" placeholder="曲名 (例: 宝島)" className="form-control" required />
              </div>

              <div className="form-group">
                <label className="form-label">パート編成 (各楽器のパート数)</label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>標準パート数が自動セットされています。使わない楽器は0に設定してください。</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', padding: '0.25rem' }}>
                  {state.instruments.map(inst => {
                    const defaultCount = STANDARD_PART_COUNTS[inst.id] ?? 1;
                    return (
                      <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', flex: '1', minWidth: '100px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {inst.name}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="4"
                          placeholder={String(defaultCount)}
                          className="form-control"
                          style={{ padding: '0.35rem', width: '60px' }}
                          value={tempSongParts[inst.id] ?? defaultCount}
                          onChange={e => {
                            const val = Math.max(0, Math.min(4, Number(e.target.value)));
                            setTempSongParts(prev => ({
                              ...prev,
                              [inst.id]: val
                            }));
                          }}
                        />
                      </div>
                    );
                  })}
                  {/* Song-specific extra instruments */}
                  {songExtraInstruments.map(inst => (
                    <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', flex: '1', minWidth: '100px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--primary)' }}>
                        {inst.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(追加)</span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="4"
                        placeholder="1"
                        className="form-control"
                        style={{ padding: '0.35rem', width: '60px' }}
                        value={tempSongParts[inst.id] ?? ''}
                        onChange={e => {
                          const val = Math.max(0, Math.min(4, Number(e.target.value)));
                          setTempSongParts(prev => ({
                            ...prev,
                            [inst.id]: val
                          }));
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon"
                        onClick={() => {
                          setSongExtraInstruments(prev => prev.filter(i => i.id !== inst.id));
                          setTempSongParts(prev => {
                            const next = { ...prev };
                            delete next[inst.id];
                            return next;
                          });
                        }}
                      >
                        <Trash2 size={12} style={{ color: 'var(--danger)' }} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  onClick={handleAddSongExtraInstrument}
                >
                  <Plus size={14} /> この曲に楽器を追加
                </button>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <Plus size={16} /> 曲を追加
              </button>
            </form>
          </div>

          <div className="glass-card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>登録済み曲リスト</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {state.songs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>登録されている曲はありません。</p>
              ) : (
                state.songs.map(song => {
                  const isEditing = editingSongId === song.id;
                  return (
                    <div key={song.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{song.name}</strong>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {isEditing ? (
                            <>
                              <button
                                className="btn btn-primary"
                                onClick={() => handleSaveEditSong(song.id)}
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                              >
                                保存
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={handleCancelEditSong}
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-secondary btn-icon"
                                onClick={() => handleStartEditSong(song)}
                                title="編集"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button className="btn btn-secondary btn-icon" onClick={() => handleRemoveSong(song.id)}>
                                <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.25rem 0' }}>パート数を変更 (0にすると削除)</p>
                          {state.instruments.map(inst => (
                            <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.82rem', flex: '1', minWidth: '100px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {inst.name}
                              </span>
                              <input
                                type="number"
                                min="0"
                                max="4"
                                className="form-control"
                                style={{ padding: '0.3rem', width: '55px', fontSize: '0.82rem' }}
                                value={editSongParts[inst.id] ?? 0}
                                onChange={e => {
                                  const val = Math.max(0, Math.min(4, Number(e.target.value)));
                                  setEditSongParts(prev => ({ ...prev, [inst.id]: val }));
                                }}
                              />
                            </div>
                          ))}
                          {/* Extra instruments only in this song */}
                          {Object.keys(song.parts)
                            .filter(instId => !state.instruments.some(i => i.id === instId))
                            .map(instId => {
                              const instName = instId;
                              return (
                                <div key={instId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.82rem', flex: '1', color: 'var(--text-muted)' }}>{instName}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="4"
                                    className="form-control"
                                    style={{ padding: '0.3rem', width: '55px', fontSize: '0.82rem' }}
                                    value={editSongParts[instId] ?? 0}
                                    onChange={e => {
                                      const val = Math.max(0, Math.min(4, Number(e.target.value)));
                                      setEditSongParts(prev => ({ ...prev, [instId]: val }));
                                    }}
                                  />
                                </div>
                              );
                            })}
                          {/* Edit mode: add extra instrument */}
                          {editSongExtraInsts.map(inst => (
                            <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.82rem', flex: '1', color: 'var(--primary)' }}>
                                {inst.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(追加)</span>
                              </span>
                              <input
                                type="number"
                                min="0"
                                max="4"
                                className="form-control"
                                style={{ padding: '0.3rem', width: '55px', fontSize: '0.82rem' }}
                                value={editSongParts[inst.id] ?? 1}
                                onChange={e => {
                                  const val = Math.max(0, Math.min(4, Number(e.target.value)));
                                  setEditSongParts(prev => ({ ...prev, [inst.id]: val }));
                                }}
                              />
                              <button
                                type="button"
                                className="btn btn-secondary btn-icon"
                                onClick={() => {
                                  setEditSongExtraInsts(prev => prev.filter(i => i.id !== inst.id));
                                  setEditSongParts(prev => { const n = { ...prev }; delete n[inst.id]; return n; });
                                }}
                              >
                                <Trash2 size={12} style={{ color: 'var(--danger)' }} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ marginTop: '0.25rem', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                            onClick={handleAddEditSongExtraInstrument}
                          >
                            <Plus size={12} /> 楽器を追加
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {state.instruments.map(inst => {
                            const count = song.parts[inst.id] || 0;
                            if (count <= 0) return null;
                            return (
                              <span key={inst.id} className="badge badge-primary">
                                {inst.name}: {count}
                              </span>
                            );
                          })}
                          {/* Show instruments in song but not in global list */}
                          {Object.keys(song.parts)
                            .filter(instId => !state.instruments.some(i => i.id === instId) && song.parts[instId] > 0)
                            .map(instId => (
                              <span key={instId} className="badge badge-secondary">
                                {instId}: {song.parts[instId]}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 次のステップへ */}
            <div className="next-step-bar" style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-primary btn-next-step"
                onClick={() => {
                  if (state.songs.length === 0) {
                    alert('⚠️ 演奏曲を最低1曲登録してください。');
                    return;
                  }
                  setSubTab('ng-pairs');
                }}
              >
                次へ: 1-3 重複NG設定へ <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB: DUPLICATE NG (SHARED PARTS) */}
      {subTab === 'ng-pairs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* 重複NG設定フォーム */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>重複NG設定</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              異なる曲の間で、同じ人が兼任しているパートを登録します。登録されたパート同士は、絶対に同じ時間帯に並行して割り当てられません。
            </p>

            <form onSubmit={handleAddNGPair} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-grid-ng">
                {/* Side A */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">曲</label>
                    <select
                      className="form-control"
                      value={ngPartA.songId}
                      onChange={e => setNgPartA({ songId: e.target.value, instrumentId: '', partIndex: 0 })}
                      required
                    >
                      <option value="">曲を選択</option>
                      {state.songs.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">楽器</label>
                    <select
                      className="form-control"
                      value={ngPartA.instrumentId}
                      onChange={e => setNgPartA(prev => ({ ...prev, instrumentId: e.target.value, partIndex: 0 }))}
                      required
                      disabled={!ngPartA.songId}
                    >
                      <option value="">{ngPartA.songId ? '選択' : '曲を先に選択'}</option>
                      {ngPartA.songId && (() => {
                        const songA = state.songs.find(s => s.id === ngPartA.songId);
                        return state.instruments
                          .filter(i => songA?.parts[i.id] && songA.parts[i.id] > 0)
                          .map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ));
                      })()}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">パート</label>
                    <select
                      className="form-control"
                      value={ngPartA.partIndex}
                      onChange={e => setNgPartA(prev => ({ ...prev, partIndex: Number(e.target.value) }))}
                      required
                      disabled={!ngPartA.instrumentId}
                    >
                      {!ngPartA.instrumentId ? (
                        <option value="0">楽器を先に選択</option>
                      ) : (
                        Array.from({
                          length: state.songs.find(s => s.id === ngPartA.songId)?.parts[ngPartA.instrumentId] || 0
                        }).map((_, idx) => (
                          <option key={idx} value={idx}>
                            {formatPartName(ngPartA.instrumentId, idx, ngPartA.songId, state.songs, state.instruments)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* Separator */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', paddingTop: '1.5rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-muted)', userSelect: 'none' }}>⇔</span>
                </div>

                {/* Side B */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">曲</label>
                    <select
                      className="form-control"
                      value={ngPartB.songId}
                      onChange={e => setNgPartB({ songId: e.target.value, instrumentId: '', partIndex: 0 })}
                      required
                    >
                      <option value="">曲を選択</option>
                      {state.songs.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">楽器</label>
                    <select
                      className="form-control"
                      value={ngPartB.instrumentId}
                      onChange={e => setNgPartB(prev => ({ ...prev, instrumentId: e.target.value, partIndex: 0 }))}
                      required
                      disabled={!ngPartB.songId}
                    >
                      <option value="">{ngPartB.songId ? '選択' : '曲を先に選択'}</option>
                      {ngPartB.songId && (() => {
                        const songB = state.songs.find(s => s.id === ngPartB.songId);
                        return state.instruments
                          .filter(i => songB?.parts[i.id] && songB.parts[i.id] > 0)
                          .map(i => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ));
                      })()}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">パート</label>
                    <select
                      className="form-control"
                      value={ngPartB.partIndex}
                      onChange={e => setNgPartB(prev => ({ ...prev, partIndex: Number(e.target.value) }))}
                      required
                      disabled={!ngPartB.instrumentId}
                    >
                      {!ngPartB.instrumentId ? (
                        <option value="0">楽器を先に選択</option>
                      ) : (
                        Array.from({
                          length: state.songs.find(s => s.id === ngPartB.songId)?.parts[ngPartB.instrumentId] || 0
                        }).map((_, idx) => (
                          <option key={idx} value={idx}>
                            {formatPartName(ngPartB.instrumentId, idx, ngPartB.songId, state.songs, state.instruments)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                <Plus size={16} /> 重複NGペアを追加
              </button>
            </form>
          </div>

          {/* 登録済みの重複NG一覧 */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>登録済みの重複NG一覧 ({state.duplicateNGPairs.length}件)</h2>
            {state.duplicateNGPairs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                現在、手動登録された重複NGはありません。（異なる曲で同一楽器・同一パートの場合は自動で重複回避されます）
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>パートA</th>
                      <th>パートB</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.duplicateNGPairs.map(pair => {
                      const songA = state.songs.find(s => s.id === pair.partA.songId);
                      const songB = state.songs.find(s => s.id === pair.partB.songId);

                      return (
                        <tr key={pair.id}>
                          <td style={{ fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 600 }}>{songA?.name || '不明'}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{formatPartName(pair.partA.instrumentId, pair.partA.partIndex, pair.partA.songId, state.songs, state.instruments)}</div>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 600 }}>{songB?.name || '不明'}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{formatPartName(pair.partB.instrumentId, pair.partB.partIndex, pair.partB.songId, state.songs, state.instruments)}</div>
                          </td>
                          <td>
                            <button className="btn btn-secondary btn-icon" onClick={() => handleRemoveNGPair(pair.id)} title="削除">
                              <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 次のステップへ */}
          <div className="next-step-bar" style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-next-step"
              onClick={() => setSubTab('entries')}
            >
              次へ: 1-4 セクション練習へ (スキップ可) <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* SUB TAB: ENTRIES */}
      {subTab === 'entries' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* 新規追加 */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>セクション練習の追加</h2>
            <form onSubmit={handleAddEntry} className="form-grid-entry">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">対象曲</label>
                  <select
                    className="form-control"
                    value={entrySongId}
                    onChange={e => {
                      setEntrySongId(e.target.value);
                      setEntryParts([]);
                    }}
                    required
                  >
                    <option value="">曲を選択</option>
                    {state.songs.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">小節・セクション</label>
                  <input name="section" placeholder="例: 1-16小節、練習記号A" className="form-control" required />
                </div>
                <div className="form-group">
                  <label className="form-label">優先度</label>
                  <select name="priority" className="form-control" defaultValue="medium">
                    <option value="high">高 (優先してスケジューリング)</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: 'auto' }}>
                  <Plus size={16} /> セクション練習を追加
                </button>
              </div>

              {/* 参加パート選択 */}
              <div className="grid-span-2">
                <label className="form-label" style={{ marginBottom: '1rem' }}>参加パート (複数選択)</label>
                {entrySongId ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    {getSongParts(entrySongId).map(p => {
                      const isChecked = entryParts.some(
                        ep => ep.instrumentId === p.instrumentId && ep.partIndex === p.partIndex
                      );
                      return (
                        <div
                          key={`${p.instrumentId}_${p.partIndex}`}
                          onClick={() => toggleEntryPart(p.instrumentId, p.partIndex)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            background: isChecked ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border-color)'}`,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isChecked ? <CheckSquare size={16} style={{ color: 'var(--primary)' }} /> : <Square size={16} />}
                          <span style={{ fontSize: '0.85rem' }}>{p.label}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ height: '150px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    対象曲を選択すると、参加可能なパート一覧が表示されます。
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* 一覧 */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>登録済みのセクション練習一覧 ({state.entries.length}件)</h2>
            {state.entries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                まだセクション練習が登録されていません。上のフォームから登録してください。
              </div>
            ) : (
              <>
                {/* PC用: テーブル表示 */}
                <div className="entries-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>曲名</th>
                        <th>小節・セクション</th>
                        <th>参加パート ({state.instruments.length}種)</th>
                        <th>優先度</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.entries.map((entry, idx) => {
                        const song = state.songs.find(s => s.id === entry.songId);
                        const isEditing = editingEntryId === entry.id;
                        return (
                          <tr key={entry.id}>
                            <td style={{ fontWeight: 600 }}>{song?.name || '不明'}</td>
                            <td>
                              {isEditing ? (
                                <input
                                  type="text"
                                  className="form-control"
                                  value={editSection}
                                  onChange={e => setEditSection(e.target.value)}
                                  style={{ minWidth: '120px' }}
                                />
                              ) : (
                                entry.section
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '400px' }}>
                                  {getSongParts(entry.songId).map(p => {
                                    const isChecked = editParts.some(
                                      ep => ep.instrumentId === p.instrumentId && ep.partIndex === p.partIndex
                                    );
                                    return (
                                      <span
                                        key={`${p.instrumentId}_${p.partIndex}`}
                                        onClick={() => {
                                          if (isChecked) {
                                            setEditParts(prev => prev.filter(ep => !(ep.instrumentId === p.instrumentId && ep.partIndex === p.partIndex)));
                                          } else {
                                            setEditParts(prev => [...prev, { instrumentId: p.instrumentId, partIndex: p.partIndex }]);
                                          }
                                        }}
                                        className={`badge ${isChecked ? 'badge-primary' : 'badge-secondary'}`}
                                        style={{ cursor: 'pointer', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', opacity: isChecked ? 1 : 0.4 }}
                                      >
                                        {p.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '400px' }}>
                                  {entry.parts.map(p => {
                                    return (
                                      <span key={`${p.instrumentId}_${p.partIndex}`} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                        {formatPartName(p.instrumentId, p.partIndex, entry.songId, state.songs, state.instruments)}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <select
                                  className="form-control"
                                  value={editPriority}
                                  onChange={e => setEditPriority(e.target.value as any)}
                                  style={{ width: '80px', padding: '0.2rem' }}
                                >
                                  <option value="high">高</option>
                                  <option value="medium">中</option>
                                  <option value="low">低</option>
                                </select>
                              ) : (
                                <>
                                  {entry.priority === 'high' && <span className="badge badge-danger">高</span>}
                                  {entry.priority === 'medium' && <span className="badge badge-warning">中</span>}
                                  {entry.priority === 'low' && <span className="badge badge-success">低</span>}
                                </>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <button className="btn btn-primary" onClick={() => handleSaveEditEntry(entry.id)} style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                                    保存
                                  </button>
                                  <button className="btn btn-secondary" onClick={handleCancelEditEntry} style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-icon"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveEntry(idx, 'up')}
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-icon"
                                    disabled={idx === state.entries.length - 1}
                                    onClick={() => handleMoveEntry(idx, 'down')}
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => handleStartEditEntry(entry)}
                                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                                  >
                                    編集
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-icon"
                                    onClick={() => handleRemoveEntry(entry.id)}
                                  >
                                    <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* スマホ用: 1カラム・カード型スタック表示（二重スクロール撤廃＆インライン編集対応） */}
                <div className="entries-cards-container">
                  {state.entries.map((entry, idx) => {
                    const song = state.songs.find(s => s.id === entry.songId);
                    const isEditing = editingEntryId === entry.id;

                    if (isEditing) {
                      return (
                        <div key={entry.id} className="entry-card entry-card-editing">
                          <div className="entry-card-header">
                            <span className="entry-card-song">{song?.name || '不明'}</span>
                            <span className="badge badge-primary">編集中</span>
                          </div>

                          <div className="entry-card-edit-body">
                            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                              <label className="form-label" style={{ fontSize: '0.8rem' }}>小節・セクション</label>
                              <input
                                type="text"
                                className="form-control"
                                value={editSection}
                                onChange={e => setEditSection(e.target.value)}
                                placeholder="例: 1-16小節、練習記号A"
                                required
                              />
                            </div>

                            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                              <label className="form-label" style={{ fontSize: '0.8rem' }}>優先度</label>
                              <select
                                className="form-control"
                                value={editPriority}
                                onChange={e => setEditPriority(e.target.value as any)}
                              >
                                <option value="high">高 (優先してスケジューリング)</option>
                                <option value="medium">中</option>
                                <option value="low">低</option>
                              </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                              <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>参加パート (タップで選択/解除)</label>
                              <div className="entry-card-part-badges">
                                {getSongParts(entry.songId).map(p => {
                                  const isChecked = editParts.some(
                                    ep => ep.instrumentId === p.instrumentId && ep.partIndex === p.partIndex
                                  );
                                  return (
                                    <button
                                      key={`${p.instrumentId}_${p.partIndex}`}
                                      type="button"
                                      onClick={() => {
                                        if (isChecked) {
                                          setEditParts(prev => prev.filter(ep => !(ep.instrumentId === p.instrumentId && ep.partIndex === p.partIndex)));
                                        } else {
                                          setEditParts(prev => [...prev, { instrumentId: p.instrumentId, partIndex: p.partIndex }]);
                                        }
                                      }}
                                      className={`badge ${isChecked ? 'badge-primary' : 'badge-secondary'}`}
                                      style={{
                                        cursor: 'pointer',
                                        padding: '0.35rem 0.6rem',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                        opacity: isChecked ? 1 : 0.5,
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      {p.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="entry-card-actions">
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleCancelEditEntry}
                                style={{ flex: 1, padding: '0.55rem' }}
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => handleSaveEditEntry(entry.id)}
                                style={{ flex: 1, padding: '0.55rem' }}
                              >
                                保存する
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={entry.id} className="entry-card">
                        <div className="entry-card-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {entry.priority === 'high' && <span className="badge badge-danger">高</span>}
                            {entry.priority === 'medium' && <span className="badge badge-warning">中</span>}
                            {entry.priority === 'low' && <span className="badge badge-success">低</span>}
                            <span className="entry-card-song">{song?.name || '不明'}</span>
                          </div>

                          <div className="entry-card-order-btns">
                            <button
                              type="button"
                              className="btn btn-secondary btn-icon"
                              disabled={idx === 0}
                              onClick={() => handleMoveEntry(idx, 'up')}
                              title="上へ移動"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-icon"
                              disabled={idx === state.entries.length - 1}
                              onClick={() => handleMoveEntry(idx, 'down')}
                              title="下へ移動"
                            >
                              <ArrowDown size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="entry-card-section-title">
                          {entry.section}
                        </div>

                        <div className="entry-card-parts-section">
                          <div className="entry-card-parts-label">
                            参加パート ({entry.parts.length}パート)
                          </div>
                          <div className="entry-card-part-tags">
                            {entry.parts.map(p => (
                              <span
                                key={`${p.instrumentId}_${p.partIndex}`}
                                className="entry-part-tag"
                              >
                                {formatPartName(p.instrumentId, p.partIndex, entry.songId, state.songs, state.instruments)}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="entry-card-footer">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleStartEditEntry(entry)}
                            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <Edit3 size={14} /> 編集
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon"
                            onClick={() => handleRemoveEntry(entry.id)}
                            title="削除"
                            style={{ padding: '0.45rem' }}
                          >
                            <Trash2 size={15} style={{ color: 'var(--danger)' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 全設定完了！STEP 2へ */}
          <div className="next-step-bar" style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-next-step"
              onClick={validateAndProceedToSchedule}
            >
              全設定完了！STEP 2: スケジュール生成へ進む <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
