import { useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { Modal, Input, Button, Popconfirm, Dropdown, InputNumber, Select } from 'antd';
import { SendOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, MoreOutlined, FileOutlined, PaperClipOutlined } from '@ant-design/icons';
import type { KanbanCard, CardComment, Kanban, CardAttachment } from '../types';
import { UserAvatar } from './UserAvatar';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface CardUpdates {
  title?: string;
  pillValue?: string;
  notes?: string;
  storyPoints?: number | null;
}

interface Props {
  card: KanbanCard;
  columnColor: string;
  currentUser: { uid: string; email: string };
  canDeleteAnyComment: boolean;
  readOnly?: boolean;
  showStoryPoints?: boolean;
  onClose: () => void;
  onSaveCard: (cardId: string, updates: CardUpdates) => void;
  onAddComment: (cardId: string, text: string) => void;
  onEditComment: (cardId: string, commentId: string, text: string) => void;
  onDeleteComment: (cardId: string, commentId: string) => void;
  onSplitCard?: (titles: string[]) => void;
  otherKanbans?: Kanban[];
  onMoveOrCopy?: (targetKanbanId: string, mode: 'move' | 'copy') => void;
  onUploadAttachment?: (file: File) => void;
  onDeleteAttachment?: (attachment: CardAttachment) => void;
}

function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{part}</a>
      : <span key={i}>{part}</span>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function CardNotesModal({
  card, columnColor, currentUser, canDeleteAnyComment, readOnly, showStoryPoints,
  onClose, onSaveCard, onAddComment, onEditComment, onDeleteComment,
  onSplitCard, otherKanbans, onMoveOrCopy, onUploadAttachment, onDeleteAttachment,
}: Props) {
  const { isMobile } = useBreakpoint();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachments: CardAttachment[] = card.attachments ?? [];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onUploadAttachment?.(file);
  }
  const [titleValue, setTitleValue] = useState(card.title);
  const [pillValue, setPillValue] = useState(card.pillValue ?? '');
  const [notesValue, setNotesValue] = useState(card.notes ?? '');
  const [storyPointsValue, setStoryPointsValue] = useState<number | null>(card.storyPoints ?? null);
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitTitles, setSplitTitles] = useState<string[]>(['', '']);
  const [moveMode, setMoveMode] = useState<'move' | 'copy' | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const comments: CardComment[] = card.comments ?? [];

  function handleTitleBlur() {
    const trimmed = titleValue.trim();
    if (!trimmed) { setTitleValue(card.title); return; }
    if (trimmed !== card.title) onSaveCard(card.id, { title: trimmed });
  }

  function handlePillBlur() {
    if (pillValue !== (card.pillValue ?? '')) {
      onSaveCard(card.id, { pillValue });
    }
  }

  function handleNotesBlur() {
    if (notesValue !== (card.notes ?? '')) {
      onSaveCard(card.id, { notes: notesValue });
    }
  }

  function handleStoryPointsChange(value: number | null) {
    setStoryPointsValue(value);
    if (value !== (card.storyPoints ?? null)) {
      onSaveCard(card.id, { storyPoints: value });
    }
  }

  function openSplit() {
    setSplitTitles([card.title, '']);
    setSplitOpen(true);
  }

  function confirmSplit() {
    const titles = splitTitles.map(t => t.trim()).filter(Boolean);
    if (titles.length < 2) return;
    onSplitCard?.(titles);
    setSplitOpen(false);
  }

  function confirmMoveOrCopy() {
    if (!moveMode || !moveTargetId) return;
    onMoveOrCopy?.(moveTargetId, moveMode);
    setMoveMode(null);
    setMoveTargetId(null);
  }

  function handleSendComment() {
    const text = commentText.trim();
    if (!text) return;
    onAddComment(card.id, text);
    setCommentText('');
  }

  function startEditComment(c: CardComment) {
    setEditingCommentId(c.id);
    setEditingText(c.text);
  }

  function confirmEditComment(commentId: string) {
    const text = editingText.trim();
    if (text && text !== comments.find(c => c.id === commentId)?.text) {
      onEditComment(card.id, commentId, text);
    }
    setEditingCommentId(null);
  }

  function cancelEditComment() {
    setEditingCommentId(null);
  }

  return (
    <Modal
      open
      onCancel={onClose}
      footer={null}
      width={isMobile ? '100vw' : 560}
      style={{ top: isMobile ? 0 : 80, padding: 0, margin: isMobile ? 0 : undefined }}
      styles={{ body: { padding: 0 }, content: { borderRadius: isMobile ? 0 : 12, overflow: 'hidden' } }}
    >
      {/* Header — editable title + pill */}
      <div style={{ borderLeft: `5px solid ${columnColor}`, padding: '18px 24px 16px', background: '#fff', position: 'relative' }}>
        {!readOnly && (onSplitCard || (otherKanbans && otherKanbans.length > 0)) && (
          <div style={{ position: 'absolute', top: 12, right: 44 }}>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  ...(onSplitCard ? [{ key: 'split', label: 'Split card' }] : []),
                  ...(otherKanbans && otherKanbans.length > 0 ? [
                    { key: 'move', label: 'Move to kanban…' },
                    { key: 'copy', label: 'Copy to kanban…' },
                  ] : []),
                ],
                onClick: ({ key }) => {
                  if (key === 'split') openSplit();
                  if (key === 'move') { setMoveTargetId(null); setMoveMode('move'); }
                  if (key === 'copy') { setMoveTargetId(null); setMoveMode('copy'); }
                },
              }}
            >
              <Button size="small" type="text" icon={<MoreOutlined />} />
            </Dropdown>
          </div>
        )}
        <Input
          value={titleValue}
          onChange={e => !readOnly && setTitleValue(e.target.value)}
          onBlur={handleTitleBlur}
          onPressEnter={e => (e.currentTarget as HTMLInputElement).blur()}
          variant="borderless"
          readOnly={readOnly}
          style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', padding: '0 0 2px', width: '100%', lineHeight: 1.3, cursor: readOnly ? 'default' : undefined }}
        />
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#bbb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
            Tag
          </span>
          <Input
            value={pillValue}
            onChange={e => !readOnly && setPillValue(e.target.value)}
            onBlur={handlePillBlur}
            onPressEnter={e => (e.currentTarget as HTMLInputElement).blur()}
            placeholder={readOnly ? '' : 'e.g. 14 Jul, High priority'}
            variant="borderless"
            readOnly={readOnly}
            style={{
              fontSize: 12, color: '#888', padding: '0 4px',
              background: pillValue ? `${columnColor}18` : 'transparent',
              borderRadius: 4, flex: 1, cursor: readOnly ? 'default' : undefined,
            }}
          />
        </div>
        {showStoryPoints && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#bbb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
              Points
            </span>
            <InputNumber
              size="small"
              min={0}
              value={storyPointsValue}
              onChange={handleStoryPointsChange}
              readOnly={readOnly}
              placeholder={readOnly ? '—' : '0'}
              style={{ width: 70 }}
            />
          </div>
        )}
      </div>

      <div style={{ padding: '0 24px 24px', maxHeight: isMobile ? 'calc(100dvh - 120px)' : 560, overflowY: 'auto' }}>
        {/* Notes */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Notes
          </div>
          {readOnly ? (
            <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: notesValue ? '#333' : '#bbb', minHeight: 88 }}>
              {notesValue ? linkify(notesValue) : 'No notes added.'}
            </div>
          ) : (
            <Input.TextArea
              value={notesValue}
              onChange={e => setNotesValue(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add notes about this card…"
              autoSize={{ minRows: 4, maxRows: 12 }}
              style={{ fontSize: 14, lineHeight: 1.6, resize: 'none' }}
            />
          )}
        </div>

        {/* Attachments */}
        {(attachments.length > 0 || (!readOnly && onUploadAttachment)) && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
              Attachments {attachments.length > 0 && `(${attachments.length})`}
            </div>
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                {attachments.map(a => (
                  <div key={a.id} style={{ position: 'relative', width: 84 }}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                      {a.type.startsWith('image/') ? (
                        <img
                          src={a.url}
                          alt={a.name}
                          style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }}
                        />
                      ) : (
                        <div style={{
                          width: 84, height: 84, borderRadius: 8, border: '1px solid #eee', background: '#f8f9fb',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6,
                        }}>
                          <FileOutlined style={{ fontSize: 20, color: '#999' }} />
                          <span style={{ fontSize: 10, color: '#888', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.2, maxHeight: 28, overflow: 'hidden' }}>
                            {a.name}
                          </span>
                        </div>
                      )}
                    </a>
                    {!readOnly && onDeleteAttachment && (
                      <button
                        onClick={() => onDeleteAttachment(a)}
                        style={{
                          position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                          background: '#fff', border: '1px solid #eee', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                        }}
                      >
                        <CloseOutlined style={{ fontSize: 9, color: '#999' }} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!readOnly && onUploadAttachment && (
              <>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
                <Button size="small" icon={<PaperClipOutlined />} onClick={() => fileInputRef.current?.click()}>
                  Add attachment
                </Button>
              </>
            )}
          </div>
        )}

        {/* Comments */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            Comments {comments.length > 0 && `(${comments.length})`}
          </div>

          {comments.length === 0 && (
            <div style={{ fontSize: 13, color: '#bbb', marginBottom: 16 }}>No comments yet.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {comments.map(c => {
              const canEdit = !readOnly && c.uid === currentUser.uid;
              const canDelete = !readOnly && (c.uid === currentUser.uid || canDeleteAnyComment);
              const isEditing = editingCommentId === c.id;
              const isHovered = hoveredCommentId === c.id;

              return (
                <div
                  key={c.id}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
                  onMouseEnter={() => setHoveredCommentId(c.id)}
                  onMouseLeave={() => setHoveredCommentId(null)}
                >
                  <UserAvatar email={c.email} size={28} />
                  <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>{c.email}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: '#bbb' }}>{relativeTime(c.createdAt)}</span>
                        {(canEdit || canDelete) && (isHovered || isEditing) && !isEditing && (
                          <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
                            {canEdit && (
                              <button
                                onClick={() => startEditComment(c)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: '#bbb', borderRadius: 3 }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#555')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}
                              >
                                <EditOutlined style={{ fontSize: 11 }} />
                              </button>
                            )}
                            {canDelete && (
                              <Popconfirm
                                title="Delete this comment?"
                                onConfirm={() => onDeleteComment(card.id, c.id)}
                                okText="Delete"
                                okButtonProps={{ danger: true }}
                                placement="topRight"
                              >
                                <button
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: '#bbb', borderRadius: 3 }}
                                  onMouseEnter={e => (e.currentTarget.style.color = '#ff4d4f')}
                                  onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}
                                >
                                  <DeleteOutlined style={{ fontSize: 11 }} />
                                </button>
                              </Popconfirm>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Input.TextArea
                          value={editingText}
                          onChange={e => setEditingText(e.target.value)}
                          autoSize={{ minRows: 2 }}
                          autoFocus
                          style={{ fontSize: 13 }}
                        />
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <Button size="small" icon={<CloseOutlined />} onClick={cancelEditComment}>Cancel</Button>
                          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => confirmEditComment(c.id)}>Save</Button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#333', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{linkify(c.text)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add comment — hidden for viewers */}
          {!readOnly && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <UserAvatar email={currentUser.email} size={28} />
              <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                <Input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onPressEnter={handleSendComment}
                  placeholder="Add a comment…"
                  style={{ flex: 1, fontSize: 13 }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSendComment}
                  disabled={!commentText.trim()}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        title="Split card"
        open={splitOpen}
        onCancel={() => setSplitOpen(false)}
        onOk={confirmSplit}
        okText="Split"
        okButtonProps={{ disabled: splitTitles.map(t => t.trim()).filter(Boolean).length < 2 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {splitTitles.map((t, i) => (
            <Input
              key={i}
              value={t}
              placeholder={`Card ${i + 1} title`}
              onChange={e => setSplitTitles(prev => prev.map((v, j) => j === i ? e.target.value : v))}
            />
          ))}
          <Button size="small" onClick={() => setSplitTitles(prev => [...prev, ''])} style={{ alignSelf: 'flex-start' }}>
            + Add another
          </Button>
        </div>
      </Modal>

      <Modal
        title={moveMode === 'move' ? 'Move card to another kanban' : 'Copy card to another kanban'}
        open={!!moveMode}
        onCancel={() => setMoveMode(null)}
        onOk={confirmMoveOrCopy}
        okText={moveMode === 'move' ? 'Move' : 'Copy'}
        okButtonProps={{ disabled: !moveTargetId }}
      >
        <Select
          style={{ width: '100%' }}
          placeholder="Select a kanban"
          value={moveTargetId ?? undefined}
          onChange={setMoveTargetId}
          options={(otherKanbans ?? []).map(k => ({ value: k.id, label: k.name }))}
        />
      </Modal>
    </Modal>
  );
}
