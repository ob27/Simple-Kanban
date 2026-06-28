import type { ColumnConfig, ColumnId } from './types';

export const COLUMNS: ColumnConfig[] = [
  { id: 'fab_target',      label: 'FAB Target Date Confirmed',           color: '#7B2D8B' },
  { id: 'pre_fab_prep',    label: 'Pre-FAB Asset Register Preparation',  color: '#1E5BA8' },
  { id: 'pre_fab_review',  label: 'Pre-FAB Asset Register Review',       color: '#7B3A10' },
  { id: 'post_fab_prep',   label: 'Post-FAB Asset Register Preparation', color: '#C41E8C' },
  { id: 'post_fab_review', label: 'Post-FAB Asset Register Review',      color: '#1B3566' },
  { id: 'completions',     label: 'Completions Data Release',            color: '#1A7A4A' },
];

export const COLUMN_MAP: Record<ColumnId, ColumnConfig> = Object.fromEntries(
  COLUMNS.map(c => [c.id, c])
) as Record<ColumnId, ColumnConfig>;

export const REMAINING_COLOR = '#B8B4D8';
export const STORAGE_KEY = 'aim_kanban_state';
export const DEFAULT_TOTAL_ESTIMATED = 300;
export const DEFAULT_PROJECT_START_YEAR = 2022;
export const DEFAULT_PROJECT_START_MONTH = 0;   // January
export const DEFAULT_PROJECT_END_YEAR = 2028;
export const DEFAULT_PROJECT_END_MONTH = 11;    // December
