import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Popover, Spin, Switch } from 'antd';
import { EditOutlined, ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import type { KanbanCard } from '../types';
import { saveKanban, deleteKanban, isKanbanOwner } from '../store';
import { useAuth } from '../AuthContext';
import { ProgressBar } from '../components/ProgressBar';
import { ProjectLifeline } from '../components/ProjectLifeline';
import { KanbanBoard } from '../components/KanbanBoard';
import { AddCardModal } from '../components/AddCardModal';
import { KanbanSettings } from '../components/KanbanSettings';
import { useKanban } from '../hooks/useKanban';
import { useBreakpoint } from '../hooks/useBreakpoint';

export function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { kanban, setKanban, loading, notFound } = useKanban(id!);

  const [editTotal, setEditTotal] = useState(false);
  const [editValue, setEditValue] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isOwner = kanban && user ? isKanbanOwner(kanban, user.uid) : false;
  const { isMobile } = useBreakpoint();

  const backlogColId = kanban?.backlogColumnId ?? kanban?.columns[0]?.id;
  const backlogCount = kanban ? kanban.cards.filter(c => c.columnId === backlogColId).length : 0;
  const effectiveTotal = kanban
    ? (kanban.totalFromBacklog ? Math.max(backlogCount, 1) : kanban.totalEstimated)
    : 1;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (kanban && !initialised.current) {
      setEditValue(kanban.totalEstimated);
      initialised.current = true;
    }
  }, [kanban]);

  useEffect(() => {
    if (!kanban || !initialised.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveKanban(kanban), 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [kanban]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#EEF0F5' }}>
      <Spin size="large" />
    </div>
  );

  if (notFound || !kanban) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#EEF0F5', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#666' }}>Kanban not found or you don't have access.</p>
      <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
    </div>
  );

  function addCard(card: Omit<KanbanCard, 'id' | 'order'>) {
    if (!kanban) return;
    const maxOrder = kanban.cards.reduce((m, c) => c.columnId === card.columnId ? Math.max(m, c.order) : m, -1);
    setKanban({ ...kanban, cards: [...kanban.cards, { ...card, id: crypto.randomUUID(), order: maxOrder + 1 }] });
  }

  function deleteCard(cardId: string) {
    if (!kanban) return;
    setKanban({ ...kanban, cards: kanban.cards.filter(c => c.id !== cardId) });
  }

  function confirmEditTotal() {
    if (!kanban || !editValue || editValue <= 0) return;
    setKanban({ ...kanban, totalEstimated: editValue });
    setEditTotal(false);
  }

  function handleChangeDates(sy: number, sm: number, ey: number, em: number) {
    if (!kanban) return;
    setKanban({ ...kanban, projectStartYear: sy, projectStartMonth: sm, projectEndYear: ey, projectEndMonth: em });
  }

  async function handleDeleteKanban() {
    if (!kanban) return;
    await deleteKanban(kanban);
    navigate('/');
  }

  const totalPopoverContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch
          size="small"
          checked={kanban.totalFromBacklog ?? false}
          onChange={v => setKanban({ ...kanban, totalFromBacklog: v })}
        />
        <span style={{ fontSize: 13, color: '#444' }}>Use backlog column count</span>
      </div>
      {kanban.totalFromBacklog ? (
        <div style={{ fontSize: 13, color: '#888' }}>
          Backlog: <strong style={{ color: '#1a1a2e' }}>{backlogCount}</strong> card{backlogCount !== 1 ? 's' : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            min={1}
            value={editValue || ''}
            onChange={e => setEditValue(parseInt(e.target.value) || 0)}
            onKeyDown={e => e.key === 'Enter' && confirmEditTotal()}
            style={{ width: 100, fontSize: 20, fontWeight: 700, padding: '4px 10px', border: '1px solid #d9d9d9', borderRadius: 6, outline: 'none' }}
            autoFocus
          />
          <Button type="primary" onClick={confirmEditTotal}>OK</Button>
        </div>
      )}
    </div>
  );

  const showLifeline = (kanban.showLifeline ?? true) && !isMobile;
  const showProgressBar = kanban.showProgressBar ?? true;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      padding: '12px 16px',
      gap: 8,
      background: '#EEF0F5',
    }}>
      {showLifeline && (
        <ProjectLifeline
          startYear={kanban.projectStartYear}
          startMonth={kanban.projectStartMonth}
          endYear={kanban.projectEndYear}
          endMonth={kanban.projectEndMonth}
          onChangeDates={handleChangeDates}
        />
      )}

      {showProgressBar && (
        <ProgressBar cards={kanban.cards} columns={kanban.columns} totalEstimated={effectiveTotal} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: 44, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            size="small"
            onClick={() => navigate('/')}
            style={{ color: '#666', padding: '0 4px' }}
          />
          <Popover
            content={totalPopoverContent}
            trigger="click"
            open={editTotal}
            onOpenChange={open => {
              setEditTotal(open);
              if (open) setEditValue(kanban.totalEstimated);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, cursor: 'pointer' }}>
              <span style={{ fontSize: 'clamp(16px, 2vw, 28px)', fontWeight: 800, color: '#1a1a2e', lineHeight: 1 }}>
                {kanban.name}
              </span>
              <span style={{ fontSize: 'clamp(12px, 1.1vw, 16px)', fontWeight: 400, color: '#666', lineHeight: 1 }}>
                {kanban.cards.length} of {effectiveTotal} cards
              </span>
              <EditOutlined style={{ fontSize: 13, color: '#aaa', marginLeft: 2 }} />
            </div>
          </Popover>
        </div>

        {isOwner && (
          <Button
            icon={<SettingOutlined />}
            size="small"
            type="text"
            onClick={() => setSettingsOpen(true)}
            style={{ color: '#666' }}
          >
            Settings
          </Button>
        )}
      </div>

      <KanbanBoard
        cards={kanban.cards}
        columns={kanban.columns}
        onCardsChange={cards => setKanban({ ...kanban, cards })}
        onDeleteCard={deleteCard}
        cardFontSize={kanban.cardFontSize}
        isOwner={isOwner}
      />

      <AddCardModal
        columns={kanban.columns}
        onAdd={addCard}
        onImport={cards => setKanban({ ...kanban, cards })}
      />

      {isOwner && (
        <KanbanSettings
          open={settingsOpen}
          kanban={kanban}
          onClose={() => setSettingsOpen(false)}
          onChange={setKanban}
          onDelete={handleDeleteKanban}
        />
      )}
    </div>
  );
}
