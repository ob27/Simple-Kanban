import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Popover, Spin, Switch, Badge, Modal, Radio, Select, message, Input, Tooltip, Dropdown } from 'antd';
import { EditOutlined, ArrowLeftOutlined, SettingOutlined, FilterOutlined, CheckSquareOutlined, SearchOutlined, InfoCircleOutlined, HistoryOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';
import type { KanbanCard, CardAttachment, CardChecklistInstanceRef } from '../types';
import { saveKanban, deleteKanban, isKanbanOwner, loadUserKanbans, moveCardToKanban, cloneKanban } from '../store';
import type { Kanban as KanbanType } from '../types';
import { uploadCardAttachment, deleteCardAttachment, uploadCommentImage } from '../utils/cardAttachments';
import { MAX_ATTACHMENTS_BYTES, MAX_USER_ATTACHMENTS_BYTES, formatBytes } from '../constants';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { exportKanbanCSV } from '../utils/csvExport';
import { getWorkspaceSettings } from '../utils/logoUpload';
import { buildWildcardMatcher } from '../utils/wildcardSearch';
import { useUserProfiles, resolveDisplay } from '../utils/userProfiles';
import { getKanbanMembers } from '../utils/kanbanMembers';
import { markCardInstancesOrphaned, createChecklistInstanceForCard } from '../utils/checklistIntegration';
import { CardFilterModal, pillFilterKey, assignmentFilterKey, UNALLOCATED_KEY } from '../components/CardFilterModal';
import { useAuth } from '../AuthContext';
import { ProgressBar } from '../components/ProgressBar';
import { ProjectLifeline } from '../components/ProjectLifeline';
import { KanbanBoard } from '../components/KanbanBoard';
import { AddCardModal } from '../components/AddCardModal';
import { KanbanSettings } from '../components/KanbanSettings';
import { AccessModal } from '../components/AccessModal';
import { HistoryView } from '../components/HistoryView';
import { logKanbanEvent } from '../utils/kanbanEvents';
import { UserAvatar } from '../components/UserAvatar';
import { NotificationBell } from '../components/NotificationBell';
import { useKanban } from '../hooks/useKanban';
import { useBreakpoint } from '../hooks/useBreakpoint';

export function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { kanban, setKanban, remoteVersion, loading, notFound } = useKanban(id!);

  const [editTotal, setEditTotal] = useState(false);
  const [editValue, setEditValue] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [folderLogoUrl, setFolderLogoUrl] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [folderAccoladesEnabled, setFolderAccoladesEnabled] = useState<boolean | undefined>(undefined);
  const [workspaceAccoladesEnabled, setWorkspaceAccoladesEnabled] = useState<boolean | undefined>(undefined);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSurvivorId, setMergeSurvivorId] = useState<string | null>(null);
  const [otherKanbans, setOtherKanbans] = useState<KanbanType[]>([]);
  const [cardSearch, setCardSearch] = useState('');
  const [accessOpen, setAccessOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCardFilter, setHistoryCardFilter] = useState<string | null>(null);

  const ownProfile = useUserProfiles(user ? [user.uid] : []);
  const isOwner = kanban && user ? isKanbanOwner(kanban, user.uid) : false;
  const isViewer = kanban && user ? (kanban.viewerIds ?? []).includes(user.uid) : false;
  const { isMobile } = useBreakpoint();

  const boardMemberUids = kanban ? Array.from(new Set([kanban.ownerId, ...(kanban.coOwnerIds ?? []), ...kanban.memberIds])) : [];
  const boardMemberProfiles = useUserProfiles(kanban ? [...boardMemberUids, kanban.ownerId] : []);
  const boardMembers = kanban && user ? getKanbanMembers(kanban, user.uid, user.email ?? '') : [];
  const memberDisplayNameByUid = Object.fromEntries(
    boardMembers.map(m => [m.uid, resolveDisplay(m.uid, m.email, boardMemberProfiles).name]),
  );

  const totalCardCount = kanban ? kanban.cards.length : 0;
  const effectiveTotal = kanban
    ? (kanban.totalFromBacklog ? Math.max(totalCardCount, 1) : kanban.totalEstimated)
    : 1;

  const uniquePillValues = kanban
    ? [...new Set(kanban.cards.map(c => c.pillValue).filter((v): v is string => !!v))]
    : [];
  const hasAnyAssignmentValues = !!kanban?.cards.some(c => c.cardAssignments && Object.keys(c.cardAssignments).length > 0);
  // A card matches if ANY selected filter entry (pill or assignment, mixed
  // freely in one Set via composite keys) matches it — OR semantics across
  // the whole selection, same as the pill-only filter always had.
  function cardMatchesFilter(card: KanbanCard): boolean {
    if (card.pillValue && cardFilter.has(pillFilterKey(card.pillValue))) return true;
    for (const def of kanban?.assignmentDefinitions ?? []) {
      if (!card.cardAssignments?.[def.id] && cardFilter.has(assignmentFilterKey(def.id, UNALLOCATED_KEY))) return true;
    }
    if (card.cardAssignments) {
      for (const [defId, val] of Object.entries(card.cardAssignments)) {
        const valueKey = val.kind === 'member' ? val.uid : `text:${val.text}`;
        if (cardFilter.has(assignmentFilterKey(defId, valueKey))) return true;
      }
    }
    return false;
  }
  const cardFilteredCards = kanban && cardFilter.size > 0
    ? kanban.cards.filter(cardMatchesFilter)
    : kanban?.cards ?? [];
  const searchTerm = cardSearch.trim();
  const searchMatcher = searchTerm ? buildWildcardMatcher(searchTerm) : null;
  const filteredCards = searchMatcher
    ? cardFilteredCards.filter(c =>
        searchMatcher(c.title) || searchMatcher(c.notes ?? '') || searchMatcher(c.pillValue ?? '')
        || (c.comments ?? []).some(comment => searchMatcher(comment.text)))
    : cardFilteredCards;

  // Account-wide attachment usage — only counts boards the user owns, since
  // a shared board's storage cost is attributed to its actual owner, not
  // every collaborator who happens to upload to it.
  const otherOwnedKanbansBytes = otherKanbans
    .filter(k => k.ownerId === user?.uid && k.id !== kanban?.id)
    .reduce((sum, k) => sum + (k.attachmentsBytes ?? 0), 0);
  const accountAttachmentsBytes = otherOwnedKanbansBytes + (kanban?.attachmentsBytes ?? 0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (kanban && !initialised.current) {
      setEditValue(kanban.totalEstimated);
      initialised.current = true;
      getWorkspaceSettings(kanban.ownerId).then(s => {
        setLogoUrl(s.boardLogoUrl);
        setWorkspaceAccoladesEnabled(s.accoladesEnabled);
      });
      // Find the folder containing this kanban.
      // Firestore security rules only allow queries filtered by ownerId or memberIds,
      // so we run two simple queries that match the rule, then filter client-side.
      if (user?.uid) {
        const col = collection(db, 'folders');
        Promise.all([
          getDocs(query(col, where('ownerId', '==', user.uid))).catch(() => null),
          getDocs(query(col, where('memberIds', 'array-contains', user.uid))).catch(() => null),
        ]).then(([ownerSnap, memberSnap]) => {
          const allDocs = [
            ...(ownerSnap?.docs ?? []),
            ...(memberSnap?.docs ?? []),
          ];
          const found = allDocs.find(d => (d.data().kanbanIds as string[] ?? []).includes(kanban.id));
          if (found) {
            const logoUrl = found.data().folderLogoUrl as string | null | undefined;
            setFolderLogoUrl(logoUrl ?? null);
            setFolderAccoladesEnabled(found.data().accoladesEnabled as boolean | undefined);
          }
        });
      }
    }
  }, [kanban]);

  useEffect(() => {
    if (!user?.uid) return;
    loadUserKanbans(user.uid).then(setOtherKanbans);
  }, [user?.uid]);

  useEffect(() => {
    if (!kanban || !initialised.current) return;
    // Skip save when this state came from Firestore (remote update, not local edit)
    if (kanban === remoteVersion.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveKanban(kanban), 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [kanban]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#EEF0F5' }}>
      <Spin size="large" />
    </div>
  );

  // Not a real board view (no id, or an id the user can't access) — show
  // the standard product header (same as Dashboard.tsx) rather than a bare
  // message, since this page isn't actually rendering a kanban board here.
  if (notFound || !kanban) return (
    <div style={{ height: '100vh', background: '#EEF0F5', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: '#1a1a2e', padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>
          <img src="/favicon-white.svg" alt="" style={{ height: 16, width: 'auto' }} />
          Simple Kanban
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user && <NotificationBell uid={user.uid} />}
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'email', label: user ? resolveDisplay(user.uid, user.email ?? '', ownProfile).name : user, disabled: true },
                { type: 'divider' as const },
                { key: 'all-products', icon: <ArrowLeftOutlined />, label: 'All products' },
                { key: 'profile', icon: <UserOutlined />, label: 'Profile' },
                { type: 'divider' as const },
                { key: 'signout', icon: <LogoutOutlined />, label: 'Sign out', danger: true },
              ],
              onClick: ({ key }) => {
                if (key === 'all-products') window.location.href = '/';
                if (key === 'profile') window.location.href = '/profile';
                if (key === 'signout') signOut();
              },
            }}
          >
            <span style={{ display: 'inline-flex', cursor: 'pointer' }}>
              {user?.email
                ? <UserAvatar email={user.email} seed={resolveDisplay(user.uid, user.email, ownProfile).avatarSeed} photoURL={ownProfile[user.uid]?.avatarPhotoURL} size={28} />
                : <span style={{ color: '#8794b0', fontSize: 13 }}>Account</span>}
            </span>
          </Dropdown>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: '#666' }}>Kanban not found or you don't have access.</p>
        <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
      </div>
    </div>
  );

  async function addCard(card: Omit<KanbanCard, 'id' | 'order'>) {
    if (!kanban) return;
    const maxOrder = kanban.cards.reduce((m, c) => c.columnId === card.columnId ? Math.max(m, c.order) : m, -1);
    const newCard: KanbanCard = { ...card, id: crypto.randomUUID(), order: maxOrder + 1, movedAt: Date.now() };
    setKanban({ ...kanban, cards: [...kanban.cards, newCard] });
    if (user) {
      logKanbanEvent({ kanbanId: kanban.id, cardId: newCard.id, cardTitle: newCard.title, type: 'card.created', actorUid: user.uid, actorEmail: user.email });
    }

    // Simple Checklists integration: any link configured to create an
    // instance on card creation fires now. A template that's since been
    // archived/deleted is skipped silently — the card just doesn't get that
    // checklist rather than blocking creation entirely.
    const onCreationLinks = (kanban.cardTemplateChecklistLinks ?? []).filter(l => l.trigger.kind === 'onCardCreation');
    if (onCreationLinks.length === 0 || !user) return;
    const refs: CardChecklistInstanceRef[] = [];
    for (const link of onCreationLinks) {
      try {
        const instanceId = await createChecklistInstanceForCard(kanban, newCard, link, user.uid, user.email ?? undefined);
        refs.push({ linkId: link.id, templateId: link.templateId, instanceId });
        logKanbanEvent({
          kanbanId: kanban.id, cardId: newCard.id, cardTitle: newCard.title, type: 'checklist.linked',
          actorUid: user.uid, actorEmail: user.email,
          detail: { linkId: link.id, templateId: link.templateId, templateName: link.templateName, trigger: link.trigger.kind },
        });
      } catch { /* skip */ }
    }
    if (refs.length > 0) {
      setKanban(prev => prev ? { ...prev, cards: prev.cards.map(c => c.id === newCard.id ? { ...c, checklistInstanceRefs: [...(c.checklistInstanceRefs ?? []), ...refs] } : c) } : prev);
    }
  }

  function toggleSelectMode() {
    setSelectMode(prev => !prev);
    setSelectedCardIds(new Set());
  }

  function toggleCardSelection(cardId: string) {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function handleBulkStatusChange(columnId: string) {
    if (!kanban) return;
    const affectedCards = kanban.cards.filter(c => selectedCardIds.has(c.id));
    setKanban({
      ...kanban,
      cards: kanban.cards.map(c => selectedCardIds.has(c.id) ? { ...c, columnId, movedAt: Date.now() } : c),
    });
    if (user && affectedCards.length > 0) {
      const toColumnLabel = kanban.columns.find(col => col.id === columnId)?.label ?? columnId;
      logKanbanEvent({
        kanbanId: kanban.id, cardId: null, cardTitle: null, type: 'card.bulkStatusChange',
        actorUid: user.uid, actorEmail: user.email,
        detail: { toColumnId: columnId, toColumnLabel, cardIds: affectedCards.map(c => c.id), cardTitles: affectedCards.map(c => c.title) },
      });
    }
    setSelectedCardIds(new Set());
  }

  function dedupeAttachmentNames(attachments: CardAttachment[]): CardAttachment[] {
    const seen = new Map<string, number>();
    return attachments.map(a => {
      const count = seen.get(a.name) ?? 0;
      seen.set(a.name, count + 1);
      if (count === 0) return a;
      const dotIdx = a.name.lastIndexOf('.');
      const base = dotIdx > 0 ? a.name.slice(0, dotIdx) : a.name;
      const ext = dotIdx > 0 ? a.name.slice(dotIdx) : '';
      return { ...a, name: `${base} (${count + 1})${ext}` };
    });
  }

  function handleMergeConfirm() {
    if (!kanban || !mergeSurvivorId) return;
    const selected = kanban.cards.filter(c => selectedCardIds.has(c.id));
    const survivor = selected.find(c => c.id === mergeSurvivorId);
    if (!survivor) return;
    const others = selected.filter(c => c.id !== mergeSurvivorId);
    const mergedNotes = [survivor.notes, ...others.map(c => c.notes)].filter(Boolean).join('\n\n---\n\n');
    const mergedComments = [...(survivor.comments ?? []), ...others.flatMap(c => c.comments ?? [])]
      .sort((a, b) => a.createdAt - b.createdAt);
    const mergedAttachments = dedupeAttachmentNames([...(survivor.attachments ?? []), ...others.flatMap(c => c.attachments ?? [])]);
    const mergedCard: KanbanCard = {
      ...survivor,
      notes: mergedNotes || undefined,
      comments: mergedComments.length ? mergedComments : undefined,
      attachments: mergedAttachments.length ? mergedAttachments : undefined,
    };
    const otherIds = new Set(others.map(c => c.id));
    setKanban({
      ...kanban,
      cards: kanban.cards.filter(c => !otherIds.has(c.id)).map(c => c.id === mergedCard.id ? mergedCard : c),
    });
    if (user) {
      logKanbanEvent({
        kanbanId: kanban.id, cardId: mergedCard.id, cardTitle: mergedCard.title, type: 'card.merged',
        actorUid: user.uid, actorEmail: user.email,
        detail: { survivorCardId: mergedCard.id, survivorCardTitle: mergedCard.title, absorbedCardIds: others.map(c => c.id), absorbedCardTitles: others.map(c => c.title) },
      });
    }
    setSelectedCardIds(new Set());
    setMergeOpen(false);
    setMergeSurvivorId(null);
  }

  function handleSplitCard(cardId: string, titles: string[]) {
    if (!kanban) return;
    const idx = kanban.cards.findIndex(c => c.id === cardId);
    if (idx === -1) return;
    const original = kanban.cards[idx];
    const newCards: KanbanCard[] = titles.map((title, i) => ({
      id: crypto.randomUUID(),
      title,
      columnId: original.columnId,
      pillValue: original.pillValue,
      order: original.order + i * 0.001,
      notes: i === 0 ? original.notes : undefined,
      movedAt: Date.now(),
    }));
    const cards = [...kanban.cards];
    cards.splice(idx, 1, ...newCards);
    setKanban({ ...kanban, cards });
    if (user) {
      logKanbanEvent({
        kanbanId: kanban.id, cardId: original.id, cardTitle: original.title, type: 'card.split',
        actorUid: user.uid, actorEmail: user.email,
        detail: { originalCardId: original.id, originalCardTitle: original.title, resultCardIds: newCards.map(c => c.id), resultCardTitles: newCards.map(c => c.title) },
      });
    }
  }

  async function handleMoveOrCopyCard(card: KanbanCard, targetKanbanId: string, mode: 'move' | 'copy') {
    if (!kanban || !user) return;
    try {
      await moveCardToKanban(kanban, targetKanbanId, card, mode, user.uid, user.email);
      message.success(mode === 'move' ? 'Card moved' : 'Card copied');
    } catch {
      message.error(`Failed to ${mode} card`);
    }
  }

  async function handleUploadAttachment(cardId: string, file: File, onProgress?: (pct: number) => void) {
    if (!kanban) return;
    try {
      await uploadCardAttachment(kanban, cardId, file, otherOwnedKanbansBytes, onProgress, user?.uid, user?.email);
    } catch (err) {
      if (err instanceof Error && err.message === 'over-kanban-limit') {
        message.error(`This board has used ${formatBytes(kanban.attachmentsBytes ?? 0)} of ${formatBytes(MAX_ATTACHMENTS_BYTES)} — delete an attachment to free up space`);
      } else if (err instanceof Error && err.message === 'over-user-limit') {
        message.error(`Your account has used ${formatBytes(accountAttachmentsBytes)} of ${formatBytes(MAX_USER_ATTACHMENTS_BYTES)} across all your kanbans — delete an attachment to free up space`);
      } else {
        message.error('Failed to upload attachment');
      }
    }
  }

  async function handleDeleteAttachment(cardId: string, attachment: CardAttachment) {
    if (!kanban) return;
    try {
      await deleteCardAttachment(kanban, cardId, attachment, user?.uid, user?.email);
    } catch {
      message.error('Failed to delete attachment');
    }
  }

  // Returns the uploaded image's metadata so CardNotesModal can attach it to
  // the comment it's about to send. Deliberately doesn't write to Firestore
  // itself — see uploadCommentImage's comment for why — the byte count is
  // folded into the same handleCardsChange call that adds the comment.
  async function handleUploadCommentImage(cardId: string, file: File): Promise<{ url: string; path: string; size: number } | null> {
    if (!kanban) return null;
    try {
      return await uploadCommentImage(kanban, cardId, file, otherOwnedKanbansBytes);
    } catch (err) {
      if (err instanceof Error && err.message === 'over-kanban-limit') {
        message.error(`This board has used ${formatBytes(kanban.attachmentsBytes ?? 0)} of ${formatBytes(MAX_ATTACHMENTS_BYTES)} — delete an attachment to free up space`);
      } else if (err instanceof Error && err.message === 'over-user-limit') {
        message.error(`Your account has used ${formatBytes(accountAttachmentsBytes)} of ${formatBytes(MAX_USER_ATTACHMENTS_BYTES)} across all your kanbans — delete an attachment to free up space`);
      } else {
        message.error('Failed to upload image');
      }
      return null;
    }
  }

  function deleteCard(cardId: string) {
    if (!kanban) return;
    const card = kanban.cards.find(c => c.id === cardId);
    if (card?.checklistInstanceRefs?.length) markCardInstancesOrphaned(card.checklistInstanceRefs).catch(() => {});
    setKanban({ ...kanban, cards: kanban.cards.filter(c => c.id !== cardId) });
    if (user && card) {
      logKanbanEvent({ kanbanId: kanban.id, cardId: card.id, cardTitle: card.title, type: 'card.deleted', actorUid: user.uid, actorEmail: user.email });
    }
  }

  function handleCardsChange(newCards: KanbanCard[], attachmentsBytesDelta = 0) {
    if (!kanban) return;
    const attachmentsBytes = attachmentsBytesDelta
      ? Math.max(0, (kanban.attachmentsBytes ?? 0) + attachmentsBytesDelta)
      : kanban.attachmentsBytes;
    // KanbanBoard only ever knows about the cards it was handed (`filteredCards`
    // above), so any interaction there — drag reorder, reactions, comments —
    // reports back a `newCards` array scoped to whatever's currently visible.
    // Text search narrows visibility exactly like the pill filter does, so it
    // has to be checked here too — this used to only test `cardFilter.size`,
    // which meant searching for a card and then dragging/reacting/commenting
    // on it silently replaced the whole board with just the search-matched
    // cards, and the very next autosave wrote that truncated set to Firestore,
    // permanently deleting every card the search had hidden.
    if (cardFilter.size === 0 && !searchTerm) {
      setKanban({ ...kanban, cards: newCards, attachmentsBytes });
      return;
    }
    const visibleIds = new Set(newCards.map(c => c.id));
    const hidden = kanban.cards.filter(c => !visibleIds.has(c.id));
    setKanban({ ...kanban, cards: [...newCards, ...hidden], attachmentsBytes });
  }

  function confirmEditTotal() {
    if (!kanban || !editValue || editValue <= 0) return;
    setKanban({ ...kanban, totalEstimated: editValue });
    setEditTotal(false);
  }

  function handleChangeDates(sy: number, sm: number, ey: number, em: number) {
    if (!kanban) return;
    setKanban({ ...kanban, projectStartYear: sy, projectStartMonth: sm, projectEndYear: ey, projectEndMonth: em });
  }

  async function handleDeleteKanban() {
    if (!kanban) return;
    await deleteKanban(kanban);
    navigate('/');
  }

  async function handleDuplicateKanban() {
    if (!kanban || !user) return;
    try {
      const cloned = await cloneKanban(kanban, user.uid, user.email ?? undefined);
      message.success(`Duplicated as "${cloned.name}"`);
      setSettingsOpen(false);
      navigate(`/k/${cloned.id}`);
    } catch {
      message.error('Failed to duplicate kanban');
    }
  }

  const totalPopoverContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch
          size="small"
          checked={kanban.totalFromBacklog ?? false}
          onChange={v => setKanban({ ...kanban, totalFromBacklog: v })}
        />
        <span style={{ fontSize: 13, color: '#444' }}>Use total card count</span>
      </div>
      {kanban.totalFromBacklog ? (
        <div style={{ fontSize: 13, color: '#888' }}>
          Total: <strong style={{ color: '#1a1a2e' }}>{totalCardCount}</strong> card{totalCardCount !== 1 ? 's' : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            min={1}
            value={editValue || ''}
            onChange={e => setEditValue(parseInt(e.target.value) || 0)}
            onKeyDown={e => e.key === 'Enter' && confirmEditTotal()}
            style={{ width: 100, fontSize: 20, fontWeight: 700, padding: '4px 10px', border: '1px solid #d9d9d9', borderRadius: 6, outline: 'none' }}
            autoFocus
          />
          <Button type="primary" onClick={confirmEditTotal}>OK</Button>
        </div>
      )}
    </div>
  );

  const showLifeline = (kanban.showLifeline ?? true) && !isMobile;
  const showProgressBar = kanban.showProgressBar ?? true;

  if (historyOpen) {
    return (
      <HistoryView
        kanban={kanban}
        initialCardFilter={historyCardFilter}
        onBack={() => { setHistoryOpen(false); setHistoryCardFilter(null); }}
      />
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      padding: '12px 16px',
      gap: 8,
      background: '#EEF0F5',
    }}>
      {(() => {
        const src = (kanban.showKanbanLogo && kanban.kanbanLogoUrl)
          ? kanban.kanbanLogoUrl
          : (kanban.showFolderLogo && folderLogoUrl)
          ? folderLogoUrl
          : (kanban.showLogo && logoUrl) ? logoUrl : null;
        if (!src && !kanban.showSearchBar && !kanban.showShareCluster) return null;

        const memberUids = boardMemberUids;
        const memberEmailFor = (uid: string) => uid === kanban.ownerId ? (kanban.ownerEmail || uid) : (kanban.memberEmails?.[uid] || uid);
        const memberDisplayFor = (uid: string) => resolveDisplay(uid, memberEmailFor(uid), boardMemberProfiles);
        const visibleMembers = memberUids.slice(0, 3);
        const overflowCount = memberUids.length - visibleMembers.length;

        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {src && <img src={src} alt="logo" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {kanban.showSearchBar && (
                <Input
                  prefix={<SearchOutlined style={{ color: '#aaa' }} />}
                  suffix={
                    <Tooltip title="Searches title, notes, the pill, and comments. Use * to match any text — e.g. Alpha* finds AlphaOne and AlphaTwo, *card finds BetaCard, and *urgent* finds it anywhere.">
                      <InfoCircleOutlined style={{ color: '#bbb', cursor: 'help' }} />
                    </Tooltip>
                  }
                  placeholder="Search cards"
                  value={cardSearch}
                  onChange={e => setCardSearch(e.target.value)}
                  allowClear
                  style={{ width: isMobile ? 160 : 220, borderRadius: 8 }}
                />
              )}
              {kanban.showShareCluster && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {visibleMembers.map((uid, i) => {
                      const display = memberDisplayFor(uid);
                      return (
                        <Tooltip key={uid} title={display.name}>
                          <div style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: '50%', border: '2px solid #EEF0F5' }}>
                            <UserAvatar email={memberEmailFor(uid)} seed={display.avatarSeed} photoURL={display.avatarPhotoURL} size={28} />
                          </div>
                        </Tooltip>
                      );
                    })}
                    {overflowCount > 0 && (
                      <div style={{
                        marginLeft: -8, width: 28, height: 28, borderRadius: '50%', background: '#e2e2e8',
                        border: '2px solid #EEF0F5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600, color: '#666', flexShrink: 0,
                      }}>
                        +{overflowCount}
                      </div>
                    )}
                  </div>
                  {isOwner && (
                    <Button size="small" type="primary" onClick={() => setAccessOpen(true)}>
                      Invite
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {showLifeline && (
        <ProjectLifeline
          startYear={kanban.projectStartYear}
          startMonth={kanban.projectStartMonth}
          endYear={kanban.projectEndYear}
          endMonth={kanban.projectEndMonth}
          onChangeDates={handleChangeDates}
        />
      )}

      {showProgressBar && (
        <ProgressBar
          cards={filteredCards}
          columns={kanban.columns}
          totalEstimated={cardFilter.size > 0 ? filteredCards.length : effectiveTotal}
          doneColumnId={kanban.doneColumnId}
          groomedColumnId={kanban.groomedColumnId}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: 44, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            size="small"
            onClick={() => navigate('/')}
            style={{ color: '#666', padding: '0 4px' }}
          />
          <Popover
            content={totalPopoverContent}
            trigger="click"
            open={editTotal}
            onOpenChange={open => {
              setEditTotal(open);
              if (open) setEditValue(kanban.totalEstimated);
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 'clamp(16px, 2vw, 28px)', fontWeight: 800, color: '#1a1a2e', lineHeight: 1 }}>
                  {kanban.name}
                </span>
                <span style={{ fontSize: 'clamp(12px, 1.1vw, 16px)', fontWeight: 400, color: '#666', lineHeight: 1 }}>
                  {cardFilter.size > 0 || searchTerm
                    ? `${filteredCards.length} of ${kanban.cards.length} cards`
                    : `${kanban.cards.length} of ${effectiveTotal} cards`}
                </span>
                {!isViewer && <EditOutlined style={{ fontSize: 13, color: '#aaa', marginLeft: 2 }} />}
              </div>
              {!isOwner && kanban.ownerEmail && (
                <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>
                  Shared by {resolveDisplay(kanban.ownerId, kanban.ownerEmail, boardMemberProfiles).name}
                </span>
              )}
            </div>
          </Popover>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isViewer && (
            <Button
              icon={<CheckSquareOutlined />}
              size="small"
              type={selectMode ? 'primary' : 'text'}
              onClick={toggleSelectMode}
              style={selectMode ? undefined : { color: '#666' }}
            >
              {!isMobile && 'Select'}
            </Button>
          )}
          {(uniquePillValues.length > 0 || hasAnyAssignmentValues) && (
            <Badge count={cardFilter.size} size="small" offset={[-4, 4]}>
              <Button
                icon={<FilterOutlined />}
                size="small"
                type={cardFilter.size > 0 ? 'primary' : 'text'}
                onClick={() => setFilterOpen(true)}
                style={cardFilter.size === 0 ? { color: '#666' } : undefined}
              >
                {!isMobile && 'Filter'}
              </Button>
            </Badge>
          )}
          {kanban.showHistory && (
            <Button
              icon={<HistoryOutlined />}
              size="small"
              type="text"
              onClick={() => setHistoryOpen(true)}
              style={{ color: '#666' }}
            >
              {!isMobile && 'History'}
            </Button>
          )}
          {isOwner && (
            <Button
              icon={<SettingOutlined />}
              size="small"
              type="text"
              onClick={() => setSettingsOpen(true)}
              style={{ color: '#666' }}
            >
              {!isMobile && 'Settings'}
            </Button>
          )}
        </div>
      </div>

      <KanbanBoard
        kanban={kanban}
        cards={filteredCards}
        columns={kanban.columns}
        onCardsChange={handleCardsChange}
        onDeleteCard={deleteCard}
        cardFontSize={kanban.cardFontSize}
        wrapCardText={kanban.wrapCardText}
        isOwner={isOwner}
        isViewer={isViewer}
        showStoryPoints={kanban.showStoryPoints}
        staleAfterDays={kanban.staleAfterDays}
        accoladesEnabled={kanban.accoladesEnabled ?? folderAccoladesEnabled ?? workspaceAccoladesEnabled ?? true}
        selectMode={selectMode}
        selectedCardIds={selectedCardIds}
        onToggleSelect={toggleCardSelection}
        onSplitCard={handleSplitCard}
        otherKanbans={otherKanbans.filter(k => k.id !== kanban.id)}
        onMoveOrCopyCard={handleMoveOrCopyCard}
        onUploadAttachment={handleUploadAttachment}
        onDeleteAttachment={handleDeleteAttachment}
        onUploadCommentImage={handleUploadCommentImage}
        assignmentDefinitions={kanban.assignmentDefinitions}
        showAssignmentsOnCard={kanban.showAssignmentsOnCard}
        members={boardMembers}
        onViewCardHistory={kanban.showHistory ? (cardId) => { setHistoryCardFilter(cardId); setHistoryOpen(true); } : undefined}
        showCountdownTimers={kanban.showCountdownTimers}
      />

      {selectMode && selectedCardIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a2e', borderRadius: 12, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 1000,
        }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {selectedCardIds.size} selected
          </span>
          <Select
            size="small"
            placeholder="Change status to…"
            style={{ width: 160 }}
            options={kanban.columns.map(c => ({ value: c.id, label: c.label }))}
            onChange={handleBulkStatusChange}
            value={undefined}
          />
          <Button
            size="small"
            disabled={selectedCardIds.size < 2}
            onClick={() => { setMergeSurvivorId(null); setMergeOpen(true); }}
          >
            Merge…
          </Button>
          <Button size="small" type="text" style={{ color: '#aaa' }} onClick={() => setSelectedCardIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <Modal
        title="Merge cards"
        open={mergeOpen}
        onCancel={() => { setMergeOpen(false); setMergeSurvivorId(null); }}
        onOk={handleMergeConfirm}
        okText="Merge"
        okButtonProps={{ disabled: !mergeSurvivorId }}
      >
        <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
          Pick which card should survive. Its notes, comments, and attachments will be combined with the others, and the rest will be deleted.
        </p>
        <Radio.Group
          value={mergeSurvivorId}
          onChange={e => setMergeSurvivorId(e.target.value)}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {kanban.cards.filter(c => selectedCardIds.has(c.id)).map(c => (
            <Radio key={c.id} value={c.id}>{c.title}</Radio>
          ))}
        </Radio.Group>
      </Modal>

      {!isViewer && (
        <AddCardModal
          columns={kanban.columns}
          onAdd={addCard}
          onImport={cards => {
            const before = kanban.cards.length;
            setKanban({ ...kanban, cards });
            if (user) {
              logKanbanEvent({
                kanbanId: kanban.id, cardId: null, cardTitle: null, type: 'import.csvReplace',
                actorUid: user.uid, actorEmail: user.email,
                detail: { addedCount: cards.length, removedCount: before, totalAfter: cards.length },
              });
            }
          }}
          showStoryPoints={kanban.showStoryPoints}
        />
      )}

      {isOwner && (
        <KanbanSettings
          open={settingsOpen}
          kanban={kanban}
          onClose={() => setSettingsOpen(false)}
          onChange={setKanban}
          onDelete={handleDeleteKanban}
          onExportCSV={() => exportKanbanCSV(kanban)}
          onPrintReport={() => window.open(`/simple-kanban/workspace-report?kanbanId=${kanban.id}`, '_blank')}
          onDuplicate={handleDuplicateKanban}
          folderLogoUrl={folderLogoUrl}
          accountAttachmentsBytes={accountAttachmentsBytes}
        />
      )}

      <CardFilterModal
        open={filterOpen}
        cards={kanban.cards}
        assignmentDefinitions={kanban.assignmentDefinitions}
        memberDisplayNameByUid={memberDisplayNameByUid}
        activeFilter={cardFilter}
        onFilterChange={setCardFilter}
        onClose={() => setFilterOpen(false)}
      />

      {accessOpen && user && (
        <AccessModal
          kanban={kanban}
          currentUid={user.uid}
          currentEmail={user.email ?? ''}
          onClose={() => setAccessOpen(false)}
          onChange={setKanban}
        />
      )}
    </div>
  );
}
