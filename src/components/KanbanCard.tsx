import { useRef, useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from 'antd';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HolderOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons';
import type { KanbanCard as KanbanCardType } from '../types';
import { UserAvatar } from './UserAvatar';

interface Props {
  card: KanbanCardType;
  columnColor: string;
  onDelete: (id: string) => void;
  onOpenNotes?: () => void;
  cardFontSize?: number;
  wrapCardText?: boolean;
  isOverlay?: boolean;
  isViewer?: boolean;
  showStoryPoints?: boolean;
  staleAfterDays?: number;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  assignmentDefinitions?: { id: string; label: string }[];
  showAssignmentsOnCard?: boolean;
  memberEmailByUid?: Record<string, string>;
}

const LONG_PRESS_DELAY = 380;
const DOUBLE_TAP_MS = 300;

export function KanbanCard({
  card, columnColor, onDelete, onOpenNotes, cardFontSize, wrapCardText = false, isOverlay = false, isViewer = false,
  showStoryPoints = false, staleAfterDays, selectMode = false, selected = false, onToggleSelect,
  assignmentDefinitions, showAssignmentsOnCard = false, memberEmailByUid,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: selectMode });

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

  const daysSinceMoved = card.movedAt ? (Date.now() - card.movedAt) / 86400000 : 0;
  const isStale = !!staleAfterDays && daysSinceMoved >= staleAfterDays;
  const isVeryStale = !!staleAfterDays && daysSinceMoved >= staleAfterDays * 2;

  useEffect(() => {
    const el = nodeRef.current;
    if (!el || isOverlay || selectMode) return;

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
  }, [isOverlay, onOpenNotes, selectMode]);

  const transformStr = isOverlay
    ? `${CSS.Transform.toString(transform)} scale(1.04)`
    : (CSS.Transform.toString(transform) ?? undefined);

  // Suppressed during the drag overlay, matching the story-points badge and
  // staleness icon just below — extra chrome is deliberately left off the
  // ghost preview.
  const hasFilledAssignment = !!card.cardAssignments && Object.values(card.cardAssignments).some(
    v => v.kind === 'member' ? !!v.uid : !!v.text?.trim()
  );
  const showBody = !isOverlay && showAssignmentsOnCard && hasFilledAssignment;

  const outerStyle: CSSProperties = {
    transform: transformStr,
    transition: isDragging ? undefined : `${transition ?? ''}, box-shadow 0.15s ease, opacity 0.15s ease`,
    borderRadius: 9,
    overflow: 'visible',
    position: 'relative',
    cursor: isOverlay ? 'grabbing' : selectMode ? 'pointer' : isViewer ? 'default' : 'grab',
    userSelect: 'none',
    touchAction: 'none',
    boxShadow: isOverlay
      ? '0 10px 28px rgba(0,0,0,0.28)'
      : selected
        ? '0 0 0 3px rgba(255,255,255,0.9), 0 5px 16px rgba(0,0,0,0.22)'
        : hovered && !isDragging
          ? '0 5px 16px rgba(0,0,0,0.22)'
          : '0 1px 3px rgba(0,0,0,0.14)',
    opacity: isDragging ? 0.3 : 1,
  };

  const headerStyle: CSSProperties = {
    position: 'relative',
    background: `linear-gradient(160deg, ${columnColor}EE 0%, ${columnColor} 100%)`,
    color: '#FFFFFF',
    borderRadius: showBody ? '9px 9px 0 0' : 9,
    minHeight: 76,
    padding: card.pillValue ? '10px 36px 10px 38px' : '14px 36px 14px 38px',
    fontSize: cardFontSize ? `${cardFontSize}px` : 'clamp(13px, 1.3vw, 19px)',
    fontWeight: 700,
    letterSpacing: '0.02em',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  };

  return (
    <>
      <div
        ref={combinedRef}
        style={outerStyle}
        {...attributes}
        {...listeners}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={e => { if (selectMode) { e.stopPropagation(); onToggleSelect?.(); } }}
      >
        {selectMode && !isOverlay && (
          <div
            style={{
              position: 'absolute', top: 6, left: 7, width: 20, height: 20, borderRadius: 5,
              border: '2px solid rgba(255,255,255,0.85)', background: selected ? '#fff' : 'rgba(0,0,0,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1,
            }}
          >
            {selected && <CheckOutlined style={{ fontSize: 11, color: columnColor }} />}
          </div>
        )}

        {showStoryPoints && card.storyPoints != null && !isOverlay && (
          <div style={{
            position: 'absolute', top: -10, right: -10, width: 28, height: 28,
            borderRadius: '50%', background: '#fff', color: '#1a1a2e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            pointerEvents: 'none', zIndex: 2,
          }}>
            {Math.min(9, card.storyPoints)}
          </div>
        )}

        {!isOverlay && isStale && (
          <div style={{ position: 'absolute', top: -6, right: 8, pointerEvents: 'none', zIndex: 1 }}>
            {isVeryStale ? (
              <span style={{ fontSize: 16, display: 'inline-block', animation: 'kc-flame 0.6s ease-in-out infinite', filter: 'drop-shadow(0 0 4px rgba(255,120,0,0.8))' }}>
                🔥
              </span>
            ) : (
              <span style={{ fontSize: 14, display: 'inline-block', opacity: 0.5, animation: 'kc-smoke 2.4s ease-in infinite' }}>
                💨
              </span>
            )}
          </div>
        )}

        {!isOverlay && !isViewer && !selectMode && (
          <div
            onPointerDown={e => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
            onClick={e => { e.stopPropagation(); onDelete(card.id); }}
            style={{
              position: 'absolute', top: 6, right: 7, width: 22, height: 22,
              borderRadius: 5, background: 'rgba(0,0,0,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s ease, background 0.1s ease', zIndex: 1,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.5)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.28)'; }}
          >
            <CloseOutlined style={{ fontSize: 10, color: '#fff', pointerEvents: 'none' }} />
          </div>
        )}

        <div style={headerStyle}>
          {!selectMode && (
            <HolderOutlined style={{
              position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
              opacity: hovered && !isDragging ? 0.65 : 0.3,
              fontSize: 'clamp(12px, 1.1vw, 15px)', color: '#fff',
              pointerEvents: 'none', transition: 'opacity 0.15s ease',
            }} />
          )}

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

          {/* Notes indicator dot — lives in the header (not the outer card)
              so it stays visible against the colored background even once a
              white assignments panel is appended below; a light dot on
              white would be nearly invisible. */}
          {!isOverlay && (card.notes || (card.comments && card.comments.length > 0)) && (
            <div style={{
              position: 'absolute', bottom: 6, right: 7,
              width: 6, height: 6, borderRadius: '50%',
              background: 'rgba(255,255,255,0.6)',
            }} />
          )}
        </div>

        {showBody && (
          <div style={{
            background: '#fff', color: '#1a1a2e', borderRadius: '0 0 9px 9px',
            padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {assignmentDefinitions!.map(def => {
              const val = card.cardAssignments?.[def.id];
              if (!val) return null;
              const displayText = val.kind === 'member' ? (memberEmailByUid?.[val.uid] ?? val.uid) : val.text;
              return (
                <div key={def.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 700, color: '#999' }}>{def.label}:</span>
                  {val.kind === 'member' && <UserAvatar email={displayText} size={14} />}
                  <span style={{ color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</span>
                </div>
              );
            })}
          </div>
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
