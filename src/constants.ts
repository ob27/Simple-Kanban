import type { ColumnConfig } from './types';

export const DEFAULT_COLUMN_COLORS = [
  '#7B2D8B',
  '#1E5BA8',
  '#7B3A10',
  '#C41E8C',
  '#1B3566',
  '#1A7A4A',
];

export const DEFAULT_COLUMN_LABELS = [
  'FAB Target Date Confirmed',
  'Pre-FAB Asset Register Preparation',
  'Pre-FAB Asset Register Review',
  'Post-FAB Asset Register Preparation',
  'Post-FAB Asset Register Review',
  'Completions Data Release',
];

export function buildDefaultColumns(): ColumnConfig[] {
  return DEFAULT_COLUMN_COLORS.map((color, i) => ({
    id: crypto.randomUUID(),
    label: DEFAULT_COLUMN_LABELS[i],
    color,
  }));
}

export const REMAINING_COLOR = '#B8B4D8';
export const DEFAULT_TOTAL_ESTIMATED = 300;
export const DEFAULT_PROJECT_START_YEAR = 2022;
export const DEFAULT_PROJECT_START_MONTH = 0;
export const DEFAULT_PROJECT_END_YEAR = 2028;
export const DEFAULT_PROJECT_END_MONTH = 11;
