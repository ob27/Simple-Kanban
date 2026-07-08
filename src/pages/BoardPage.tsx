import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Popover, Spin, Switch, Badge, Modal, Radio, Select, message } from 'antd';
import { EditOutlined, ArrowLeftOutlined, SettingOutlined, FilterOutlined, CheckSquareOutlined } from '@ant-design/icons';
import type { KanbanCard, CardAttachment } from '../types';
import { saveKanban, deleteKanban, isKanbanOwner, loadUserKanbans, moveCardToKanban } from '../store';
import type { Kanban as KanbanType } from '../types';
import { uploadCardAttachment, deleteCardAttachment } from '../utils/cardAttachments';
import { MAX_ATTACHMENTS_BYTES, MAX_USER_ATTACHMENTS_BYTES, formatBytes } from '../constants';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { exportKanbanCSV } from '../utils/csvExport';
import { getWorkspaceSettings } from '../utils/logoUpload';
import { PillFilterModal } from '../components/PillFilterModal';
import { useAuth } from '../AuthContext';
import { ProgressBar } from '../components/ProgressBar';
import { ProjectLifeline } from '../components/ProjectLifeline';
import { KanbanBoard } from '../components/KanbanBoard';
import { AddCardModal } from '../components/AddCardModal';
import { KanbanSettings } from '../components/KanbanSettings';
import { useKanban } from '../hooks/useKanban';
import { useBreakpoint } from '../hooks/useBreakpoint';

export function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { kanban, setKanban, remoteVersion, loading, notFound } = useKanban(id!);

  const [editTotal, setEditTotal] = useState(false);
  const [editValue, setEditValue] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [folderLogoUrl, setFolderLogoUrl] = useState<string | null>(null);
  const [pillFilter, setPillFilter] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [folderAccoladesEnabled, setFolderAccoladesEnabled] = useState<boolean | undefined>(undefined);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSurvivorId, setMergeSurvivorId] = useState<string | null>(null);
  const [otherKanbans, setOtherKanbans] = useState<KanbanType[]>([]);

  const isOwner = kanban && user ? isKanbanOwner(kanban, user.uid) : false;
  const isViewer = kanban && user ? (kanban.viewerIds ?? []).includes(user.uid) : false;
  const { isMobile } = useBreakpoint();

  const totalCardCount = kanban ? kanban.cards.length : 0;
  const effectiveTotal = kanban
    ? (kanban.totalFromBacklog ? Math.max(totalCardCount, 1) : kanban.totalEstimated)
    : 1;

  const uniquePillValues = kanban
    ? [...new Set(kanban.cards.map(c => c.pillValue).filter((v): v is string => !!v))]
    : [];
  const filteredCards = kanban && pillFilter.size > 0
    ? kanban.cards.filter(c => c.pillValue && pillFilter.has(c.pillValue))
    : kanban?.cards ?? [];

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
      getWorkspaceSettings(kanban.ownerId).then(s => setLogoUrl(s.boardLogoUrl));
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

  if (notFound || !kanban) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#EEF0F5', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#666' }}>Kanban not found or you don't have access.</p>
      <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
    </div>
  );

  function addCard(card: Omit<KanbanCard, 'id' | 'order'>) {
    if (!kanban) return;
    const maxOrder = kanban.cards.reduce((m, c) => c.columnId === card.columnId ? Math.max(m, c.order) : m, -1);
    setKanban({ ...kanban, cards: [...kanban.cards, { ...card, id: crypto.randomUUID(), order: maxOrder + 1, movedAt: Date.now() }] });
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
    setKanban({
      ...kanban,
      cards: kanban.cards.map(c => selectedCardIds.has(c.id) ? { ...c, columnId, movedAt: Date.now() } : c),
    });
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
  }

  async function handleMoveOrCopyCard(card: KanbanCard, targetKanbanId: string, mode: 'move' | 'copy') {
    if (!kanban) return;
    try {
      await moveCardToKanban(kanban, targetKanbanId, card, mode);
      message.success(mode === 'move' ? 'Card moved' : 'Card copied');
    } catch {
      message.error(`Failed to ${mode} card`);
    }
  }

  async function handleUploadAttachment(cardId: string, file: File) {
    if (!kanban) return;
    try {
      await uploadCardAttachment(kanban, cardId, file, otherOwnedKanbansBytes);
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
      await deleteCardAttachment(kanban, cardId, attachment);
    } catch {
      message.error('Failed to delete attachment');
    }
  }

  function deleteCard(cardId: string) {
    if (!kanban) return;
    setKanban({ ...kanban, cards: kanban.cards.filter(c => c.id !== cardId) });
  }

  function handleCardsChange(newCards: KanbanCard[]) {
    if (!kanban) return;
    if (pillFilter.size === 0) {
      setKanban({ ...kanban, cards: newCards });
      return;
    }
    const visibleIds = new Set(newCards.map(c => c.id));
    const hidden = kanban.cards.filter(c => !visibleIds.has(c.id));
    setKanban({ ...kanban, cards: [...newCards, ...hidden] });
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
        return src ? (
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 2 }}>
            <img src={src} alt="logo" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
          </div>
        ) : null;
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
          totalEstimated={pillFilter.size > 0 ? filteredCards.length : effectiveTotal}
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
                  {pillFilter.size > 0
                    ? `${filteredCards.length} of ${kanban.cards.length} cards`
                    : `${kanban.cards.length} of ${effectiveTotal} cards`}
                </span>
                {!isViewer && <EditOutlined style={{ fontSize: 13, color: '#aaa', marginLeft: 2 }} />}
              </div>
              {!isOwner && kanban.ownerEmail && (
                <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>
                  Shared by {kanban.ownerEmail}
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
          {uniquePillValues.length > 0 && (
            <Badge count={pillFilter.size} size="small" offset={[-4, 4]}>
              <Button
                icon={<FilterOutlined />}
                size="small"
                type={pillFilter.size > 0 ? 'primary' : 'text'}
                onClick={() => setFilterOpen(true)}
                style={pillFilter.size === 0 ? { color: '#666' } : undefined}
              >
                {!isMobile && 'Filter'}
              </Button>
            </Badge>
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
        accoladesEnabled={kanban.accoladesEnabled ?? folderAccoladesEnabled ?? true}
        selectMode={selectMode}
        selectedCardIds={selectedCardIds}
        onToggleSelect={toggleCardSelection}
        onSplitCard={handleSplitCard}
        otherKanbans={otherKanbans.filter(k => k.id !== kanban.id)}
        onMoveOrCopyCard={handleMoveOrCopyCard}
        onUploadAttachment={handleUploadAttachment}
        onDeleteAttachment={handleDeleteAttachment}
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
          onImport={cards => setKanban({ ...kanban, cards })}
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
          folderLogoUrl={folderLogoUrl}
          accountAttachmentsBytes={accountAttachmentsBytes}
        />
      )}

      <PillFilterModal
        open={filterOpen}
        cards={kanban.cards}
        activeFilter={pillFilter}
        onFilterChange={setPillFilter}
        onClose={() => setFilterOpen(false)}
      />
    </div>
  );
}
