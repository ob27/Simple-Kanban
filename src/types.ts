export interface ColumnConfig {
  id: string;
  label: string;
  color: string;
  description?: string;
  maxCards?: number;
}

export interface CardComment {
  id: string;
  uid: string;
  email: string;
  text: string;
  createdAt: number;
  imageUrl?: string;
  imagePath?: string;
  imageSize?: number;
  // emoji -> array of uids who reacted with it
  reactions?: Record<string, string[]>;
}

export interface CardAttachment {
  id: string;
  name: string;
  url: string;
  path: string;
  size: number;
  type: string;
}

// A board-level responsibility label a card can be assigned to (e.g. "Asset
// Manager") — a stable `id` separate from the editable `label` so renaming
// a label later doesn't orphan cards that already reference it. Explicitly
// NOT named "Role"/"ROLE_*" — that vocabulary is already used throughout
// this app for access control (creator/co-owner/member/viewer, see
// AccessModal.tsx's ROLE_LABELS/ROLE_COLORS), a different concept entirely.
export interface AssignmentDefinition {
  id: string;
  label: string;
}

// Discriminated union so a card's assignment is unambiguously either a real
// member or free text, never both at once.
export type CardAssignmentValue =
  | { kind: 'member'; uid: string }
  | { kind: 'freeText'; text: string };

export interface KanbanCard {
  id: string;
  title: string;
  columnId: string;
  pillValue: string;
  order: number;
  notes?: string;
  comments?: CardComment[];
  storyPoints?: number;
  movedAt?: number;
  attachments?: CardAttachment[];
  cardAssignments?: Record<string, CardAssignmentValue>;
}

export type FolderRole = 'owner' | 'editor' | 'viewer';

export interface Folder {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail?: string;
  memberIds: string[];
  editorIds: string[];
  memberEmails: Record<string, string>;
  kanbanIds: string[];
  inviteToken: string;
  editorInviteToken?: string;
  createdAt: number;
  folderLogoUrl?: string | null;
  order?: number;
  accoladesEnabled?: boolean;
}

export interface Kanban {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  inviteToken: string;
  columns: ColumnConfig[];
  totalEstimated: number;
  totalFromBacklog?: boolean;
  backlogColumnId?: string;
  groomedColumnId?: string;
  doneColumnId?: string;
  showProgressBar?: boolean;
  showLifeline?: boolean;
  showLogo?: boolean;
  showKanbanLogo?: boolean;
  showFolderLogo?: boolean;
  showSearchBar?: boolean;
  showShareCluster?: boolean;
  kanbanLogoUrl?: string;
  wrapCardText?: boolean;
  cardFontSize?: number;
  ownerEmail?: string;
  coOwnerIds?: string[];
  viewerIds?: string[];
  memberEmails?: Record<string, string>;
  projectStartYear: number;
  projectStartMonth: number;
  projectEndYear: number;
  projectEndMonth: number;
  cards: KanbanCard[];
  createdAt: number;
  showStoryPoints?: boolean;
  staleAfterDays?: number;
  accoladesEnabled?: boolean;
  attachmentsBytes?: number;
  assignmentDefinitions?: AssignmentDefinition[];
  showAssignmentsOnCard?: boolean;
}
