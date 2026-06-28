import type { DPKCard } from '../types';
import { COLUMNS, COLUMN_MAP, REMAINING_COLOR } from '../constants';

interface Props {
  cards: DPKCard[];
  totalEstimated: number;
}

const SHORT_LABELS: Record<string, string> = {
  fab_target:      'FAB Target',
  pre_fab_prep:    'Pre-FAB Prep',
  pre_fab_review:  'Pre-FAB Review',
  post_fab_prep:   'Post-FAB Prep',
  post_fab_review: 'Post-FAB Review',
  completions:     'Completions',
};

export function ProgressBar({ cards, totalEstimated }: Props) {
  const total = Math.max(totalEstimated, 1);

  const counts = Object.fromEntries(COLUMNS.map(c => [c.id, 0])) as Record<string, number>;
  for (const card of cards) {
    counts[card.columnId] = (counts[card.columnId] ?? 0) + 1;
  }

  const placed = cards.length;
  const remainingCount = Math.max(total - placed, 0);
  const completions = counts['completions'] ?? 0;
  const inProgress = placed - completions;
  const completionPct = Math.round((completions / total) * 100);
  const groomedPct = Math.round((placed / total) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Main bar */}
      <div style={{
        display: 'flex',
        height: 30,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.05)',
      }}>
        {COLUMNS.map(col => {
          const count = counts[col.id];
          if (!count) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={col.id}
              title={`${col.label}: ${count} DPKs (${pct.toFixed(1)}%)`}
              style={{
                flex: `0 0 ${pct}%`,
                background: COLUMN_MAP[col.id].color,
                transition: 'flex 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                minWidth: 6,
                borderRight: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {pct >= 3.5 && (
                <span style={{
                  color: '#fff',
                  fontSize: 'clamp(11px, 1vw, 14px)',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  padding: '0 6px',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}>
                  {count}
                </span>
              )}
            </div>
          );
        })}

        {remainingCount > 0 && (
          <div
            title={`Not yet groomed: ${remainingCount} DPKs`}
            style={{
              flex: 1,
              background: REMAINING_COLOR,
              transition: 'flex 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
              overflow: 'hidden',
            }}
          >
            {(remainingCount / total) * 100 > 8 && (
              <span style={{
                color: '#6b5ea8',
                fontSize: 'clamp(11px, 0.95vw, 14px)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                {remainingCount} not yet groomed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend + summary row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(10px, 1.4vw, 22px)',
        flexWrap: 'nowrap',
        overflow: 'hidden',
      }}>
        {COLUMNS.map(col => {
          const count = counts[col.id];
          if (!count) return null;
          return (
            <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <span style={{
                display: 'inline-block',
                width: 9,
                height: 9,
                borderRadius: 2,
                background: COLUMN_MAP[col.id].color,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 'clamp(11px, 0.85vw, 13px)', color: '#555', whiteSpace: 'nowrap' }}>
                {SHORT_LABELS[col.id]}:&nbsp;<strong style={{ color: '#222' }}>{count}</strong>
              </span>
            </div>
          );
        })}

        {remainingCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{
              display: 'inline-block',
              width: 9,
              height: 9,
              borderRadius: 2,
              background: REMAINING_COLOR,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 'clamp(11px, 0.85vw, 13px)', color: '#888', whiteSpace: 'nowrap' }}>
              Not groomed:&nbsp;<strong style={{ color: '#555' }}>{remainingCount}</strong>
            </span>
          </div>
        )}

        {/* Summary stats */}
        <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 'clamp(11px, 0.9vw, 13px)', color: '#888', whiteSpace: 'nowrap' }}>
            <strong style={{ color: '#1A7A4A' }}>{completionPct}%</strong> complete
            &nbsp;·&nbsp;
            <strong style={{ color: '#444' }}>{inProgress}</strong> in progress
            &nbsp;·&nbsp;
            <strong style={{ color: '#444' }}>{groomedPct}%</strong> groomed
          </span>
        </div>
      </div>

    </div>
  );
}
