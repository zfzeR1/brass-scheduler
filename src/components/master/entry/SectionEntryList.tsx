import type { Entry, Song, Instrument } from '../../../types';
import { formatPartName } from '../../../utils/scheduler';
import { ArrowUp, ArrowDown, Edit3, Trash2 } from 'lucide-react';

export interface SectionEntryListProps {
  entries: Entry[];
  songs: Song[];
  instruments: Instrument[];
  onRemoveEntry: (id: string) => void;
  onMoveEntry: (index: number, direction: 'up' | 'down') => void;
  onEditEntry: (entry: Entry) => void;
}

export default function SectionEntryList({
  entries,
  songs,
  instruments,
  onRemoveEntry,
  onMoveEntry,
  onEditEntry
}: SectionEntryListProps) {
  return (
    <div className="glass-card">
      <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>
        {`登録済みのセクション練習一覧 (${entries.length}件)`}
      </h2>

      {entries.length === 0 ? (
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
                  <th>{`参加パート (${instruments.length}種)`}</th>
                  <th>優先度</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const song = songs.find(s => s.id === entry.songId);
                  return (
                    <tr key={entry.id}>
                      <td style={{ fontWeight: 600 }}>{song?.name || '不明'}</td>
                      <td>{entry.section}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '400px' }}>
                          {entry.parts.map(p => (
                            <span
                              key={`${p.instrumentId}_${p.partIndex}`}
                              style={{
                                fontSize: '0.75rem',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--border-color)',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px'
                              }}
                            >
                              {formatPartName(p.instrumentId, p.partIndex, entry.songId, songs, instruments)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {entry.priority === 'high' && <span className="badge badge-danger">高</span>}
                        {entry.priority === 'medium' && <span className="badge badge-warning">中</span>}
                        {entry.priority === 'low' && <span className="badge badge-success">低</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon"
                            disabled={idx === 0}
                            onClick={() => onMoveEntry(idx, 'up')}
                            title="上へ移動"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon"
                            disabled={idx === entries.length - 1}
                            onClick={() => onMoveEntry(idx, 'down')}
                            title="下へ移動"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => onEditEntry(entry)}
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Edit3 size={12} /> 編集
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon"
                            onClick={() => onRemoveEntry(entry.id)}
                            title="削除"
                          >
                            <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* スマホ用: 1カラム・カード型スタック表示 */}
          <div className="entries-cards-container">
            {entries.map((entry, idx) => {
              const song = songs.find(s => s.id === entry.songId);
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
                        onClick={() => onMoveEntry(idx, 'up')}
                        title="上へ移動"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon"
                        disabled={idx === entries.length - 1}
                        onClick={() => onMoveEntry(idx, 'down')}
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
                      {`参加パート (${entry.parts.length}パート)`}
                    </div>
                    <div className="entry-card-part-tags">
                      {entry.parts.map(p => (
                        <span
                          key={`${p.instrumentId}_${p.partIndex}`}
                          className="entry-part-tag"
                        >
                          {formatPartName(p.instrumentId, p.partIndex, entry.songId, songs, instruments)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="entry-card-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onEditEntry(entry)}
                      style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Edit3 size={14} /> 編集
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon"
                      onClick={() => onRemoveEntry(entry.id)}
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
  );
}
