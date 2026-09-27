import type { Song, Instrument } from '../../../types';
import { Edit3, Trash2, ChevronRight } from 'lucide-react';

export interface SongListViewProps {
  songs: Song[];
  instruments: Instrument[];
  onStartEditSong: (song: Song) => void;
  onDeleteSong: (songId: string) => void;
  onProceedToNext: () => void;
}

export default function SongListView({
  songs,
  instruments,
  onStartEditSong,
  onDeleteSong,
  onProceedToNext
}: SongListViewProps) {
  // 楽器IDから楽器名へのマップ
  const instrumentNameMap = new Map<string, string>();
  instruments.forEach(i => instrumentNameMap.set(i.id, i.name));

  return (
    <div className="glass-card">
      <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>登録済み曲リスト</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {songs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>登録されている曲はありません。</p>
        ) : (
          songs.map(song => (
            <div
              key={song.id}
              style={{
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '1rem'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}
              >
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  {song.name}
                </strong>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon"
                    onClick={() => onStartEditSong(song)}
                    title="編集"
                    aria-label={`${song.name}を編集`}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon"
                    onClick={() => onDeleteSong(song.id)}
                    title="削除"
                    aria-label={`${song.name}を削除`}
                  >
                    <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                  </button>
                </div>
              </div>

              {/* パート構成バッジ */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {instruments.map(inst => {
                  const count = song.parts[inst.id] || 0;
                  if (count <= 0) return null;
                  return (
                    <span key={inst.id} className="badge badge-primary">
                      {inst.name}: {count}
                    </span>
                  );
                })}
                {/* マスタ未登録の追加楽器 */}
                {Object.keys(song.parts)
                  .filter(instId => !instruments.some(i => i.id === instId) && song.parts[instId] > 0)
                  .map(instId => (
                    <span key={instId} className="badge badge-secondary">
                      {instId}: {song.parts[instId]}
                    </span>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 次のステップへ */}
      <div className="next-step-bar" style={{ marginTop: '1.5rem' }}>
        <button
          type="button"
          className="btn btn-primary btn-next-step"
          onClick={onProceedToNext}
        >
          次へ: 1-3 重複NG設定へ <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
