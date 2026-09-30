
import type { Assignment, Entry, Song, Instrument } from '../../types';
import { formatPartName } from '../../utils/scheduler';

interface AssignmentCellContentProps {
  assignment: Assignment | undefined;
  entry: Entry | null;
  song: Song | null;
  songs: Song[];
  instruments: Instrument[];
  compact?: boolean;
}

export default function AssignmentCellContent({
  assignment,
  entry,
  song,
  songs,
  instruments,
  compact = false
}: AssignmentCellContentProps) {
  if (assignment?.entryId && entry) {
    return (
      <>
        <div style={compact ? { display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' } : undefined}>
          <span className="badge badge-primary" style={{ fontSize: compact ? '0.7rem' : '0.65rem' }}>
            {song?.name || '曲名なし'}
          </span>
        </div>
        {compact ? (
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            {entry.section}
          </div>
        ) : (
          <strong style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
            {entry.section}
          </strong>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? '0.25rem' : '2px', marginTop: '0.25rem', maxHeight: compact ? undefined : '35px', overflowY: compact ? undefined : 'auto' }}>
          {entry.parts.map(p => (
            <span
              key={`${p.instrumentId}_${p.partIndex}`}
              style={{
                fontSize: compact ? '0.7rem' : '0.65rem',
                background: 'rgba(255,255,255,0.05)',
                padding: compact ? '2px 5px' : '1px 3px',
                borderRadius: compact ? '3px' : '2px',
                border: compact ? '1px solid var(--border-color)' : undefined
              }}
            >
              {formatPartName(p.instrumentId, p.partIndex, entry.songId, songs, instruments)}
            </span>
          ))}
        </div>
      </>
    );
  }

  if (assignment?.isPersonalPractice) {
    return (
      <>
        <div style={compact ? undefined : { display: 'inline-block' }}>
          <span className="badge badge-info" style={{ fontSize: compact ? '0.7rem' : '0.65rem', marginBottom: compact ? '0.35rem' : undefined }}>
            個人練習部屋
          </span>
        </div>
        <div style={{ fontSize: compact ? '0.78rem' : '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          退避中: {assignment.parts.length} パート
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? '0.25rem' : '2px', marginTop: '0.25rem', maxHeight: compact ? undefined : '35px', overflowY: compact ? undefined : 'auto' }}>
          {assignment.parts.map((p, idx) => {
            const pSong = p.songId ? songs.find(sg => sg.id === p.songId) : undefined;
            return (
              <span
                key={idx}
                style={{
                  fontSize: compact ? '0.68rem' : '0.65rem',
                  background: 'rgba(6,182,212,0.1)',
                  padding: compact ? '2px 4px' : '1px 3px',
                  borderRadius: compact ? '3px' : '2px',
                  color: '#22d3ee'
                }}
                title={compact ? undefined : `${pSong?.name || ''} - ${formatPartName(p.instrumentId, p.partIndex, p.songId, songs, instruments)}`}
              >
                {pSong ? `${pSong.name.substring(0, compact ? 3 : 2)}:${formatPartName(p.instrumentId, p.partIndex, p.songId, songs, instruments)}` : formatPartName(p.instrumentId, p.partIndex, undefined, songs, instruments)}
              </span>
            );
          })}
        </div>
      </>
    );
  }

  if (compact) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
        空き部屋
      </div>
    );
  }

  return <>空き部屋</>;
}
