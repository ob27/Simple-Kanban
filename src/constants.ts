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
  'Backlog',
  'Groomed',
  'In Progress',
  'Blocked',
  "Won't Do",
  'Done',
];

export function buildDefaultColumns(): ColumnConfig[] {
  return DEFAULT_COLUMN_COLORS.map((color, i) => ({
    id: crypto.randomUUID(),
    label: DEFAULT_COLUMN_LABELS[i],
    color,
  }));
}

export const REMAINING_COLOR = '#B8B4D8';
export const MAX_ATTACHMENTS_BYTES = 250 * 1024 * 1024;
export const MAX_USER_ATTACHMENTS_BYTES = 500 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
export const MAX_ASSIGNMENT_DEFINITIONS = 5;
export const DEFAULT_TOTAL_ESTIMATED = 300;
export const DEFAULT_PROJECT_START_YEAR = 2022;
export const DEFAULT_PROJECT_START_MONTH = 0;
export const DEFAULT_PROJECT_END_YEAR = 2028;
export const DEFAULT_PROJECT_END_MONTH = 11;
