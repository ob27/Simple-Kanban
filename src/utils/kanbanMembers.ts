import type { Kanban } from '../types';

export interface KanbanMember {
  uid: string;
  email: string;
}

// Every uid with access to a board, owner first — a verbatim extraction of
// what AccessModal.tsx already computed inline (minus the access-control
// role tag), so a role-assignment member picker can reuse the exact same
// source of truth instead of re-deriving it.
export function getKanbanMembers(kanban: Kanban, currentUid: string, currentEmail: string): KanbanMember[] {
  const coOwnerIds = kanban.coOwnerIds ?? [];
  const viewerIds = kanban.viewerIds ?? [];

  function resolveEmail(uid: string): string {
    if (uid === currentUid && currentEmail) return currentEmail;
    if (uid === kanban.ownerId && kanban.ownerEmail) return kanban.ownerEmail;
    return kanban.memberEmails?.[uid] || '';
  }

  const uids = [
    kanban.ownerId,
    ...coOwnerIds,
    ...kanban.memberIds.filter(uid => uid !== kanban.ownerId && !coOwnerIds.includes(uid)),
    ...viewerIds.filter(uid => uid !== kanban.ownerId && !coOwnerIds.includes(uid) && !kanban.memberIds.includes(uid)),
  ];

  return uids.map(uid => ({ uid, email: resolveEmail(uid) }));
}
