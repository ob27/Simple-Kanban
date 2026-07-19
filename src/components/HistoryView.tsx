import { useEffect, useState } from 'react';
import { Button, Input, Select, DatePicker, Spin, Tag, Dropdown } from 'antd';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import {
  ArrowLeftOutlined, SearchOutlined, PlusOutlined, SwapOutlined, EditOutlined,
  DeleteOutlined, MergeCellsOutlined, ScissorOutlined, ExportOutlined, ImportOutlined,
  CommentOutlined, PaperClipOutlined, UserSwitchOutlined, LinkOutlined, UploadOutlined,
  UserOutlined, LogoutOutlined,
} from '@ant-design/icons';
import type { Kanban, KanbanEvent, KanbanEventType } from '../types';
import { loadKanbanEventsPage } from '../utils/kanbanEvents';
import { buildWildcardMatcher } from '../utils/wildcardSearch';
import { useUserProfiles, resolveDisplay } from '../utils/userProfiles';
import { useAuth } from '../AuthContext';
import { UserAvatar } from './UserAvatar';
import { NotificationBell } from './NotificationBell';

const { RangePicker } = DatePicker;

const EVENT_TYPE_LABELS: Record<KanbanEventType, string> = {
  'card.created': 'Card created',
  'card.movedColumn': 'Card moved',
  'card.bulkStatusChange': 'Bulk status change',
  'card.titleEdited': 'Title edited',
  'card.notesEdited': 'Notes edited',
  'card.pillEdited': 'Pill edited',
  'card.storyPointsEdited': 'Story points edited',
  'card.deleted': 'Card deleted',
  'card.merged': 'Cards merged',
  'card.split': 'Card split',
  'card.movedToBoard': 'Moved to another board',
  'card.copiedToBoard': 'Copied to another board',
  'card.receivedFromBoard': 'Received from another board',
  'comment.added': 'Comment added',
  'comment.edited': 'Comment edited',
  'comment.deleted': 'Comment deleted',
  'attachment.uploaded': 'Attachment uploaded',
  'attachment.deleted': 'Attachment deleted',
  'assignment.changed': 'Assignment changed',
  'checklist.linked': 'Checklist linked',
  'import.csvReplace': 'CSV import',
};

const EVENT_TYPE_ICONS: Record<KanbanEventType, React.ReactNode> = {
  'card.created': <PlusOutlined />,
  'card.movedColumn': <SwapOutlined />,
  'card.bulkStatusChange': <SwapOutlined />,
  'card.titleEdited': <EditOutlined />,
  'card.notesEdited': <EditOutlined />,
  'card.pillEdited': <EditOutlined />,
  'card.storyPointsEdited': <EditOutlined />,
  'card.deleted': <DeleteOutlined />,
  'card.merged': <MergeCellsOutlined />,
  'card.split': <ScissorOutlined />,
  'card.movedToBoard': <ExportOutlined />,
  'card.copiedToBoard': <ExportOutlined />,
  'card.receivedFromBoard': <ImportOutlined />,
  'comment.added': <CommentOutlined />,
  'comment.edited': <CommentOutlined />,
  'comment.deleted': <CommentOutlined />,
  'attachment.uploaded': <PaperClipOutlined />,
  'attachment.deleted': <PaperClipOutlined />,
  'assignment.changed': <UserSwitchOutlined />,
  'checklist.linked': <LinkOutlined />,
  'import.csvReplace': <UploadOutlined />,
};

function describeEvent(e: KanbanEvent): string {
  const d = e.detail ?? {};
  switch (e.type) {
    case 'card.created': return 'created this card';
    case 'card.movedColumn': return `moved this card from "${d.fromColumnLabel}" to "${d.toColumnLabel}"`;
    case 'card.bulkStatusChange': return `moved ${(d.cardIds as string[] | undefined)?.length ?? 0} card(s) to "${d.toColumnLabel}"`;
    case 'card.titleEdited': return `changed the title from "${d.oldValue}" to "${d.newValue}"`;
    case 'card.notesEdited': return 'edited the notes';
    case 'card.pillEdited': return `changed the pill value from "${d.oldValue || '(none)'}" to "${d.newValue || '(none)'}"`;
    case 'card.storyPointsEdited': return `changed story points from ${d.oldValue ?? '(none)'} to ${d.newValue ?? '(none)'}`;
    case 'card.deleted': return 'deleted this card';
    case 'card.merged': return `merged ${(d.absorbedCardTitles as string[] | undefined)?.join(', ') ?? 'other cards'} into this card`;
    case 'card.split': return `split this card into ${(d.resultCardTitles as string[] | undefined)?.join(', ') ?? 'new cards'}`;
    case 'card.movedToBoard': return `moved this card to "${d.targetKanbanName}"`;
    case 'card.copiedToBoard': return `copied this card to "${d.targetKanbanName}"`;
    case 'card.receivedFromBoard': return `received this card from "${d.sourceKanbanName}"`;
    case 'comment.added': return `commented: "${d.textSnippet}"`;
    case 'comment.edited': return `edited a comment: "${d.textSnippet}"`;
    case 'comment.deleted': return 'deleted a comment';
    case 'attachment.uploaded': return `uploaded "${d.fileName}"`;
    case 'attachment.deleted': return `deleted "${d.fileName}"`;
    case 'assignment.changed': return `changed "${d.definitionLabel}" from ${d.oldValue || '(none)'} to ${d.newValue || '(none)'}`;
    case 'checklist.linked': return `linked checklist "${d.templateName}"`;
    case 'import.csvReplace': return `replaced all cards via CSV import (${d.addedCount} added, ${d.removedCount} removed)`;
  }
}

interface Props {
  kanban: Kanban;
  initialCardFilter: string | null;
  onBack: () => void;
}

export function HistoryView({ kanban, initialCardFilter, onBack }: Props) {
  const { user, signOut } = useAuth();
  const ownProfile = useUserProfiles(user ? [user.uid] : []);
  const [events, setEvents] = useState<KanbanEvent[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<KanbanEventType | undefined>(undefined);
  const [actorFilter, setActorFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[number, number] | null>(null);
  const [cardFilter, setCardFilter] = useState<string | null>(initialCardFilter);

  const memberUids = Array.from(new Set(events.map(e => e.actorUid)));
  const profiles = useUserProfiles(memberUids);

  async function loadFirstPage() {
    setLoading(true);
    const { events: page, nextCursor } = await loadKanbanEventsPage(kanban.id, { cardId: cardFilter ?? undefined, typeFilter });
    setEvents(page);
    setCursor(nextCursor);
    setLoading(false);
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    const { events: page, nextCursor } = await loadKanbanEventsPage(kanban.id, { cardId: cardFilter ?? undefined, typeFilter, cursor });
    setEvents(prev => [...prev, ...page]);
    setCursor(nextCursor);
    setLoadingMore(false);
  }

  useEffect(() => {
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanban.id, cardFilter, typeFilter]);

  const matcher = search.trim() ? buildWildcardMatcher(search.trim()) : null;
  const visibleEvents = events.filter(e => {
    if (actorFilter && e.actorUid !== actorFilter) return false;
    if (dateRange && (e.occurredAt < dateRange[0] || e.occurredAt > dateRange[1])) return false;
    if (matcher) {
      const haystack = `${e.cardTitle ?? ''} ${e.actorEmail ?? ''} ${describeEvent(e)}`;
      if (!matcher(haystack)) return false;
    }
    return true;
  });

  const actorOptions = Array.from(new Set(events.map(e => e.actorUid))).map(uid => {
    const email = events.find(e => e.actorUid === uid)?.actorEmail ?? uid;
    return { value: uid, label: resolveDisplay(uid, email, profiles).name };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#EEF0F5' }}>
      <div style={{
        background: '#1a1a2e', padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>
          <img src="/favicon-white.svg" alt="" style={{ height: 16, width: 'auto' }} />
          Simple Kanban
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user && <NotificationBell uid={user.uid} />}
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'email', label: user ? resolveDisplay(user.uid, user.email ?? '', ownProfile).name : user, disabled: true },
                { type: 'divider' as const },
                { key: 'all-products', icon: <ArrowLeftOutlined />, label: 'All products' },
                { key: 'profile', icon: <UserOutlined />, label: 'Profile' },
                { type: 'divider' as const },
                { key: 'signout', icon: <LogoutOutlined />, label: 'Sign out', danger: true },
              ],
              onClick: ({ key }) => {
                if (key === 'all-products') window.location.href = '/';
                if (key === 'profile') window.location.href = '/profile';
                if (key === 'signout') signOut();
              },
            }}
          >
            <span style={{ display: 'inline-flex', cursor: 'pointer' }}>
              {user?.email
                ? <UserAvatar email={user.email} seed={resolveDisplay(user.uid, user.email, ownProfile).avatarSeed} photoURL={ownProfile[user.uid]?.avatarPhotoURL} size={28} />
                : <span style={{ color: '#8794b0', fontSize: 13 }}>Account</span>}
            </span>
          </Dropdown>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '12px 16px', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ color: '#666' }} />
        <span style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>History</span>
        {cardFilter && (
          <Tag closable onClose={() => setCardFilter(null)} style={{ margin: 0 }}>
            {events.find(e => e.cardId === cardFilter)?.cardTitle ?? 'This card'}
          </Tag>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#aaa' }} />}
          placeholder="Search history… (use * as a wildcard)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
          style={{ width: 260 }}
        />
        <Select
          placeholder="Action type"
          allowClear
          style={{ width: 180 }}
          value={typeFilter}
          onChange={setTypeFilter}
          options={(Object.keys(EVENT_TYPE_LABELS) as KanbanEventType[]).map(t => ({ value: t, label: EVENT_TYPE_LABELS[t] }))}
        />
        <Select
          placeholder="Person"
          allowClear
          style={{ width: 180 }}
          value={actorFilter}
          onChange={setActorFilter}
          options={actorOptions}
        />
        <RangePicker
          showTime
          onChange={vals => setDateRange(vals && vals[0] && vals[1] ? [vals[0].valueOf(), vals[1].valueOf()] : null)}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : visibleEvents.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', fontSize: 13, padding: 60 }}>No history yet.</div>
        ) : (
          visibleEvents.map(e => {
            const display = resolveDisplay(e.actorUid, e.actorEmail ?? e.actorUid, profiles);
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '10px 12px' }}>
                <span style={{ color: '#888', fontSize: 15, marginTop: 2 }}>{EVENT_TYPE_ICONS[e.type]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#1a1a2e' }}>
                    <strong>{display.name}</strong> {describeEvent(e)}
                    {e.cardId && !cardFilter && e.cardTitle && (
                      <>
                        {' '}on{' '}
                        <a onClick={() => setCardFilter(e.cardId)} style={{ cursor: 'pointer' }}>{e.cardTitle}</a>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{new Date(e.occurredAt).toLocaleString()}</div>
                </div>
              </div>
            );
          })
        )}
        {cursor && !loading && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Button loading={loadingMore} onClick={loadMore}>Load more</Button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
