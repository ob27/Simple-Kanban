export type ColumnId =
  | 'fab_target'
  | 'pre_fab_prep'
  | 'pre_fab_review'
  | 'post_fab_prep'
  | 'post_fab_review'
  | 'completions';

export interface DPKCard {
  id: string;
  dpkNumber: string;
  columnId: ColumnId;
}

export interface KanbanState {
  cards: DPKCard[];
  totalEstimated: number;
  projectStartYear: number;
  projectStartMonth: number;
  projectEndYear: number;
  projectEndMonth: number;
}

export interface ColumnConfig {
  id: ColumnId;
  label: string;
  color: string;
}
