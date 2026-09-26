import { AlertTriangle, CheckCircle } from 'lucide-react';

interface ViolationSummaryPanelProps {
  violations: string[];
}

export default function ViolationSummaryPanel({ violations }: ViolationSummaryPanelProps) {
  const hasViolations = violations.length > 0;

  return (
    <div
      className="glass-card"
      style={{
        marginBottom: '2rem',
        borderLeft: `4px solid ${hasViolations ? 'var(--warning)' : 'var(--success)'}`
      }}
    >
      <h2
        style={{
          fontSize: '1.05rem',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        {hasViolations ? (
          <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
        ) : (
          <CheckCircle size={18} style={{ color: 'var(--success)' }} />
        )}
        制約・最適化チェック結果
      </h2>

      {hasViolations ? (
        <ul
          style={{
            paddingLeft: '1.25rem',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}
        >
          {violations.slice(0, 5).map((v, idx) => (
            <li
              key={idx}
              style={{
                color:
                  v.includes('超過') || v.includes('NG') || v.includes('移動不可')
                    ? '#f87171'
                    : 'var(--text-secondary)'
              }}
            >
              {v}
            </li>
          ))}
          {violations.length > 5 && (
            <li style={{ color: 'var(--text-muted)', listStyleType: 'none', marginTop: '0.25rem' }}>
              ほか {violations.length - 5} 件の警告があります...
            </li>
          )}
        </ul>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          すべてのハード制約（重複NG・キャパシティ・移動不可楽器アサイン）を満たしています！
        </p>
      )}
    </div>
  );
}
