import { Tooltip } from 'antd';
import type { KanbanCard, ColumnConfig } from '../types';
import { REMAINING_COLOR } from '../constants';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface Props {
  cards: KanbanCard[];
  columns: ColumnConfig[];
  totalEstimated: number;
  doneColumnId?: string;
  groomedColumnId?: string;
}

export function ProgressBar({ cards, columns, totalEstimated, doneColumnId, groomedColumnId }: Props) {
  const { isMobile } = useBreakpoint();
  const total = Math.max(totalEstimated, 1);
  const counts = Object.fromEntries(columns.map(c => [c.id, 0]));
  for (const card of cards) {
    counts[card.columnId] = (counts[card.columnId] ?? 0) + 1;
  }

  const placed = cards.length;
  const remainingCount = Math.max(total - placed, 0);

  // Use the designated done column, falling back to the last column
  const doneColId = doneColumnId ?? columns[columns.length - 1]?.id;
  const completions = counts[doneColId ?? ''] ?? 0;

  // Groomed = cards in the groomed column or any column to its right
  const groomedIdx = groomedColumnId ? columns.findIndex(c => c.id === groomedColumnId) : -1;
  const groomedCount = groomedIdx >= 0
    ? cards.filter(c => columns.findIndex(col => col.id === c.columnId) >= groomedIdx).length
    : placed;

  const inProgress = placed - completions;
  const completionPct = Math.round((completions / total) * 100);
  const groomedPct = Math.round((groomedCount / total) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', height: 30, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.05)' }}>
        {columns.map(col => {
          const count = counts[col.id];
          if (!count) return null;
          const pct = (count / total) * 100;
          return (
            <Tooltip key={col.id} title={`${col.label}: ${count} card${count !== 1 ? 's' : ''} (${pct.toFixed(1)}%)`}>
            <div
              style={{
                flex: `0 0 ${pct}%`, background: col.color,
                transition: 'flex 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', minWidth: 6, borderRight: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {pct >= 3.5 && (
                <span style={{ color: '#fff', fontSize: 'clamp(11px, 1vw, 14px)', fontWeight: 700, whiteSpace: 'nowrap', padding: '0 6px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {count}
                </span>
              )}
            </div>
            </Tooltip>
          );
        })}
        {remainingCount > 0 && (
          <Tooltip title={`Not yet planned: ${remainingCount} card${remainingCount !== 1 ? 's' : ''}`}>
          <div
            style={{ flex: 1, background: REMAINING_COLOR, transition: 'flex 0.45s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', alignItems: 'center', paddingLeft: 12, overflow: 'hidden' }}
          >
            {(remainingCount / total) * 100 > 8 && (
              <span style={{ color: '#6b5ea8', fontSize: 'clamp(11px, 0.95vw, 14px)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {remainingCount} not yet planned
              </span>
            )}
          </div>
          </Tooltip>
        )}
      </div>

      {!isMobile && <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px, 1.4vw, 22px)', flexWrap: 'nowrap', overflow: 'hidden' }}>
        {columns.map(col => {
          const count = counts[col.id];
          if (!count) return null;
          const shortLabel = col.label.length > 16 ? col.label.slice(0, 15) + '…' : col.label;
          const needsTooltip = col.label.length > 16;
          return (
            <Tooltip key={col.id} title={needsTooltip ? col.label : ''}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, cursor: 'default' }}>
              <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: col.color, flexShrink: 0 }} />
              <span style={{ fontSize: 'clamp(11px, 0.85vw, 13px)', color: '#555', whiteSpace: 'nowrap' }}>
                {shortLabel}:&nbsp;<strong style={{ color: '#222' }}>{count}</strong>
              </span>
            </div>
            </Tooltip>
          );
        })}
        {remainingCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: REMAINING_COLOR, flexShrink: 0 }} />
            <span style={{ fontSize: 'clamp(11px, 0.85vw, 13px)', color: '#888', whiteSpace: 'nowrap' }}>
              Not planned:&nbsp;<strong style={{ color: '#555' }}>{remainingCount}</strong>
            </span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 'clamp(11px, 0.9vw, 13px)', color: '#888', whiteSpace: 'nowrap' }}>
            <strong style={{ color: '#1A7A4A' }}>{completionPct}%</strong> complete
            &nbsp;·&nbsp;<strong style={{ color: '#444' }}>{inProgress}</strong> in progress
            &nbsp;·&nbsp;<strong style={{ color: '#444' }}>{groomedPct}%</strong> groomed
          </span>
        </div>
      </div>}
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: '#888' }}>
          <span>
            <strong style={{ color: '#1A7A4A' }}>{completionPct}%</strong> done
            &nbsp;·&nbsp;<strong style={{ color: '#444' }}>{inProgress}</strong> in progress
            &nbsp;·&nbsp;<strong style={{ color: '#444' }}>{groomedPct}%</strong> groomed
          </span>
        </div>
      )}
    </div>
  );
}
