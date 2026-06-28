import { useState } from 'react';
import confetti from 'canvas-confetti';
import { message } from 'antd';
import { getRandomAffirmation } from '../utils/affirmations';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import type { DPKCard, ColumnId } from '../types';
import { COLUMNS, COLUMN_MAP } from '../constants';
import { KanbanColumn } from './KanbanColumn';
import { DPKCard as DPKCardComponent } from './DPKCard';

interface Props {
  cards: DPKCard[];
  onCardsChange: (cards: DPKCard[]) => void;
  onDeleteCard: (cardId: string) => void;
}

const COLUMN_COLORS = COLUMNS.map(c => c.color);

function burstConfetti() {
  const colors = COLUMN_COLORS;

  // Central radial explosion
  confetti({
    particleCount: 120,
    startVelocity: 38,
    spread: 360,
    origin: { x: 0.5, y: 0.38 },
    colors,
    ticks: 150,
    gravity: 0.55,
    scalar: 1.15,
    zIndex: 9999,
  });

  // Left cannon
  setTimeout(() => {
    confetti({
      particleCount: 70,
      angle: 60,
      spread: 65,
      origin: { x: 0, y: 0.65 },
      colors,
      startVelocity: 52,
      zIndex: 9999,
    });
  }, 100);

  // Right cannon
  setTimeout(() => {
    confetti({
      particleCount: 70,
      angle: 120,
      spread: 65,
      origin: { x: 1, y: 0.65 },
      colors,
      startVelocity: 52,
      zIndex: 9999,
    });
  }, 200);

  // Follow-up center burst
  setTimeout(() => {
    confetti({
      particleCount: 90,
      startVelocity: 32,
      spread: 360,
      origin: { x: 0.5, y: 0.32 },
      colors,
      ticks: 130,
      gravity: 0.5,
      scalar: 1.1,
      zIndex: 9999,
    });
  }, 380);
}

function launchFireworks() {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#22C55E', '#F97316', '#FFFFFF'];

  // spread:360 + startVelocity:30-40 = particles radiate outward from the origin point
  function explode(x: number, y: number, delay: number, count = 80, velocity = 35) {
    setTimeout(() => {
      confetti({
        particleCount: count,
        startVelocity: velocity,
        spread: 360,
        origin: { x, y },
        colors,
        ticks: 160,
        gravity: 0.55,
        scalar: 1.25,
        zIndex: 9999,
      });
    }, delay);
  }

  // Wave 1 — three simultaneous bursts across the screen
  explode(0.2,  0.35, 0);
  explode(0.8,  0.35, 60);
  explode(0.5,  0.2,  130, 110, 40);

  // Wave 2
  explode(0.35, 0.42, 480, 70);
  explode(0.65, 0.42, 550, 70);
  explode(0.5,  0.28, 650, 100, 38);

  // Wave 3 — finale
  explode(0.15, 0.38, 1150, 60);
  explode(0.85, 0.38, 1230, 60);
  explode(0.5,  0.2,  1350, 140, 42);
  explode(0.3,  0.3,  1500, 70);
  explode(0.7,  0.3,  1560, 70);
}

export function KanbanBoard({ cards, onCardsChange, onDeleteCard }: Props) {
  const [activeCard, setActiveCard] = useState<DPKCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    const card = cards.find(c => c.id === event.active.id);
    setActiveCard(card ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCard = cards.find(c => c.id === activeId);
    if (!activeCard) return;

    const isOverColumn = COLUMNS.some(c => c.id === overId);
    const targetColumnId: ColumnId = isOverColumn
      ? (overId as ColumnId)
      : (cards.find(c => c.id === overId)?.columnId ?? activeCard.columnId);

    if (activeCard.columnId === targetColumnId) {
      if (isOverColumn) return; // dropped on own column header, no change
      // Same-column reorder
      const colCards = cards.filter(c => c.columnId === targetColumnId);
      const oldIdx = colCards.findIndex(c => c.id === activeId);
      const newIdx = colCards.findIndex(c => c.id === overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const reorderedCol = arrayMove(colCards, oldIdx, newIdx);
      let j = 0;
      const result = cards.map(c =>
        c.columnId === targetColumnId ? reorderedCol[j++] : c
      );
      onCardsChange(result);
    } else {
      // Cross-column move
      const sourceIdx = COLUMNS.findIndex(c => c.id === activeCard.columnId);
      const targetIdx = COLUMNS.findIndex(c => c.id === targetColumnId);
      const movingRight = targetIdx > sourceIdx;

      const movedCard: DPKCard = { ...activeCard, columnId: targetColumnId };
      const withoutMoved = cards.filter(c => c.id !== activeId);
      let newCards: DPKCard[];

      if (isOverColumn) {
        newCards = [...withoutMoved, movedCard];
      } else {
        const overIdx = withoutMoved.findIndex(c => c.id === overId);
        newCards = [...withoutMoved];
        newCards.splice(overIdx + 1, 0, movedCard);
      }

      onCardsChange(newCards);

      if (movingRight) {
        message.success({
          content: getRandomAffirmation(),
          duration: 3,
          style: { fontSize: 'clamp(14px, 1.4vw, 19px)', fontWeight: 600 },
        });

        if (targetColumnId === 'completions') {
          launchFireworks();
        } else {
          burstConfetti();
        }
      }
    }
  }

  const columnCards = (columnId: ColumnId) => cards.filter(c => c.columnId === columnId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', gap: 12, flex: 1, overflow: 'hidden', height: '100%' }}>
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            config={col}
            cards={columnCards(col.id)}
            onDeleteCard={onDeleteCard}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeCard && (
          <DPKCardComponent
            card={activeCard}
            columnColor={COLUMN_MAP[activeCard.columnId].color}
            onDelete={() => {}}
            isOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
