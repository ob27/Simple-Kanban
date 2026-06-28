import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ColumnConfig, DPKCard } from '../types';
import { DPKCard as DPKCardComponent } from './DPKCard';

interface Props {
  config: ColumnConfig;
  cards: DPKCard[];
  onDeleteCard: (id: string) => void;
}

export function KanbanColumn({ config, cards, onDeleteCard }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: config.id });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#FFFFFF',
        boxShadow: isOver
          ? `0 0 0 2px ${config.color}, 0 4px 16px rgba(0,0,0,0.12)`
          : '0 1px 4px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* Colored header — fixed height so all columns align */}
      <div
        style={{
          background: config.color,
          color: '#FFFFFF',
          padding: '10px 14px',
          height: 72,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{
          fontWeight: 700,
          fontSize: 'clamp(11px, 1.05vw, 17px)',
          textAlign: 'center',
          lineHeight: 1.25,
        }}>
          {config.label}
        </span>
      </div>

      {/* Thin accent line */}
      <div style={{ height: 2, background: config.color, opacity: 0.25, flexShrink: 0 }} />

      {/* Cards area */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: isOver ? '#F2F7FF' : '#F8F9FB',
          transition: 'background 0.15s ease',
        }}
      >
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <DPKCardComponent
              key={card.id}
              card={card}
              columnColor={config.color}
              onDelete={onDeleteCard}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div style={{
            flex: 1,
            minHeight: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{
              color: '#C0C4CC',
              fontSize: 'clamp(11px, 0.9vw, 13px)',
              userSelect: 'none',
              fontStyle: 'italic',
            }}>
              Drop cards here
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
