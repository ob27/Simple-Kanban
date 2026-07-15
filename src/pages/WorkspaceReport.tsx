import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spin, Button } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useAuth } from '../AuthContext';
import { loadUserKanbans } from '../store';
import { getWorkspaceSettings } from '../utils/logoUpload';
import { useUserProfiles, resolveDisplay, type UserProfile } from '../utils/userProfiles';
import type { Kanban, KanbanCard } from '../types';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CardRow({ card, color, profiles }: { card: KanbanCard; color: string; profiles: Record<string, UserProfile> }) {
  const comments = card.comments ?? [];
  return (
    <div style={{ marginBottom: 12, paddingLeft: 12, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e' }}>{card.title}</span>
        {card.pillValue && (
          <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap', flexShrink: 0 }}>{card.pillValue}</span>
        )}
      </div>
      {card.notes && (
        <div style={{ marginTop: 4, fontSize: 12, color: '#555', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {card.notes}
        </div>
      )}
      {comments.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {comments.map(c => (
            <div key={c.id} style={{ fontSize: 11, color: '#777', marginBottom: 2 }}>
              <span style={{ fontWeight: 600 }}>{resolveDisplay(c.uid, c.email, profiles).name}</span>
              {' · '}
              <span style={{ color: '#aaa' }}>{formatDate(c.createdAt)}</span>
              {': '}
              {c.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KanbanSection({ kanban, profiles }: { kanban: Kanban; profiles: Record<string, UserProfile> }) {
  return (
    <div className="kanban-section">
      <div style={{
        borderBottom: '2px solid #1a1a2e',
        paddingBottom: 6,
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>{kanban.name}</span>
        <span style={{ fontSize: 12, color: '#888' }}>{kanban.cards.length} card{kanban.cards.length !== 1 ? 's' : ''}</span>
      </div>
      {kanban.columns.map(col => {
        const cards = kanban.cards
          .filter(c => c.columnId === col.id)
          .sort((a, b) => a.order - b.order);
        if (!cards.length) return null;
        return (
          <div key={col.id} style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: col.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 12, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {col.label}
              </span>
              <span style={{ fontSize: 11, color: '#bbb' }}>({cards.length})</span>
            </div>
            {cards.map(card => (
              <CardRow key={card.id} card={card} color={col.color} profiles={profiles} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function WorkspaceReport() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const kanbanId = searchParams.get('kanbanId');
  const [kanbans, setKanbans] = useState<Kanban[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      loadUserKanbans(user.uid),
      getWorkspaceSettings(user.uid),
    ]).then(([ks, ws]) => {
      // Single-kanban mode (linked from a board's own Settings): any kanban
      // the user can access, not just ones they own — a member printing a
      // shared board's report shouldn't hit an empty page.
      setKanbans(kanbanId ? ks.filter(k => k.id === kanbanId) : ks.filter(k => k.ownerId === user.uid));
      setLogoUrl(ws.boardLogoUrl);
      setLoading(false);
    });
  }, [user, kanbanId]);

  const commentProfiles = useUserProfiles(kanbans.flatMap(k => k.cards.flatMap(c => (c.comments ?? []).map(cm => cm.uid))));

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <Spin size="large" />
    </div>
  );

  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .kanban-section { break-after: page; }
          body { margin: 0; }
        }
        @page { margin: 20mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print" style={{
        position: 'fixed', top: 16, right: 16, zIndex: 100,
        display: 'flex', gap: 8,
      }}>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 32px' }}>
        {/* Report header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 32,
          paddingBottom: 24,
          borderBottom: '3px solid #1a1a2e',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                style={{ height: 48, width: 'auto', objectFit: 'contain' }}
              />
            )}
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#1a1a2e', letterSpacing: '-0.5px' }}>
                {kanbanId ? (kanbans[0]?.name ?? 'Kanban Report') : 'Workspace Report'}
              </div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{user?.email}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#aaa' }}>Generated</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>{today}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
              {kanbans.length} kanban{kanbans.length !== 1 ? 's' : ''} ·{' '}
              {kanbans.reduce((n, k) => n + k.cards.length, 0)} total cards
            </div>
          </div>
        </div>

        {/* Kanbans */}
        {kanbans.length === 0 ? (
          <div style={{ color: '#aaa', fontSize: 14 }}>
            {kanbanId ? "Kanban not found or you don't have access." : 'No kanbans found.'}
          </div>
        ) : (
          kanbans.map(k => <KanbanSection key={k.id} kanban={k} profiles={commentProfiles} />)
        )}
      </div>
    </>
  );
}
