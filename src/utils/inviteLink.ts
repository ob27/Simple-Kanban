import type { Kanban } from '../types';

export function buildKanbanInviteUrl(kanban: Kanban): string {
  return `${window.location.origin}/simple-kanban/invite/${kanban.inviteToken}`;
}
