import { useState } from 'react';
import confetti from 'canvas-confetti';
import { message } from 'antd';
import { getRandomAffirmation } from '../utils/affirmations';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCorners,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import type { KanbanCard, ColumnConfig, CardComment, Kanban, CardAttachment, AssignmentDefinition, CardAssignmentValue, CardChecklistInstanceRef, CardTemplateChecklistLink } from '../types';
import type { KanbanMember } from '../utils/kanbanMembers';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard as KanbanCardComponent } from './KanbanCard';
import { CardNotesModal } from './CardNotesModal';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useAuth } from '../AuthContext';
import { deleteCommentImageFile } from '../utils/cardAttachments';
import { createChecklistInstanceForCard } from '../utils/checklistIntegration';

interface Props {
  kanban: Kanban;
  cards: KanbanCard[];
  columns: ColumnConfig[];
  onCardsChange: (cards: KanbanCard[], attachmentsBytesDelta?: number) => void;
  onDeleteCard: (cardId: string) => void;
  cardFontSize?: number;
  wrapCardText?: boolean;
  isOwner?: boolean;
  isViewer?: boolean;
  showStoryPoints?: boolean;
  staleAfterDays?: number;
  accoladesEnabled?: boolean;
  selectMode?: boolean;
  selectedCardIds?: Set<string>;
  onToggleSelect?: (cardId: string) => void;
  onSplitCard?: (cardId: string, titles: string[]) => void;
  otherKanbans?: Kanban[];
  onMoveOrCopyCard?: (card: KanbanCard, targetKanbanId: string, mode: 'move' | 'copy') => void;
  onUploadAttachment?: (cardId: string, file: File) => void;
  onDeleteAttachment?: (cardId: string, attachment: CardAttachment) => void;
  onUploadCommentImage?: (cardId: string, file: File) => Promise<{ url: string; path: string; size: number } | null>;
  assignmentDefinitions?: AssignmentDefinition[];
  showAssignmentsOnCard?: boolean;
  members?: KanbanMember[];
}

function burstConfetti(colors: string[]) {
  confetti({ particleCount: 120, startVelocity: 38, spread: 360, origin: { x: 0.5, y: 0.38 }, colors, ticks: 150, gravity: 0.55, scalar: 1.15, zIndex: 9999 });
  setTimeout(() => confetti({ particleCount: 70, angle: 60, spread: 65, origin: { x: 0, y: 0.65 }, colors, startVelocity: 52, zIndex: 9999 }), 100);
  setTimeout(() => confetti({ particleCount: 70, angle: 120, spread: 65, origin: { x: 1, y: 0.65 }, colors, startVelocity: 52, zIndex: 9999 }), 200);
  setTimeout(() => confetti({ particleCount: 90, startVelocity: 32, spread: 360, origin: { x: 0.5, y: 0.32 }, colors, ticks: 130, gravity: 0.5, scalar: 1.1, zIndex: 9999 }), 380);
}

function launchFireworks() {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#22C55E', '#F97316', '#FFFFFF'];
  function explode(x: number, y: number, delay: number, count = 80, velocity = 35) {
    setTimeout(() => confetti({ particleCount: count, startVelocity: velocity, spread: 360, origin: { x, y }, colors, ticks: 160, gravity: 0.55, scalar: 1.25, zIndex: 9999 }), delay);
  }
  explode(0.2, 0.35, 0); explode(0.8, 0.35, 60); explode(0.5, 0.2, 130, 110, 40);
  explode(0.35, 0.42, 480, 70); explode(0.65, 0.42, 550, 70); explode(0.5, 0.28, 650, 100, 38);
  explode(0.15, 0.38, 1150, 60); explode(0.85, 0.38, 1230, 60); explode(0.5, 0.2, 1350, 140, 42);
  explode(0.3, 0.3, 1500, 70); explode(0.7, 0.3, 1560, 70);
}

export function KanbanBoard({
  kanban, cards, columns, onCardsChange, onDeleteCard, cardFontSize, wrapCardText, isOwner, isViewer,
  showStoryPoints, staleAfterDays, accoladesEnabled = true, selectMode, selectedCardIds, onToggleSelect,
  onSplitCard, otherKanbans, onMoveOrCopyCard, onUploadAttachment, onDeleteAttachment, onUploadCommentImage,
  assignmentDefinitions, showAssignmentsOnCard, members,
}: Props) {
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [notesCardId, setNotesCardId] = useState<string | null>(null);
  const [creatingChecklistLinkId, setCreatingChecklistLinkId] = useState<string | null>(null);
  const { isMobile, isTablet } = useBreakpoint();
  const { user } = useAuth();
  const memberEmailByUid = Object.fromEntries((members ?? []).map(m => [m.uid, m.email]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: isViewer ? 999999 : 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: isViewer ? 999999 : 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columnIds = columns.map(c => c.id);
  const colorMap = Object.fromEntries(columns.map(c => [c.id, c.color]));
  const lastColumnId = columns[columns.length - 1]?.id;

  function handleDragStart(event: DragStartEvent) {
    if (isViewer) return;
    setActiveCard(cards.find(c => c.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    if (isViewer) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const dragged = cards.find(c => c.id === activeId);
    if (!dragged) return;

    const isOverColumn = columnIds.includes(overId);
    const targetColumnId = isOverColumn
      ? overId
      : (cards.find(c => c.id === overId)?.columnId ?? dragged.columnId);

    if (dragged.columnId === targetColumnId) {
      if (isOverColumn) return;
      const colCards = cards.filter(c => c.columnId === targetColumnId);
      const oldIdx = colCards.findIndex(c => c.id === activeId);
      const newIdx = colCards.findIndex(c => c.id === overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const reordered = arrayMove(colCards, oldIdx, newIdx);
      let j = 0;
      onCardsChange(cards.map(c => c.columnId === targetColumnId ? reordered[j++] : c));
    } else {
      const sourceIdx = columnIds.indexOf(dragged.columnId);
      const targetIdx = columnIds.indexOf(targetColumnId);
      const movingRight = targetIdx > sourceIdx;

      const moved: KanbanCard = { ...dragged, columnId: targetColumnId, movedAt: Date.now() };
      const without = cards.filter(c => c.id !== activeId);
      let newCards: KanbanCard[];
      if (isOverColumn) {
        newCards = [...without, moved];
      } else {
        const overIdx = without.findIndex(c => c.id === overId);
        newCards = [...without];
        newCards.splice(overIdx + 1, 0, moved);
      }
      onCardsChange(newCards);

      if (movingRight && accoladesEnabled) {
        message.success({ content: getRandomAffirmation(), duration: 3, style: { fontSize: 'clamp(14px, 1.4vw, 19px)', fontWeight: 600 } });
        if (targetColumnId === lastColumnId) {
          launchFireworks();
        } else {
          burstConfetti(columns.map(c => c.color));
        }
      }

      // Simple Checklists integration: fire any onColumnEntry link matching
      // this target column, skipping links that already have an instance
      // for this card (so re-entering the same column twice never
      // duplicates it).
      const columnEntryLinks = (kanban.cardTemplateChecklistLinks ?? []).filter(l =>
        l.trigger.kind === 'onColumnEntry' && l.trigger.columnId === targetColumnId
        && !(moved.checklistInstanceRefs ?? []).some(r => r.linkId === l.id)
      );
      if (columnEntryLinks.length > 0 && user) {
        (async () => {
          const refs: CardChecklistInstanceRef[] = [];
          for (const link of columnEntryLinks) {
            try {
              const instanceId = await createChecklistInstanceForCard(kanban, moved, link, user.uid, user.email ?? undefined);
              refs.push({ linkId: link.id, templateId: link.templateId, instanceId });
            } catch { /* template since archived/deleted — skip */ }
          }
          if (refs.length > 0) {
            onCardsChange(newCards.map(c => c.id === moved.id ? { ...c, checklistInstanceRefs: [...(c.checklistInstanceRefs ?? []), ...refs] } : c));
          }
        })();
      }
    }
  }

  function handleSaveCard(cardId: string, updates: { title?: string; pillValue?: string; notes?: string; storyPoints?: number | null }) {
    onCardsChange(cards.map(c => {
      if (c.id !== cardId) return c;
      const { storyPoints, ...rest } = updates;
      const next: KanbanCard = { ...c, ...rest };
      if (storyPoints !== undefined) next.storyPoints = storyPoints === null ? undefined : storyPoints;
      return next;
    }));
  }

  function handleAddComment(cardId: string, text: string, image?: { url: string; path: string; size: number }) {
    const email = user?.email ?? 'unknown';
    const uid = user?.uid ?? 'unknown';
    const comment: CardComment = {
      id: crypto.randomUUID(),
      uid,
      email,
      text,
      createdAt: Date.now(),
      imageUrl: image?.url,
      imagePath: image?.path,
      imageSize: image?.size,
    };
    onCardsChange(cards.map(c =>
      c.id === cardId
        ? { ...c, comments: [...(c.comments ?? []), comment] }
        : c
    ), image?.size ?? 0);
  }

  function handleToggleReaction(cardId: string, commentId: string, emoji: string) {
    const uid = user?.uid ?? 'unknown';
    onCardsChange(cards.map(c => {
      if (c.id !== cardId) return c;
      return {
        ...c,
        comments: (c.comments ?? []).map(cm => {
          if (cm.id !== commentId) return cm;
          const current = cm.reactions?.[emoji] ?? [];
          const has = current.includes(uid);
          const nextUsers = has ? current.filter(u => u !== uid) : [...current, uid];
          const nextReactions = { ...(cm.reactions ?? {}) };
          if (nextUsers.length > 0) nextReactions[emoji] = nextUsers;
          else delete nextReactions[emoji];
          return { ...cm, reactions: Object.keys(nextReactions).length ? nextReactions : undefined };
        }),
      };
    }));
  }

  function handleEditComment(cardId: string, commentId: string, text: string) {
    onCardsChange(cards.map(c =>
      c.id === cardId
        ? { ...c, comments: (c.comments ?? []).map(cm => cm.id === commentId ? { ...cm, text } : cm) }
        : c
    ));
  }

  function handleDeleteComment(cardId: string, commentId: string) {
    const card = cards.find(c => c.id === cardId);
    const comment = card?.comments?.find(cm => cm.id === commentId);
    if (comment?.imagePath) {
      deleteCommentImageFile(comment.imagePath);
    }
    onCardsChange(cards.map(c =>
      c.id === cardId
        ? { ...c, comments: (c.comments ?? []).filter(cm => cm.id !== commentId) }
        : c
    ), comment?.imageSize ? -comment.imageSize : 0);
  }

  function handleSaveCardAssignment(cardId: string, definitionId: string, value: CardAssignmentValue | null) {
    onCardsChange(cards.map(c => {
      if (c.id !== cardId) return c;
      const next = { ...(c.cardAssignments ?? {}) };
      if (value) next[definitionId] = value; else delete next[definitionId];
      return { ...c, cardAssignments: Object.keys(next).length ? next : undefined };
    }));
  }

  async function handleCreateChecklistOnDemand(link: CardTemplateChecklistLink) {
    if (!notesCard || !user) return;
    setCreatingChecklistLinkId(link.id);
    try {
      const instanceId = await createChecklistInstanceForCard(kanban, notesCard, link, user.uid, user.email ?? undefined);
      onCardsChange(cards.map(c => c.id === notesCard.id
        ? { ...c, checklistInstanceRefs: [...(c.checklistInstanceRefs ?? []), { linkId: link.id, templateId: link.templateId, instanceId }] }
        : c));
    } catch {
      message.error('Failed to create checklist — the template may have been removed.');
    } finally {
      setCreatingChecklistLinkId(null);
    }
  }

  const notesCard = notesCardId ? cards.find(c => c.id === notesCardId) : null;
  const colMinWidth = isMobile ? 200 : isTablet ? 220 : undefined;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="scrollbar-hidden" style={{ display: 'flex', gap: 12, flex: 1, overflow: 'auto', height: '100%' }}>
          {columns.map(col => (
            <KanbanColumn
              key={col.id}
              config={col}
              cards={cards.filter(c => c.columnId === col.id)}
              onDeleteCard={onDeleteCard}
              onOpenNotes={setNotesCardId}
              minWidth={colMinWidth}
              cardFontSize={cardFontSize}
              wrapCardText={wrapCardText}
              isViewer={isViewer}
              maxCards={col.maxCards}
              showStoryPoints={showStoryPoints}
              staleAfterDays={staleAfterDays}
              selectMode={selectMode}
              selectedCardIds={selectedCardIds}
              onToggleSelect={onToggleSelect}
              assignmentDefinitions={assignmentDefinitions}
              showAssignmentsOnCard={showAssignmentsOnCard}
              memberEmailByUid={memberEmailByUid}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeCard && (
            <KanbanCardComponent
              card={activeCard}
              columnColor={colorMap[activeCard.columnId] ?? '#888'}
              onDelete={() => {}}
              isOverlay
              cardFontSize={cardFontSize}
              wrapCardText={wrapCardText}
            />
          )}
        </DragOverlay>
      </DndContext>

      {notesCard && user?.email && (
        <CardNotesModal
          card={notesCard}
          columnColor={colorMap[notesCard.columnId] ?? '#888'}
          currentUser={{ uid: user.uid, email: user.email }}
          onClose={() => setNotesCardId(null)}
          canDeleteAnyComment={!!isOwner}
          readOnly={!!isViewer}
          showStoryPoints={showStoryPoints}
          onSaveCard={handleSaveCard}
          onAddComment={handleAddComment}
          onEditComment={handleEditComment}
          onDeleteComment={handleDeleteComment}
          onSplitCard={onSplitCard ? titles => { onSplitCard(notesCard.id, titles); setNotesCardId(null); } : undefined}
          otherKanbans={otherKanbans}
          onMoveOrCopy={onMoveOrCopyCard ? (targetId, mode) => { onMoveOrCopyCard(notesCard, targetId, mode); setNotesCardId(null); } : undefined}
          onUploadAttachment={onUploadAttachment ? file => onUploadAttachment(notesCard.id, file) : undefined}
          onDeleteAttachment={onDeleteAttachment ? attachment => onDeleteAttachment(notesCard.id, attachment) : undefined}
          onUploadCommentImage={onUploadCommentImage ? file => onUploadCommentImage(notesCard.id, file) : undefined}
          onToggleReaction={(commentId, emoji) => handleToggleReaction(notesCard.id, commentId, emoji)}
          assignmentDefinitions={assignmentDefinitions}
          members={members}
          onSaveCardAssignment={handleSaveCardAssignment}
          checklistLinks={kanban.cardTemplateChecklistLinks}
          onCreateChecklistOnDemand={handleCreateChecklistOnDemand}
          creatingChecklistLinkId={creatingChecklistLinkId}
        />
      )}
    </>
  );
}
