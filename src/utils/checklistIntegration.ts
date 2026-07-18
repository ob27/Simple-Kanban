// Simple-Checklists integration. There is no shared package between this
// repo and Simple-Checklists (no monorepo/workspace tooling exists anywhere
// on this platform) — both apps simply read/write the SAME shared Firestore
// database directly (same "oestler" project), so this file hand-mirrors
// only the fields of Simple-Checklists' own schema that Kanban actually
// touches, matching the platform's established per-repo-copy convention.
import {
  collection, doc, getDoc, getDocs, updateDoc, setDoc, onSnapshot,
  query, where, arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Kanban, KanbanCard, CardTemplateChecklistLink } from '../types';

export interface SclTemplateSummary {
  id: string;
  name: string;
  status: 'draft' | 'published' | 'archived';
  currentVersionId: string;
  currentVersionNumber: string;
  pendingDeletion?: unknown;
}

interface SclCheckItemComponent {
  id: string;
  required: boolean;
}
interface SclCheckItem {
  id: string;
  components: SclCheckItemComponent[];
}
interface SclTemplateVersionSummary {
  id: string;
  checkItems: SclCheckItem[];
  // Opaque to Kanban — forwarded verbatim into the new instance's
  // versionSnapshot so Simple-Checklists can render it without Kanban
  // needing to understand Section/pagination-mode shapes.
  sections: unknown;
  paginationMode: unknown;
  itemsPerPageThreshold?: unknown;
}

export interface SclInstanceSummary {
  id: string;
  templateId: string;
  templateName: string;
  name: string;
  status: 'open' | 'complete' | 'closed';
  completedRequiredCount?: number;
  totalRequiredCount?: number;
  source?: { kind: string; orphaned?: boolean };
}

// Templates the current uid has ANY access to (owner/co-owner/editor/
// completion-editor/viewer), merged from 5 slice queries — mirrors this
// app's own subscribeUserKanbans pattern, applied to the sclTemplates
// collection instead. Filtered to published-only client-side, since only
// published templates can back a new instance.
export function subscribeAvailableTemplates(uid: string, onChange: (templates: SclTemplateSummary[]) => void): () => void {
  const col = collection(db, 'sclTemplates');
  const slices: Record<string, Map<string, SclTemplateSummary>> = {
    owner: new Map(), coOwner: new Map(), editor: new Map(), completionEditor: new Map(), viewer: new Map(),
  };
  function rebuild() {
    const merged = new Map<string, SclTemplateSummary>();
    for (const slice of Object.values(slices)) for (const [id, t] of slice) merged.set(id, t);
    onChange(Array.from(merged.values()).filter(t => t.status === 'published' && !t.pendingDeletion));
  }
  const makeUnsub = (key: string, q: ReturnType<typeof query>) =>
    onSnapshot(q, snap => {
      slices[key].clear();
      snap.forEach(d => slices[key].set(d.id, { id: d.id, ...(d.data() as object) } as SclTemplateSummary));
      rebuild();
    }, () => {});
  const unsubs = [
    makeUnsub('owner', query(col, where('ownerId', '==', uid))),
    makeUnsub('coOwner', query(col, where('coOwnerIds', 'array-contains', uid))),
    makeUnsub('editor', query(col, where('editorIds', 'array-contains', uid))),
    makeUnsub('completionEditor', query(col, where('completionEditorIds', 'array-contains', uid))),
    makeUnsub('viewer', query(col, where('viewerIds', 'array-contains', uid))),
  ];
  return () => unsubs.forEach(u => u());
}

export function subscribeInstanceSummary(instanceId: string, onChange: (summary: SclInstanceSummary | null) => void): () => void {
  return onSnapshot(doc(db, 'sclInstances', instanceId), snap => {
    onChange(snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as SclInstanceSummary) : null);
  });
}

// One-time (not live) fetch, called lazily when a card's info icon is
// clicked — a plain description is rarely-viewed and never changes while
// the popover is open, so a live subscription would be pure overhead.
// Deliberately NOT denormalized onto the instance at creation time (unlike
// templateName): a description can be edited on the template after
// instances already exist, and staleness here would be actively misleading
// rather than just a cosmetic rename lag.
export async function getTemplateDescription(templateId: string): Promise<string | undefined> {
  const snap = await getDoc(doc(db, 'sclTemplates', templateId));
  if (!snap.exists()) return undefined;
  return (snap.data() as { description?: string }).description;
}

function requiredComponentCount(items: SclCheckItem[]): number {
  return items.reduce((n, item) => n + item.components.filter(c => c.required).length, 0);
}

// Current membership -> the instance's inherited-access arrays. "Member" in
// Kanban's vocabulary already implies full card edit access, so it maps to
// BOTH inheritedViewerUids and inheritedEditorUids; a plain viewer only
// gets inheritedViewerUids.
function inheritedAccessArrays(kanban: Kanban): { viewerUids: string[]; editorUids: string[] } {
  const owners = [kanban.ownerId, ...(kanban.coOwnerIds ?? [])];
  const editorUids = Array.from(new Set([...owners, ...kanban.memberIds]));
  const viewerUids = Array.from(new Set([...editorUids, ...(kanban.viewerIds ?? [])]));
  return { viewerUids, editorUids };
}

// Creates a new Checklist Instance directly against Simple-Checklists'
// sclInstances collection for a given card + link. Does NOT mutate the
// card itself — the caller is responsible for recording the returned
// instanceId onto card.checklistInstanceRefs via Kanban's own whole-doc
// saveKanban(), matching this app's existing write idiom.
export async function createChecklistInstanceForCard(
  kanban: Kanban,
  card: KanbanCard,
  link: CardTemplateChecklistLink,
  uid: string,
  email: string | undefined,
): Promise<string> {
  const templateSnap = await getDoc(doc(db, 'sclTemplates', link.templateId));
  if (!templateSnap.exists()) throw new Error('Linked template no longer exists');
  const template = templateSnap.data() as SclTemplateSummary;
  const versionSnap = await getDoc(doc(db, 'sclTemplates', link.templateId, 'versions', template.currentVersionId));
  if (!versionSnap.exists()) throw new Error('Template has no published version');
  const version = versionSnap.data() as SclTemplateVersionSummary;

  const { viewerUids, editorUids } = inheritedAccessArrays(kanban);
  const instanceId = crypto.randomUUID();
  const now = Date.now();
  const label = `${kanban.name} — ${card.title}`;

  await setDoc(doc(db, 'sclInstances', instanceId), {
    id: instanceId,
    templateId: link.templateId,
    templateName: template.name,
    templateVersionId: template.currentVersionId,
    templateVersionNumber: template.currentVersionNumber,
    name: `${template.name} — ${card.title}`,
    source: {
      kind: 'kanbanCard', label,
      kanbanId: kanban.id, kanbanName: kanban.name,
      cardId: card.id, cardName: card.title,
      linkId: link.id,
    },
    sourceLabelLower: label.toLowerCase(),
    creatorUid: uid,
    creatorEmail: email ?? null,
    createdAt: now,
    updatedAt: now,
    status: 'open',
    inheritedViewerUids: viewerUids,
    inheritedEditorUids: editorUids,
    inheritedFromKanbanId: kanban.id,
    responses: {},
    completedRequiredCount: 0,
    totalRequiredCount: requiredComponentCount(version.checkItems),
    versionSnapshot: {
      sections: version.sections,
      checkItems: version.checkItems,
      paginationMode: version.paginationMode,
      itemsPerPageThreshold: version.itemsPerPageThreshold,
    },
  });

  return instanceId;
}

// Keeps every instance sourced from this Kanban in sync with its CURRENT
// membership — called after any Kanban membership change (join/remove/role
// change). Queried by source.kanbanId rather than walking cards, since a
// flat query is cheap and Kanban doesn't need to know instance ids itself.
export async function syncInheritedAccessForKanban(kanban: Kanban): Promise<void> {
  const { viewerUids, editorUids } = inheritedAccessArrays(kanban);
  const snap = await getDocs(query(collection(db, 'sclInstances'), where('source.kanbanId', '==', kanban.id)));
  await Promise.all(snap.docs.map(d =>
    updateDoc(d.ref, { inheritedViewerUids: viewerUids, inheritedEditorUids: editorUids }).catch(() => {}),
  ));
}

// Convenience wrapper for call sites (folder-driven membership changes)
// that only have a kanbanId, not the full freshly-updated Kanban object —
// re-fetches the doc first so the sync reflects the just-written membership.
export async function syncInheritedAccessForKanbanId(kanbanId: string): Promise<void> {
  const snap = await getDoc(doc(db, 'kanbans', kanbanId));
  if (!snap.exists()) return;
  await syncInheritedAccessForKanban({ id: snap.id, ...(snap.data() as object) } as Kanban);
}

// Narrow self-add for a JOINING member: syncInheritedAccessForKanban's
// full-array rewrite is owner-gated (the owner is the one re-authoring
// membership), but a user joining via invite link is acting on their own
// behalf and isn't the owner. Firestore rules authorize this path
// specifically as "actor adds only their own uid, to both arrays, via
// arrayUnion" — distinct from the owner's full-rewrite path.
//
// Deliberately does NOT query sclInstances by source.kanbanId: the joining
// member has no read access to those instances yet (that's the whole point
// of this function), and a list query's rule check runs per-candidate-doc,
// so it would be rejected before a single write could happen. Instead this
// walks instance ids the member already has full read access to via their
// own (freshly joined) kanban doc, and writes to each by id directly —
// updateDoc() never requires a prior read.
export async function selfAddInheritedAccessForKanban(kanbanId: string, uid: string): Promise<void> {
  const kanbanSnap = await getDoc(doc(db, 'kanbans', kanbanId));
  if (!kanbanSnap.exists()) return;
  const kanban = kanbanSnap.data() as Kanban;
  const instanceIds = (kanban.cards ?? []).flatMap(c => (c.checklistInstanceRefs ?? []).map(r => r.instanceId));
  await Promise.all(instanceIds.map(instanceId =>
    updateDoc(doc(db, 'sclInstances', instanceId), {
      inheritedViewerUids: arrayUnion(uid),
      inheritedEditorUids: arrayUnion(uid),
    }).catch(() => {}),
  ));
}

// Card-deletion cleanup policy: mark linked instances as orphaned rather
// than deleting them outright — the safest default with no backend to
// guarantee a cascade, and consistent with how Simple-Checklists itself
// handles a deleted-but-still-linked template (reflect the state, don't
// silently destroy data).
export async function markCardInstancesOrphaned(refs: { instanceId: string }[] | undefined): Promise<void> {
  if (!refs?.length) return;
  await Promise.all(refs.map(async ref => {
    const snap = await getDoc(doc(db, 'sclInstances', ref.instanceId));
    if (!snap.exists()) return;
    const data = snap.data() as SclInstanceSummary & { source?: Record<string, unknown> };
    if (!data.source) return;
    await updateDoc(doc(db, 'sclInstances', ref.instanceId), { source: { ...data.source, orphaned: true } }).catch(() => {});
  }));
}
