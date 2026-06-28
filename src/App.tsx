import { useState, useEffect } from 'react';
import { Button, InputNumber, Popover } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type { DPKCard } from './types';
import { loadState, saveState } from './store';
import { ProgressBar } from './components/ProgressBar';
import { ProjectLifeline } from './components/ProjectLifeline';
import { KanbanBoard } from './components/KanbanBoard';
import { AddCardModal } from './components/AddCardModal';

export default function App() {
  const [cards, setCards] = useState<DPKCard[]>(() => loadState().cards);
  const [totalEstimated, setTotalEstimated] = useState<number>(() => loadState().totalEstimated);
  const [projectStartYear, setProjectStartYear] = useState<number>(() => loadState().projectStartYear);
  const [projectStartMonth, setProjectStartMonth] = useState<number>(() => loadState().projectStartMonth);
  const [projectEndYear, setProjectEndYear] = useState<number>(() => loadState().projectEndYear);
  const [projectEndMonth, setProjectEndMonth] = useState<number>(() => loadState().projectEndMonth);
  const [editTotal, setEditTotal] = useState(false);
  const [editValue, setEditValue] = useState<number>(() => loadState().totalEstimated);

  useEffect(() => {
    saveState({ cards, totalEstimated, projectStartYear, projectStartMonth, projectEndYear, projectEndMonth });
  }, [cards, totalEstimated, projectStartYear, projectStartMonth, projectEndYear, projectEndMonth]);

  function addCard(card: Omit<DPKCard, 'id'>) {
    setCards(prev => [...prev, { ...card, id: crypto.randomUUID() }]);
  }

  function deleteCard(id: string) {
    setCards(prev => prev.filter(c => c.id !== id));
  }

  function confirmEditTotal() {
    if (editValue && editValue > 0) setTotalEstimated(editValue);
    setEditTotal(false);
  }

  function handleChangeDates(
    sy: number, sm: number, ey: number, em: number
  ) {
    setProjectStartYear(sy);
    setProjectStartMonth(sm);
    setProjectEndYear(ey);
    setProjectEndMonth(em);
  }

  const totalPopoverContent = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <InputNumber
        min={1}
        value={editValue}
        onChange={v => setEditValue(v ?? totalEstimated)}
        onPressEnter={confirmEditTotal}
        style={{ width: 110 }}
        size="large"
        autoFocus
      />
      <Button type="primary" size="large" onClick={confirmEditTotal}>OK</Button>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      padding: '12px 16px',
      gap: 8,
      background: '#EEF0F5',
    }}>

      {/* Project lifeline */}
      <ProjectLifeline
        startYear={projectStartYear}
        startMonth={projectStartMonth}
        endYear={projectEndYear}
        endMonth={projectEndMonth}
        onChangeDates={handleChangeDates}
      />

      {/* Column progress bar */}
      <ProgressBar cards={cards} totalEstimated={totalEstimated} />

      {/* Header row: counter */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        height: 44,
      }}>
        <Popover
          content={totalPopoverContent}
          title="Set total estimated DPKs"
          trigger="click"
          open={editTotal}
          onOpenChange={open => {
            setEditTotal(open);
            if (open) setEditValue(totalEstimated);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, cursor: 'pointer' }}>
            <span style={{
              fontSize: 'clamp(20px, 2.2vw, 32px)',
              fontWeight: 800,
              color: '#1a1a2e',
              lineHeight: 1,
            }}>
              {cards.length}
            </span>
            <span style={{
              fontSize: 'clamp(13px, 1.2vw, 18px)',
              fontWeight: 400,
              color: '#666',
              lineHeight: 1,
            }}>
              of {totalEstimated} DPKs groomed
            </span>
            <EditOutlined style={{ fontSize: 'clamp(13px, 1.1vw, 17px)', color: '#aaa', marginLeft: 2 }} />
          </div>
        </Popover>
      </div>

      {/* Kanban board */}
      <KanbanBoard
        cards={cards}
        onCardsChange={setCards}
        onDeleteCard={deleteCard}
      />

      {/* FAB */}
      <AddCardModal onAdd={addCard} onImport={setCards} />
    </div>
  );
}
