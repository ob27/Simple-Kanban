import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spin, Tag, Tooltip } from 'antd';
import { PlusOutlined, LogoutOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuth } from '../AuthContext';
import { subscribeUserKanbans, ensureDefaultKanban, isKanbanOwner } from '../store';
import type { Kanban } from '../types';
import { CreateKanbanModal } from '../components/CreateKanbanModal';
import { AccessModal } from '../components/AccessModal';
import { UserAvatar } from '../components/UserAvatar';
import { useBreakpoint } from '../hooks/useBreakpoint';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();
  const [kanbans, setKanbans] = useState<Kanban[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [accessKanban, setAccessKanban] = useState<Kanban | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let unsub: (() => void) | undefined;
    let cancelled = false;

    // Ensure new users get a default board, then open a live subscription.
    ensureDefaultKanban(user.uid, user.email ?? undefined).catch(() => {}).finally(() => {
      if (cancelled) return;
      unsub = subscribeUserKanbans(user.uid, kanbans => {
        setKanbans(kanbans);
        setLoading(false);
      });
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user]);

  function onCreated(kanban: Kanban) {
    setCreateOpen(false);
    navigate(`/k/${kanban.id}`);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#EEF0F5', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: '#1a1a2e',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>
          Simple Kanban <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.55)', fontSize: 15 }}>by Oestler</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!isMobile && (
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{user?.email}</span>
          )}
          {user?.email && <UserAvatar email={user.email} size={28} />}
          <Button
            icon={<LogoutOutlined />}
            size="small"
            type="text"
            onClick={signOut}
            style={{ color: 'rgba(255,255,255,0.5)' }}
          />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '32px 24px', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Your Kanbans</h1>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            New Kanban
          </Button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <Spin size="large" />
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}>
            {kanbans.map(k => (
              <KanbanCard
                key={k.id}
                kanban={k}
                isOwner={isKanbanOwner(k, user!.uid)}
                onClick={() => navigate(`/k/${k.id}`)}
                onManageAccess={() => setAccessKanban(k)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateKanbanModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onCreated}
      />

      {accessKanban && (
        <AccessModal
          kanban={accessKanban}
          currentUid={user!.uid}
          currentEmail={user!.email ?? ''}
          onClose={() => setAccessKanban(null)}
          onChange={updated => {
            setKanbans(prev => prev.map(k => k.id === updated.id ? updated : k));
            setAccessKanban(updated);
          }}
        />
      )}
    </div>
  );
}

function MiniProgressBar({ kanban }: { kanban: Kanban }) {
  const total = kanban.cards.length;
  return (
    <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: '#eee' }}>
      {total > 0 && kanban.columns.map(col => {
        const count = kanban.cards.filter(c => c.columnId === col.id).length;
        if (!count) return null;
        return <div key={col.id} style={{ flex: count, background: col.color }} />;
      })}
    </div>
  );
}

function KanbanCard({ kanban, isOwner, onClick, onManageAccess }: { kanban: Kanban; isOwner: boolean; onClick: () => void; onManageAccess: () => void }) {
  const accentColor = kanban.columns[0]?.color ?? '#1a1a2e';
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.13)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ height: 6, background: accentColor }} />
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', lineHeight: 1.3 }}>{kanban.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {!isOwner && <Tag color="blue">Shared</Tag>}
            {isOwner && (
              <Tooltip title="Manage access">
                <button
                  onClick={e => { e.stopPropagation(); onManageAccess(); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: '#999', borderRadius: 4, lineHeight: 1, fontSize: 14 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#555')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#999')}
                >
                  <TeamOutlined />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
        {!isOwner && kanban.ownerEmail && (
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>
            Shared by {kanban.ownerEmail}
          </div>
        )}
        <MiniProgressBar kanban={kanban} />
        <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
          {kanban.cards.length} card{kanban.cards.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
