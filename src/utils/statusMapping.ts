import type { ColumnId } from '../types';

const STATUS_MAP: Array<{ patterns: string[]; columnId: ColumnId }> = [
  {
    patterns: ['fab target', 'target date confirmed', 'fab target date'],
    columnId: 'fab_target',
  },
  {
    patterns: ['pre-fab asset register prep', 'pre fab asset register prep', 'pre-fab preparation', 'pre fab prep'],
    columnId: 'pre_fab_prep',
  },
  {
    patterns: ['pre-fab asset register review', 'pre fab asset register review', 'pre-fab review', 'pre fab review'],
    columnId: 'pre_fab_review',
  },
  {
    patterns: ['post-fab asset register prep', 'post fab asset register prep', 'post-fab preparation', 'post fab prep'],
    columnId: 'post_fab_prep',
  },
  {
    patterns: ['post-fab asset register review', 'post fab asset register review', 'post-fab review', 'post fab review'],
    columnId: 'post_fab_review',
  },
  {
    patterns: ['completions data release', 'data release', 'completions', 'completion'],
    columnId: 'completions',
  },
];

export function mapStatusToColumnId(raw: string): ColumnId | null {
  const normalized = raw.trim().toLowerCase();
  for (const entry of STATUS_MAP) {
    if (entry.patterns.some(p => normalized.includes(p))) {
      return entry.columnId;
    }
  }
  return null;
}
