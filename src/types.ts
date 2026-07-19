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
  checklistInstanceRefs?: CardChecklistInstanceRef[];
}

// One instance created for this card against a specific linked Checklist
// Template — a card can have up to 5 (one per link on the board).
export interface CardChecklistInstanceRef {
  linkId: string;
  templateId: string;
  instanceId: string;
}

// Simple-Checklists integration — links a Checklist Template (a document
// living in the separate Simple-Checklists app's `sclTemplates` collection,
// same shared Firestore project, no shared code between the two repos) to
// this Kanban's cards. Up to 5 links per board.
export type InstanceCreationTrigger =
  | { kind: 'onCardCreation' }
  | { kind: 'onColumnEntry'; columnId: string }
  | { kind: 'onDemand' };

export interface CardTemplateChecklistLink {
  id: string;
  templateId: string;
  templateName: string; // denormalized so the settings UI never needs a cross-app read just to list links
  trigger: InstanceCreationTrigger;
  linkedAt: number;
  linkedByUid: string;
}

// Every discrete, loggable action a card (or a bulk operation across
// several cards) can undergo — see src/utils/kanbanEvents.ts's
// logKanbanEvent for how these get written. Deliberately excludes
// same-column drag reorders and comment-reaction toggles: pure-noise
// interactions with no persistent semantic content, see that file's own
// doc comment for the reasoning.
export type KanbanEventType =
  | 'card.created' | 'card.movedColumn' | 'card.bulkStatusChange'
  | 'card.titleEdited' | 'card.notesEdited' | 'card.pillEdited' | 'card.storyPointsEdited'
  | 'card.deleted' | 'card.merged' | 'card.split'
  | 'card.movedToBoard' | 'card.copiedToBoard' | 'card.receivedFromBoard'
  | 'comment.added' | 'comment.edited' | 'comment.deleted'
  | 'attachment.uploaded' | 'attachment.deleted'
  | 'assignment.changed' | 'checklist.linked' | 'import.csvReplace'
  // Written directly by Simple-Checklists (no shared code between the two
  // repos — see kanbanEvents.ts's own doc comment), whenever a linked
  // sclInstances doc's saveInstanceResponse hits a milestone (item fully
  // answered, or the whole instance auto-completes). Not every raw value
  // change — that would flood this feed the same way a per-keystroke title
  // event would.
  | 'checklist.itemCompleted' | 'checklist.instanceCompleted';

// A single append-only history entry — kbnEvents/{eventId} in Firestore,
// never sclEvents-style batched with a primary write (see
// src/utils/kanbanEvents.ts). One flat shape with a loosely-typed `detail`
// catch-all rather than a discriminated union: Firestore doesn't enforce
// structure at read time regardless, and a union would need 15+ distinct
// construction shapes for marginal type-safety gain.
export interface KanbanEvent {
  id: string;
  kanbanId: string;
  cardId: string | null;       // null only for board-level events (import.csvReplace, bulkStatusChange)
  cardTitle: string | null;    // denormalized AT TIME OF EVENT — cards get deleted/retitled later
  type: KanbanEventType;
  actorUid: string;
  actorEmail: string | null;
  occurredAt: number;
  detail: Record<string, unknown> | null;
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
  cardTemplateChecklistLinks?: CardTemplateChecklistLink[];
  // Defaults to 'oldest' (unset) — matches how comments have always
  // rendered (plain append-order), so existing boards are unaffected.
  commentSortOrder?: 'newest' | 'oldest';
  // Gates whether the "History" toolbar button is offered at all — never
  // gates whether the History view is CURRENTLY open (that's local,
  // non-persisted state in BoardPage.tsx). Defaults to false/hidden.
  showHistory?: boolean;
}
