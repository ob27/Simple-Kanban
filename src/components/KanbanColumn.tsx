import { useState } from 'react';
import { Modal } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ColumnConfig, KanbanCard, AssignmentDefinition } from '../types';
import { KanbanCard as KanbanCardComponent } from './KanbanCard';

interface Props {
  config: ColumnConfig;
  cards: KanbanCard[];
  onDeleteCard: (id: string) => void;
  onOpenNotes?: (cardId: string) => void;
  minWidth?: number;
  cardFontSize?: number;
  wrapCardText?: boolean;
  isViewer?: boolean;
  maxCards?: number;
  showStoryPoints?: boolean;
  staleAfterDays?: number;
  selectMode?: boolean;
  selectedCardIds?: Set<string>;
  onToggleSelect?: (cardId: string) => void;
  assignmentDefinitions?: AssignmentDefinition[];
  showAssignmentsOnCard?: boolean;
  memberEmailByUid?: Record<string, string>;
  memberDisplayNameByUid?: Record<string, string>;
  showCountdownTimers?: boolean;
}

export function KanbanColumn({
  config, cards, onDeleteCard, onOpenNotes, minWidth, cardFontSize, wrapCardText, isViewer, maxCards,
  showStoryPoints, staleAfterDays, selectMode, selectedCardIds, onToggleSelect,
  assignmentDefinitions, showAssignmentsOnCard, memberEmailByUid, memberDisplayNameByUid,
  showCountdownTimers,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: config.id });
  const visibleCards = maxCards ? cards.slice(0, maxCards) : cards;
  const hiddenCount = cards.length - visibleCards.length;
  const [descOpen, setDescOpen] = useState(false);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      minWidth: minWidth ?? 0,
      borderRadius: 12, overflow: 'hidden', background: '#FFFFFF',
      boxShadow: isOver
        ? `0 0 0 2px ${config.color}, 0 4px 16px rgba(0,0,0,0.12)`
        : '0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s ease',
    }}>
      <div style={{
        background: config.color, color: '#FFFFFF', padding: '10px 14px',
        height: 72, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{ fontWeight: 700, fontSize: 'clamp(11px, 1.05vw, 17px)', textAlign: 'center', lineHeight: 1.25 }}>
          {config.label}
        </span>
        {config.description && (
          <button
            onClick={() => setDescOpen(true)}
            title="Column description"
            style={{
              position: 'absolute', top: 7, right: 8,
              background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: '50%',
              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0, color: '#fff', flexShrink: 0,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.45)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
          >
            <InfoCircleOutlined style={{ fontSize: 12, pointerEvents: 'none' }} />
          </button>
        )}
      </div>

      <div style={{ height: 2, background: config.color, opacity: 0.25, flexShrink: 0 }} />

      <div ref={setNodeRef} className="scrollbar-hidden" style={{
        flex: 1, overflowY: 'auto', padding: 10,
        display: 'flex', flexDirection: 'column', gap: 8,
        background: isOver ? '#F2F7FF' : '#F8F9FB',
        transition: 'background 0.15s ease',
      }}>
        <SortableContext items={visibleCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {visibleCards.map(card => (
            <KanbanCardComponent
              key={card.id}
              card={card}
              columnColor={config.color}
              onDelete={onDeleteCard}
              onOpenNotes={onOpenNotes ? () => onOpenNotes(card.id) : undefined}
              cardFontSize={cardFontSize}
              wrapCardText={wrapCardText}
              isViewer={isViewer}
              showStoryPoints={showStoryPoints}
              staleAfterDays={staleAfterDays}
              selectMode={selectMode}
              selected={selectedCardIds?.has(card.id)}
              onToggleSelect={onToggleSelect ? () => onToggleSelect(card.id) : undefined}
              assignmentDefinitions={assignmentDefinitions}
              showAssignmentsOnCard={showAssignmentsOnCard}
              memberEmailByUid={memberEmailByUid}
              memberDisplayNameByUid={memberDisplayNameByUid}
              showCountdownTimers={showCountdownTimers}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div style={{ flex: 1, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#C0C4CC', fontSize: 'clamp(11px, 0.9vw, 13px)', userSelect: 'none', fontStyle: 'italic' }}>
              {isViewer ? '' : 'Drop cards here'}
            </span>
          </div>
        )}
      </div>

      {hiddenCount > 0 && (
        <div style={{
          textAlign: 'center', padding: '7px 0',
          fontSize: 12, fontWeight: 600,
          color: config.color, opacity: 0.75,
          borderTop: `1px solid ${config.color}22`,
          background: '#fff',
          flexShrink: 0,
        }}>
          +{hiddenCount} more card{hiddenCount !== 1 ? 's' : ''} not shown
        </div>
      )}

      {config.description && (
        <Modal
          title={config.label}
          open={descOpen}
          onCancel={() => setDescOpen(false)}
          footer={null}
          width={400}
        >
          <div style={{ fontSize: 14, color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap', paddingTop: 4 }}>
            {config.description}
          </div>
        </Modal>
      )}
    </div>
  );
}
