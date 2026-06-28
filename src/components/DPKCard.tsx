import { useRef, useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HolderOutlined, CloseOutlined } from '@ant-design/icons';
import type { DPKCard as DPKCardType } from '../types';

interface Props {
  card: DPKCardType;
  columnColor: string;
  onDelete: (id: string) => void;
  isOverlay?: boolean;
}

const LONG_PRESS_DELAY = 380; // ms — fires before dnd-kit's TouchSensor (600ms)

export function DPKCard({ card, columnColor, onDelete, isOverlay = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const [hovered, setHovered] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);

  // Merge dnd-kit's ref with our own so we can attach native listeners
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    nodeRef.current = node;
  }, [setNodeRef]);

  useEffect(() => {
    const el = nodeRef.current;
    if (!el || isOverlay) return;

    function onDown() {
      longPressTimer.current = setTimeout(() => setPreviewOpen(true), LONG_PRESS_DELAY);
    }

    function onUp() {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      setPreviewOpen(false);
    }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onUp);
    el.addEventListener('pointercancel', onUp);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onUp);
      el.removeEventListener('pointercancel', onUp);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, [isOverlay]);

  const transformStr = isOverlay
    ? `${CSS.Transform.toString(transform)} scale(1.04)`
    : (CSS.Transform.toString(transform) ?? undefined);

  const baseTransition = isDragging ? undefined : transition;
  const shadowTransition = `box-shadow 0.15s ease, opacity 0.15s ease`;

  const style: CSSProperties = {
    transform: transformStr,
    transition: baseTransition ? `${baseTransition}, ${shadowTransition}` : shadowTransition,
    background: `linear-gradient(160deg, ${columnColor}EE 0%, ${columnColor} 100%)`,
    color: '#FFFFFF',
    borderRadius: 9,
    minHeight: 76,
    padding: '14px 36px 14px 38px',
    fontSize: 'clamp(13px, 1.3vw, 19px)',
    fontWeight: 700,
    letterSpacing: '0.02em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    cursor: isOverlay ? 'grabbing' : 'grab',
    userSelect: 'none',
    touchAction: 'none',
    boxShadow: isOverlay
      ? '0 10px 28px rgba(0,0,0,0.28)'
      : hovered && !isDragging
        ? '0 5px 16px rgba(0,0,0,0.22)'
        : '0 1px 3px rgba(0,0,0,0.14)',
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <>
      <div
        ref={combinedRef}
        style={style}
        {...attributes}
        {...listeners}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <HolderOutlined
          style={{
            position: 'absolute',
            left: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            opacity: hovered && !isDragging ? 0.65 : 0.3,
            fontSize: 'clamp(12px, 1.1vw, 15px)',
            color: '#fff',
            pointerEvents: 'none',
            transition: 'opacity 0.15s ease',
          }}
        />

        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          display: 'block',
          textAlign: 'center',
        }}>
          {card.dpkNumber}
        </span>

        {/* Delete button — explicit click, never triggers drag */}
        {!isOverlay && (
          <div
            onPointerDown={e => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
            onClick={e => { e.stopPropagation(); onDelete(card.id); }}
            style={{
              position: 'absolute',
              top: 6,
              right: 7,
              width: 22,
              height: 22,
              borderRadius: 5,
              background: 'rgba(0,0,0,0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s ease, background 0.1s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.5)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.28)'; }}
          >
            <CloseOutlined style={{ fontSize: 10, color: '#fff', pointerEvents: 'none' }} />
          </div>
        )}
      </div>

      {/* Hold-to-preview overlay — rendered in document.body to escape stacking contexts */}
      {previewOpen && !isOverlay && createPortal(
        <>
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 8998,
            pointerEvents: 'none',
            animation: 'dpk-backdrop-in 0.15s ease forwards',
          }} />
          <div style={{
            position: 'fixed',
            top: '15%',
            left: '50%',
            zIndex: 8999,
            background: '#fff',
            borderLeft: `6px solid ${columnColor}`,
            borderRadius: 12,
            padding: '18px 28px',
            minWidth: 260,
            maxWidth: '60vw',
            fontSize: 'clamp(16px, 1.8vw, 28px)',
            fontWeight: 700,
            color: '#1a1a2e',
            lineHeight: 1.35,
            wordBreak: 'break-word',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            pointerEvents: 'none',
            animation: 'dpk-preview-in 0.18s ease forwards',
          }}>
            <div style={{
              fontSize: 'clamp(9px, 0.85vw, 12px)',
              color: columnColor,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 8,
            }}>
              DPK Number
            </div>
            {card.dpkNumber}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
