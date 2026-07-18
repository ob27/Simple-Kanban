// Append-only board history log — kbnEvents/{eventId}, a new top-level
// Firestore collection (mirrors Simple-Checklists' own scl-prefix
// convention for a collision-free namespace in the shared "oestler"
// project). Each event is its own immediate, independent, best-effort
// write, NOT appended to the same batch as the primary card mutation the
// way Simple-Checklists' logAuditEvent(batch, ...) is — there is no shared
// batch here: card mutations are local React state changes that only
// become a Firestore write up to 800ms later (BoardPage.tsx's debounced
// autosave), coalescing whatever changed in that window. Buffering events
// until the debounce fires would be fragile (lost on tab-close/crash) for
// no real benefit, so this history feed is deliberately best-effort and
// eventually-consistent, NOT transactionally exact — an acceptable
// trade-off for an activity feed, explicitly not the same integrity
// guarantee Simple-Checklists' compliance-flavored audit log makes.
//
// Echo-safety: logKanbanEvent must only ever be called from inside a real
// UI event handler (onClick/onDragEnd/form onFinish/etc.), never from
// useKanban.ts's onSnapshot callback or BoardPage.tsx's autosave effect —
// those two paths are the only places a REMOTE change gets applied
// locally, and neither of them calls any of the semantic handler functions
// (addCard, handleSaveCard, handleDragEnd, ...) that call this helper. So
// as long as every call site lives inside one of those handlers (never
// inside handleCardsChange's generic funnel), there's nothing extra to
// guard against — placement alone makes this echo-safe.
import {
  collection, doc, setDoc, getDocs, query, where, orderBy, startAfter, limit,
  type QueryDocumentSnapshot, type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { KanbanEvent, KanbanEventType } from '../types';

export function logKanbanEvent(args: {
  kanbanId: string;
  cardId: string | null;
  cardTitle: string | null;
  type: KanbanEventType;
  actorUid: string;
  actorEmail?: string | null;
  detail?: Record<string, unknown> | null;
}): void {
  const ref = doc(collection(db, 'kbnEvents'));
  const event: KanbanEvent = {
    id: ref.id,
    kanbanId: args.kanbanId,
    cardId: args.cardId,
    cardTitle: args.cardTitle,
    type: args.type,
    actorUid: args.actorUid,
    actorEmail: args.actorEmail ?? null,
    occurredAt: Date.now(),
    detail: args.detail ?? null,
  };
  setDoc(ref, event).catch(() => {});
}

export async function loadKanbanEventsPage(
  kanbanId: string,
  opts: {
    cardId?: string;
    typeFilter?: KanbanEventType;
    cursor?: QueryDocumentSnapshot;
    pageSize?: number;
  } = {},
): Promise<{ events: KanbanEvent[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [where('kanbanId', '==', kanbanId)];
  if (opts.cardId) constraints.push(where('cardId', '==', opts.cardId));
  if (opts.typeFilter) constraints.push(where('type', '==', opts.typeFilter));
  constraints.push(orderBy('occurredAt', 'desc'));
  if (opts.cursor) constraints.push(startAfter(opts.cursor));
  constraints.push(limit(opts.pageSize ?? 50));

  const snap = await getDocs(query(collection(db, 'kbnEvents'), ...constraints));
  return {
    events: snap.docs.map(d => d.data() as KanbanEvent),
    nextCursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
  };
}
