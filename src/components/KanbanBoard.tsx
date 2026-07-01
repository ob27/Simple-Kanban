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
import type { KanbanCard, ColumnConfig, CardComment } from '../types';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard as KanbanCardComponent } from './KanbanCard';
import { CardNotesModal } from './CardNotesModal';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useAuth } from '../AuthContext';

interface Props {
  cards: KanbanCard[];
  columns: ColumnConfig[];
  onCardsChange: (cards: KanbanCard[]) => void;
  onDeleteCard: (cardId: string) => void;
  cardFontSize?: number;
  isOwner?: boolean;
  isViewer?: boolean;
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

export function KanbanBoard({ cards, columns, onCardsChange, onDeleteCard, cardFontSize, isOwner, isViewer }: Props) {
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [notesCardId, setNotesCardId] = useState<string | null>(null);
  const { isMobile, isTablet } = useBreakpoint();
  const { user } = useAuth();

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

      const moved: KanbanCard = { ...dragged, columnId: targetColumnId };
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

      if (movingRight) {
        message.success({ content: getRandomAffirmation(), duration: 3, style: { fontSize: 'clamp(14px, 1.4vw, 19px)', fontWeight: 600 } });
        if (targetColumnId === lastColumnId) {
          launchFireworks();
        } else {
          burstConfetti(columns.map(c => c.color));
        }
      }
    }
  }

  function handleSaveCard(cardId: string, updates: { title?: string; pillValue?: string; notes?: string }) {
    onCardsChange(cards.map(c => c.id === cardId ? { ...c, ...updates } : c));
  }

  function handleAddComment(cardId: string, text: string) {
    const email = user?.email ?? 'unknown';
    const uid = user?.uid ?? 'unknown';
    const comment: CardComment = {
      id: crypto.randomUUID(),
      uid,
      email,
      text,
      createdAt: Date.now(),
    };
    onCardsChange(cards.map(c =>
      c.id === cardId
        ? { ...c, comments: [...(c.comments ?? []), comment] }
        : c
    ));
  }

  function handleEditComment(cardId: string, commentId: string, text: string) {
    onCardsChange(cards.map(c =>
      c.id === cardId
        ? { ...c, comments: (c.comments ?? []).map(cm => cm.id === commentId ? { ...cm, text } : cm) }
        : c
    ));
  }

  function handleDeleteComment(cardId: string, commentId: string) {
    onCardsChange(cards.map(c =>
      c.id === cardId
        ? { ...c, comments: (c.comments ?? []).filter(cm => cm.id !== commentId) }
        : c
    ));
  }

  const notesCard = notesCardId ? cards.find(c => c.id === notesCardId) : null;
  const colMinWidth = isMobile ? 200 : isTablet ? 220 : undefined;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: 12, flex: 1, overflow: 'auto', height: '100%' }}>
          {columns.map(col => (
            <KanbanColumn
              key={col.id}
              config={col}
              cards={cards.filter(c => c.columnId === col.id)}
              onDeleteCard={onDeleteCard}
              onOpenNotes={setNotesCardId}
              minWidth={colMinWidth}
              cardFontSize={cardFontSize}
              isViewer={isViewer}
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
          onSaveCard={handleSaveCard}
          onAddComment={handleAddComment}
          onEditComment={handleEditComment}
          onDeleteComment={handleDeleteComment}
        />
      )}
    </>
  );
}
