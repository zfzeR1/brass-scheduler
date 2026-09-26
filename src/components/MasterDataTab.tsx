import React, { useState } from 'react';
import type { ScheduleState } from '../types';
import { validateMasterDataRequirements } from '../utils/validation';
import TimeAndRoomSection from './master/TimeAndRoomSection';
import SongFormSection from './master/SongFormSection';
import DuplicateNGSection from './master/DuplicateNGSection';
import SectionEntrySection from './master/SectionEntrySection';
import { CheckSquare } from 'lucide-react';
import { useOptionalSchedule } from '../context/ScheduleContext';

export interface MasterDataTabProps {
  state?: ScheduleState;
  setState?: React.Dispatch<React.SetStateAction<ScheduleState>>;
  onProceedToSchedule?: () => void;
}

export default function MasterDataTab(props: MasterDataTabProps) {
  const scheduleCtx = useOptionalSchedule();
  const state = props.state ?? scheduleCtx?.state;
  const setState = props.setState ?? scheduleCtx?.setState;
  const { onProceedToSchedule } = props;

  if (!state || !setState) {
    throw new Error('MasterDataTab must be used within a ScheduleProvider or provided with state and setState props');
  }

  const [subTab, setSubTab] = useState<'settings' | 'songs' | 'ng-pairs' | 'entries'>('settings');

  // 未入力事前チェック（ガード機能）
  const validateAndProceedToSchedule = () => {
    const validation = validateMasterDataRequirements(state);
    if (!validation.isValid) {
      if (validation.message) alert(validation.message);
      if (validation.targetSubTab) setSubTab(validation.targetSubTab);
      return;
    }
    if (onProceedToSchedule) {
      onProceedToSchedule();
    }
  };

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

      {/* 1-1: 時間・部屋設定 */}
      {subTab === 'settings' && (
        <TimeAndRoomSection state={state} setState={setState} />
      )}

      {/* 1-2: 演奏曲・パート編成 */}
      {subTab === 'songs' && (
        <SongFormSection
          state={state}
          setState={setState}
          onProceedToNext={() => setSubTab('ng-pairs')}
        />
      )}

      {/* 1-3: 重複NG設定 */}
      {subTab === 'ng-pairs' && (
        <DuplicateNGSection
          state={state}
          setState={setState}
          onProceedToNext={() => setSubTab('entries')}
        />
      )}

      {/* 1-4: セクション練習 */}
      {subTab === 'entries' && (
        <SectionEntrySection
          state={state}
          setState={setState}
          onProceedToSchedule={validateAndProceedToSchedule}
        />
      )}
    </div>
  );
}
