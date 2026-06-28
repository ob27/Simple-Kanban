import type { KanbanState } from './types';
import {
  STORAGE_KEY,
  DEFAULT_TOTAL_ESTIMATED,
  DEFAULT_PROJECT_START_YEAR,
  DEFAULT_PROJECT_START_MONTH,
  DEFAULT_PROJECT_END_YEAR,
  DEFAULT_PROJECT_END_MONTH,
} from './constants';

const DEFAULTS: KanbanState = {
  cards: [],
  totalEstimated: DEFAULT_TOTAL_ESTIMATED,
  projectStartYear: DEFAULT_PROJECT_START_YEAR,
  projectStartMonth: DEFAULT_PROJECT_START_MONTH,
  projectEndYear: DEFAULT_PROJECT_END_YEAR,
  projectEndMonth: DEFAULT_PROJECT_END_MONTH,
};

export function loadState(): KanbanState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as KanbanState;
    if (!Array.isArray(parsed.cards)) throw new Error('invalid');
    return {
      ...DEFAULTS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveState(state: KanbanState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
