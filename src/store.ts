import {
  doc, getDoc, setDoc, deleteDoc, collection,
  query, where, getDocs, arrayUnion, arrayRemove, updateDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Kanban, KanbanCard, Folder, FolderRole } from './types';
import {
  buildDefaultColumns,
  DEFAULT_TOTAL_ESTIMATED,
  DEFAULT_PROJECT_START_YEAR,
  DEFAULT_PROJECT_START_MONTH,
  DEFAULT_PROJECT_END_YEAR,
  DEFAULT_PROJECT_END_MONTH,
} from './constants';
import { syncInheritedAccessForKanban, syncInheritedAccessForKanbanId, selfAddInheritedAccessForKanban } from './utils/checklistIntegration';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isKanbanOwner(kanban: Kanban, uid: string): boolean {
  return kanban.ownerId === uid || (kanban.coOwnerIds ?? []).includes(uid);
}

// ── Kanban CRUD ──────────────────────────────────────────────────────────────

// Real-time subscription to all kanbans the user can access.
// Calls onChange whenever any kanban is added, removed, or updated.
// Returns an unsubscribe function.
export function subscribeUserKanbans(uid: string, onChange: (kanbans: Kanban[]) => void): () => void {
  const col = collection(db, 'kanbans');
  // Each listener owns a slice of the merged map.
  // We key the outer map by query name so each listener only touches its own slice.
  const slices: Record<string, Map<string, Kanban>> = {
    owner: new Map(), member: new Map(), coOwner: new Map(), viewer: new Map(),
  };

  function rebuild() {
    const merged = new Map<string, Kanban>();
    for (const slice of Object.values(slices)) {
      for (const [id, k] of slice) merged.set(id, k);
    }
    onChange(Array.from(merged.values()).sort((a, b) => a.createdAt - b.createdAt));
  }

  const makeUnsub = (sliceKey: string, q: ReturnType<typeof query>) =>
    onSnapshot(q, snap => {
      const slice = slices[sliceKey];
      // Rebuild slice from the full current snapshot (handles removes automatically)
      slice.clear();
      snap.forEach(d => slice.set(d.id, { id: d.id, ...(d.data() as object) } as Kanban));
      rebuild();
    }, () => {}); // ignore permission errors on individual queries

  const unsubs = [
    makeUnsub('owner',   query(col, where('ownerId',    '==',            uid))),
    makeUnsub('member',  query(col, where('memberIds',  'array-contains', uid))),
    makeUnsub('coOwner', query(col, where('coOwnerIds', 'array-contains', uid))),
    makeUnsub('viewer',  query(col, where('viewerIds',  'array-contains', uid))),
  ];

  return () => unsubs.forEach(u => u());
}

export async function loadUserKanbans(uid: string): Promise<Kanban[]> {
  const col = collection(db, 'kanbans');
  const [ownerSnap, memberSnap, coOwnerSnap, viewerSnap] = await Promise.all([
    getDocs(query(col, where('ownerId', '==', uid))),
    getDocs(query(col, where('memberIds', 'array-contains', uid))),
    getDocs(query(col, where('coOwnerIds', 'array-contains', uid))),
    getDocs(query(col, where('viewerIds', 'array-contains', uid))).catch(() => null),
  ]);
  const map = new Map<string, Kanban>();
  const snaps = [ownerSnap, memberSnap, coOwnerSnap, viewerSnap].filter(Boolean);
  snaps.forEach(snap => snap!.docs.forEach(d => {
    map.set(d.id, { id: d.id, ...d.data() } as Kanban);
  }));
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
    groomedColumnId: cols[1].id,
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

export async function cloneKanban(kanban: Kanban, uid: string, email?: string): Promise<Kanban> {
  const id = crypto.randomUUID();
  const inviteToken = crypto.randomUUID();
  const cloned: Kanban = {
    ...kanban,
    id,
    name: `${kanban.name} (copy)`,
    ownerId: uid,
    ownerEmail: email ?? '',
    coOwnerIds: [],
    viewerIds: [],
    memberIds: [],
    memberEmails: {},
    inviteToken,
    createdAt: Date.now(),
  };
  await Promise.all([
    setDoc(doc(db, 'kanbans', id), cloned),
    setDoc(doc(db, 'kanbanInvites', inviteToken), {
      kanbanId: id,
      kanbanName: cloned.name,
      ownerId: uid,
    }),
  ]);
  return cloned;
}

// Moves or copies a single card into another kanban the user has write access
// to. Placed in the target's backlog column since the source column config
// (id, label, color) has no counterpart there.
export async function moveCardToKanban(
  sourceKanban: Kanban,
  targetKanbanId: string,
  card: KanbanCard,
  mode: 'move' | 'copy',
): Promise<void> {
  const targetSnap = await getDoc(doc(db, 'kanbans', targetKanbanId));
  if (!targetSnap.exists()) throw new Error('Target kanban not found');
  const target = { id: targetSnap.id, ...targetSnap.data() } as Kanban;
  const targetColumnId = target.backlogColumnId ?? target.columns[0]?.id;
  if (!targetColumnId) throw new Error('Target kanban has no columns');
  const maxOrder = target.cards.reduce((m, c) => c.columnId === targetColumnId ? Math.max(m, c.order) : m, -1);
  const movedCard: KanbanCard = {
    ...card,
    id: mode === 'copy' ? crypto.randomUUID() : card.id,
    columnId: targetColumnId,
    order: maxOrder + 1,
  };
  await setDoc(doc(db, 'kanbans', target.id), { ...target, cards: [...target.cards, movedCard] });
  if (mode === 'move') {
    await setDoc(doc(db, 'kanbans', sourceKanban.id), {
      ...sourceKanban,
      cards: sourceKanban.cards.filter(c => c.id !== card.id),
    });
  }
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
  syncInheritedAccessForKanban(updated).catch(() => {});
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
  syncInheritedAccessForKanban(updated).catch(() => {});
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
  await selfAddInheritedAccessForKanban(kanbanId, uid).catch(() => {});
}

// ── Default kanban for new users ─────────────────────────────────────────────

export async function ensureDefaultKanban(uid: string, email?: string): Promise<void> {
  const existing = await loadUserKanbans(uid);
  // Only count kanbans the user owns — shared/invited boards don't count
  const owned = existing.filter(k => k.ownerId === uid);
  if (owned.length === 0) {
    await createKanban(uid, 'AIM Kanban', email);
  }
}

// ── Folders ───────────────────────────────────────────────────────────────────

export async function createFolder(uid: string, name: string, email?: string): Promise<Folder> {
  const id = crypto.randomUUID();
  const inviteToken = crypto.randomUUID();
  const editorInviteToken = crypto.randomUUID();
  const folder: Folder = {
    id, name, ownerId: uid, ownerEmail: email ?? '',
    memberIds: [], editorIds: [], memberEmails: {}, kanbanIds: [],
    inviteToken, editorInviteToken, createdAt: Date.now(), order: Date.now(),
  };
  await Promise.all([
    setDoc(doc(db, 'folders', id), folder),
    setDoc(doc(db, 'folderInvites', inviteToken), {
      folderId: id, folderName: name, ownerEmail: email ?? '', kanbanIds: [], role: 'viewer',
    }),
    setDoc(doc(db, 'folderInvites', editorInviteToken), {
      folderId: id, folderName: name, ownerEmail: email ?? '', kanbanIds: [], role: 'editor',
    }),
  ]);
  return folder;
}

export async function deleteFolder(folder: Folder): Promise<void> {
  const ops = [
    deleteDoc(doc(db, 'folders', folder.id)),
    deleteDoc(doc(db, 'folderInvites', folder.inviteToken)),
  ];
  if (folder.editorInviteToken) {
    ops.push(deleteDoc(doc(db, 'folderInvites', folder.editorInviteToken)));
  }
  await Promise.all(ops);
}

export async function reorderFolder(folderId: string, newOrder: number): Promise<void> {
  await updateDoc(doc(db, 'folders', folderId), { order: newOrder });
}

export async function setFolderAccolades(folderId: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(db, 'folders', folderId), { accoladesEnabled: enabled });
}

export async function renameFolder(folder: Folder, name: string): Promise<void> {
  const ops: Promise<void>[] = [
    updateDoc(doc(db, 'folders', folder.id), { name }),
    updateDoc(doc(db, 'folderInvites', folder.inviteToken), { folderName: name }),
  ];
  if (folder.editorInviteToken) {
    ops.push(updateDoc(doc(db, 'folderInvites', folder.editorInviteToken), { folderName: name }));
  }
  await Promise.all(ops);
}

export async function addKanbanToFolder(
  folder: Folder,
  kanbanId: string,
  allKanbans: Kanban[],
): Promise<void> {
  const newIds = [...new Set([...folder.kanbanIds, kanbanId])];
  const inviteOps: Promise<void>[] = [
    updateDoc(doc(db, 'folders', folder.id), { kanbanIds: newIds }),
    updateDoc(doc(db, 'folderInvites', folder.inviteToken), { kanbanIds: newIds }),
  ];
  if (folder.editorInviteToken) {
    inviteOps.push(updateDoc(doc(db, 'folderInvites', folder.editorInviteToken), { kanbanIds: newIds }));
  }
  await Promise.all(inviteOps);
  // Propagate access: editors get member role, viewers get viewer role
  if (folder.memberIds.length > 0) {
    const kanban = allKanbans.find(k => k.id === kanbanId);
    if (kanban && kanban.ownerId === folder.ownerId) {
      const editorIds = folder.editorIds ?? [];
      await Promise.all(folder.memberIds.map(memberId => {
        const memberEmail = folder.memberEmails?.[memberId];
        const isEditor = editorIds.includes(memberId);
        const update: Record<string, unknown> = isEditor
          ? { memberIds: arrayUnion(memberId) }
          : { viewerIds: arrayUnion(memberId) };
        if (memberEmail) update[`memberEmails.${memberId}`] = memberEmail;
        return updateDoc(doc(db, 'kanbans', kanbanId), update).catch(() => {});
      }));
      syncInheritedAccessForKanbanId(kanbanId).catch(() => {});
    }
  }
}

export async function removeKanbanFromFolder(folder: Folder, kanbanId: string): Promise<void> {
  const newIds = folder.kanbanIds.filter(id => id !== kanbanId);
  await Promise.all([
    updateDoc(doc(db, 'folders', folder.id), { kanbanIds: newIds }),
    updateDoc(doc(db, 'folderInvites', folder.inviteToken), { kanbanIds: newIds }),
  ]);
}

export function subscribeUserFolders(
  uid: string,
  onChange: (folders: Folder[]) => void,
): () => void {
  const col = collection(db, 'folders');
  const slices: Record<string, Map<string, Folder>> = {
    owner: new Map(), member: new Map(),
  };

  function rebuild() {
    const merged = new Map<string, Folder>();
    for (const slice of Object.values(slices)) {
      for (const [id, f] of slice) merged.set(id, f);
    }
    onChange(Array.from(merged.values()).sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt)));
  }

  const makeUnsub = (sliceKey: string, q: ReturnType<typeof query>) =>
    onSnapshot(q, snap => {
      const slice = slices[sliceKey];
      slice.clear();
      snap.forEach(d => slice.set(d.id, { id: d.id, ...(d.data() as object) } as Folder));
      rebuild();
    }, () => {});

  const unsubs = [
    makeUnsub('owner',  query(col, where('ownerId',   '==',            uid))),
    makeUnsub('member', query(col, where('memberIds', 'array-contains', uid))),
  ];
  return () => unsubs.forEach(u => u());
}

// ── Folder invites ────────────────────────────────────────────────────────────

export interface FolderInviteInfo {
  folderId: string;
  folderName: string;
  ownerEmail: string;
  kanbanIds: string[];
  role: FolderRole;
}

export async function resolveFolderInvite(token: string): Promise<FolderInviteInfo | null> {
  const snap = await getDoc(doc(db, 'folderInvites', token));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    folderId: d.folderId as string,
    folderName: d.folderName as string,
    ownerEmail: d.ownerEmail as string,
    kanbanIds: (d.kanbanIds as string[]) ?? [],
    role: (d.role as FolderRole | undefined) ?? 'viewer',
  };
}

export async function joinFolder(
  folderId: string,
  uid: string,
  email?: string,
  kanbanIds: string[] = [],
  role: 'editor' | 'viewer' = 'viewer',
): Promise<void> {
  const folderUpdate: Record<string, unknown> = { memberIds: arrayUnion(uid) };
  if (role === 'editor') folderUpdate.editorIds = arrayUnion(uid);
  if (email) folderUpdate[`memberEmails.${uid}`] = email;
  await updateDoc(doc(db, 'folders', folderId), folderUpdate);
  // Self-add to each kanban — editors get member role, viewers get viewer role
  await Promise.all(kanbanIds.map(kanbanId => {
    const kanbanUpdate: Record<string, unknown> = role === 'editor'
      ? { memberIds: arrayUnion(uid) }
      : { viewerIds: arrayUnion(uid) };
    if (email) kanbanUpdate[`memberEmails.${uid}`] = email;
    return updateDoc(doc(db, 'kanbans', kanbanId), kanbanUpdate).catch(() => {});
  }));
  kanbanIds.forEach(kanbanId => syncInheritedAccessForKanbanId(kanbanId).catch(() => {}));
}

export async function setFolderMemberRole(
  folder: Folder,
  uid: string,
  newRole: 'editor' | 'viewer',
): Promise<void> {
  const editorIds = folder.editorIds ?? [];
  const folderUpdate: Record<string, unknown> = {};
  if (newRole === 'editor' && !editorIds.includes(uid)) {
    folderUpdate.editorIds = arrayUnion(uid);
  } else if (newRole === 'viewer' && editorIds.includes(uid)) {
    folderUpdate.editorIds = arrayRemove(uid);
  }
  if (Object.keys(folderUpdate).length > 0) {
    await updateDoc(doc(db, 'folders', folder.id), folderUpdate);
  }
  // Update each folder kanban: move member between memberIds and viewerIds
  await Promise.all(folder.kanbanIds.map(async kanbanId => {
    const kanbanUpdate: Record<string, unknown> = newRole === 'editor'
      ? { memberIds: arrayUnion(uid), viewerIds: arrayRemove(uid) }
      : { viewerIds: arrayUnion(uid), memberIds: arrayRemove(uid) };
    return updateDoc(doc(db, 'kanbans', kanbanId), kanbanUpdate).catch(() => {});
  }));
  folder.kanbanIds.forEach(kanbanId => syncInheritedAccessForKanbanId(kanbanId).catch(() => {}));
}

export async function removeFolderMember(folder: Folder, uid: string): Promise<void> {
  const emails = { ...(folder.memberEmails ?? {}) };
  delete emails[uid];
  await updateDoc(doc(db, 'folders', folder.id), {
    memberIds: arrayRemove(uid),
    editorIds: arrayRemove(uid),
    memberEmails: emails,
  });
  // Remove from all folder kanbans
  await Promise.all(folder.kanbanIds.map(kanbanId =>
    updateDoc(doc(db, 'kanbans', kanbanId), {
      memberIds: arrayRemove(uid),
      viewerIds: arrayRemove(uid),
    }).catch(() => {}),
  ));
  folder.kanbanIds.forEach(kanbanId => syncInheritedAccessForKanbanId(kanbanId).catch(() => {}));
}

export async function generateEditorInvite(folder: Folder): Promise<string> {
  const token = crypto.randomUUID();
  await Promise.all([
    updateDoc(doc(db, 'folders', folder.id), { editorInviteToken: token }),
    setDoc(doc(db, 'folderInvites', token), {
      folderId: folder.id,
      folderName: folder.name,
      ownerEmail: folder.ownerEmail ?? '',
      kanbanIds: folder.kanbanIds,
      role: 'editor',
    }),
  ]);
  return token;
}
