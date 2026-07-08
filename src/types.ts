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
}

export interface CardAttachment {
  id: string;
  name: string;
  url: string;
  path: string;
  size: number;
  type: string;
}

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
}
