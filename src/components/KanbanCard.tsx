import { useRef, useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from 'antd';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HolderOutlined, CloseOutlined } from '@ant-design/icons';
import type { KanbanCard as KanbanCardType } from '../types';

interface Props {
  card: KanbanCardType;
  columnColor: string;
  onDelete: (id: string) => void;
  onOpenNotes?: () => void;
  cardFontSize?: number;
  wrapCardText?: boolean;
  isOverlay?: boolean;
  isViewer?: boolean;
}

const LONG_PRESS_DELAY = 380;
const DOUBLE_TAP_MS = 300;

export function KanbanCard({ card, columnColor, onDelete, onOpenNotes, cardFontSize, wrapCardText = false, isOverlay = false, isViewer = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

  const [hovered, setHovered] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pillTruncated, setPillTruncated] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTime = useRef(0);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = pillRef.current;
    if (el) setPillTruncated(el.scrollWidth > el.clientWidth);
  }, [card.pillValue]);

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
      // double-tap / double-click detection
      const now = Date.now();
      if (now - lastTapTime.current < DOUBLE_TAP_MS && lastTapTime.current > 0) {
        onOpenNotes?.();
        lastTapTime.current = 0;
      } else {
        lastTapTime.current = now;
      }
    }

    function onLeave() {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      setPreviewOpen(false);
    }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointercancel', onLeave);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointercancel', onLeave);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, [isOverlay, onOpenNotes]);

  const transformStr = isOverlay
    ? `${CSS.Transform.toString(transform)} scale(1.04)`
    : (CSS.Transform.toString(transform) ?? undefined);

  const style: CSSProperties = {
    transform: transformStr,
    transition: isDragging ? undefined : `${transition ?? ''}, box-shadow 0.15s ease, opacity 0.15s ease`,
    background: `linear-gradient(160deg, ${columnColor}EE 0%, ${columnColor} 100%)`,
    color: '#FFFFFF',
    borderRadius: 9,
    minHeight: 76,
    padding: card.pillValue ? '10px 36px 10px 38px' : '14px 36px 14px 38px',
    fontSize: cardFontSize ? `${cardFontSize}px` : 'clamp(13px, 1.3vw, 19px)',
    fontWeight: 700,
    letterSpacing: '0.02em',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    cursor: isOverlay ? 'grabbing' : isViewer ? 'default' : 'grab',
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
        <HolderOutlined style={{
          position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
          opacity: hovered && !isDragging ? 0.65 : 0.3,
          fontSize: 'clamp(12px, 1.1vw, 15px)', color: '#fff',
          pointerEvents: 'none', transition: 'opacity 0.15s ease',
        }} />

        <span style={{
          overflow: 'hidden',
          textOverflow: wrapCardText ? 'clip' : 'ellipsis',
          whiteSpace: wrapCardText ? 'normal' : 'nowrap',
          maxWidth: '100%',
          textAlign: 'center',
          wordBreak: wrapCardText ? 'break-word' : undefined,
          lineHeight: wrapCardText ? 1.35 : undefined,
        }}>
          {card.title}
        </span>

        {card.pillValue && (
          <Tooltip title={pillTruncated && !isOverlay ? card.pillValue : undefined} mouseEnterDelay={0.4}>
            <span ref={pillRef} style={{
              marginTop: 5,
              background: 'rgba(255,255,255,0.22)',
              borderRadius: 20,
              padding: '2px 10px',
              fontSize: 'clamp(10px, 0.9vw, 13px)',
              fontWeight: 500,
              letterSpacing: '0.01em',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {card.pillValue}
            </span>
          </Tooltip>
        )}

        {!isOverlay && !isViewer && (
          <div
            onPointerDown={e => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
            onClick={e => { e.stopPropagation(); onDelete(card.id); }}
            style={{
              position: 'absolute', top: 6, right: 7, width: 22, height: 22,
              borderRadius: 5, background: 'rgba(0,0,0,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s ease, background 0.1s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.5)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.28)'; }}
          >
            <CloseOutlined style={{ fontSize: 10, color: '#fff', pointerEvents: 'none' }} />
          </div>
        )}

        {/* Notes indicator dot */}
        {!isOverlay && (card.notes || (card.comments && card.comments.length > 0)) && (
          <div style={{
            position: 'absolute', bottom: 6, right: 7,
            width: 6, height: 6, borderRadius: '50%',
            background: 'rgba(255,255,255,0.6)',
          }} />
        )}
      </div>

      {previewOpen && !isOverlay && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 8998, pointerEvents: 'none' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 8999,
            background: '#fff', borderLeft: `6px solid ${columnColor}`, borderRadius: 12,
            padding: '18px 28px', minWidth: 260, maxWidth: '60vw',
            fontSize: 'clamp(16px, 1.8vw, 28px)', fontWeight: 700, color: '#1a1a2e',
            lineHeight: 1.35, wordBreak: 'break-word',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)', pointerEvents: 'none',
          }}>
            {card.title}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
