import {
  doc, getDoc, setDoc, deleteDoc, collection,
  query, where, getDocs, arrayUnion, updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Kanban } from './types';
import {
  buildDefaultColumns,
  DEFAULT_TOTAL_ESTIMATED,
  DEFAULT_PROJECT_START_YEAR,
  DEFAULT_PROJECT_START_MONTH,
  DEFAULT_PROJECT_END_YEAR,
  DEFAULT_PROJECT_END_MONTH,
} from './constants';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isKanbanOwner(kanban: Kanban, uid: string): boolean {
  return kanban.ownerId === uid || (kanban.coOwnerIds ?? []).includes(uid);
}

// ── Kanban CRUD ──────────────────────────────────────────────────────────────

export async function loadUserKanbans(uid: string): Promise<Kanban[]> {
  const col = collection(db, 'kanbans');
  const [ownerSnap, memberSnap, coOwnerSnap, viewerSnap] = await Promise.all([
    getDocs(query(col, where('ownerId', '==', uid))),
    getDocs(query(col, where('memberIds', 'array-contains', uid))),
    getDocs(query(col, where('coOwnerIds', 'array-contains', uid))),
    getDocs(query(col, where('viewerIds', 'array-contains', uid))),
  ]);
  const map = new Map<string, Kanban>();
  [...ownerSnap.docs, ...memberSnap.docs, ...coOwnerSnap.docs, ...viewerSnap.docs].forEach(d => {
    map.set(d.id, { id: d.id, ...d.data() } as Kanban);
  });
  return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
}

export async function createKanban(uid: string, name: string, email?: string): Promise<Kanban> {
  const id = crypto.randomUUID();
  const inviteToken = crypto.randomUUID();
  const cols = buildDefaultColumns();
  const kanban: Kanban = {
    id,
    name,
    ownerId: uid,
    ownerEmail: email ?? '',
    coOwnerIds: [],
    viewerIds: [],
    memberIds: [],
    memberEmails: {},
    inviteToken,
    columns: cols,
    totalEstimated: DEFAULT_TOTAL_ESTIMATED,
    totalFromBacklog: false,
    backlogColumnId: cols[0].id,
    groomedColumnId: cols[2].id,
    doneColumnId: cols[5].id,
    showProgressBar: true,
    showLifeline: true,
    projectStartYear: DEFAULT_PROJECT_START_YEAR,
    projectStartMonth: DEFAULT_PROJECT_START_MONTH,
    projectEndYear: DEFAULT_PROJECT_END_YEAR,
    projectEndMonth: DEFAULT_PROJECT_END_MONTH,
    cards: [],
    createdAt: Date.now(),
  };
  await Promise.all([
    setDoc(doc(db, 'kanbans', id), kanban),
    setDoc(doc(db, 'kanbanInvites', inviteToken), {
      kanbanId: id,
      kanbanName: name,
      ownerId: uid,
    }),
  ]);
  return kanban;
}

export async function saveKanban(kanban: Kanban): Promise<void> {
  await setDoc(doc(db, 'kanbans', kanban.id), kanban);
}

export async function deleteKanban(kanban: Kanban): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db, 'kanbans', kanban.id)),
    deleteDoc(doc(db, 'kanbanInvites', kanban.inviteToken)),
  ]);
}

export async function regenerateInvite(kanban: Kanban): Promise<Kanban> {
  const newToken = crypto.randomUUID();
  const updated = { ...kanban, inviteToken: newToken };
  await Promise.all([
    deleteDoc(doc(db, 'kanbanInvites', kanban.inviteToken)),
    setDoc(doc(db, 'kanbanInvites', newToken), {
      kanbanId: kanban.id,
      kanbanName: kanban.name,
      ownerId: kanban.ownerId,
    }),
    setDoc(doc(db, 'kanbans', kanban.id), updated),
  ]);
  return updated;
}

// ── Access management ─────────────────────────────────────────────────────────

export async function removeMember(kanban: Kanban, uid: string): Promise<Kanban> {
  const emails = { ...(kanban.memberEmails ?? {}) };
  delete emails[uid];
  const updated: Kanban = {
    ...kanban,
    memberIds: kanban.memberIds.filter(id => id !== uid),
    coOwnerIds: (kanban.coOwnerIds ?? []).filter(id => id !== uid),
    viewerIds: (kanban.viewerIds ?? []).filter(id => id !== uid),
    memberEmails: emails,
  };
  await saveKanban(updated);
  return updated;
}

export async function setMemberRole(
  kanban: Kanban,
  uid: string,
  role: 'co-owner' | 'member' | 'viewer',
): Promise<Kanban> {
  const coOwnerIds = kanban.coOwnerIds ?? [];
  const viewerIds = kanban.viewerIds ?? [];
  const updated: Kanban = {
    ...kanban,
    coOwnerIds: role === 'co-owner'
      ? [...new Set([...coOwnerIds, uid])]
      : coOwnerIds.filter(id => id !== uid),
    memberIds: role === 'member'
      ? [...new Set([...kanban.memberIds, uid])]
      : kanban.memberIds.filter(id => id !== uid),
    viewerIds: role === 'viewer'
      ? [...new Set([...viewerIds, uid])]
      : viewerIds.filter(id => id !== uid),
  };
  await saveKanban(updated);
  return updated;
}

// ── Invite ───────────────────────────────────────────────────────────────────

export interface InviteInfo {
  kanbanId: string;
  kanbanName: string;
}

export async function resolveInvite(token: string): Promise<InviteInfo | null> {
  const snap = await getDoc(doc(db, 'kanbanInvites', token));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { kanbanId: d.kanbanId as string, kanbanName: d.kanbanName as string };
}

export async function joinKanban(kanbanId: string, uid: string, email?: string): Promise<void> {
  const update: Record<string, unknown> = { memberIds: arrayUnion(uid) };
  if (email) update[`memberEmails.${uid}`] = email;
  await updateDoc(doc(db, 'kanbans', kanbanId), update);
}

// ── Default kanban for new users ─────────────────────────────────────────────

export async function ensureDefaultKanban(uid: string, email?: string): Promise<void> {
  const existing = await loadUserKanbans(uid);
  if (existing.length === 0) {
    await createKanban(uid, 'AIM Kanban', email);
  }
}
