import { useState } from 'react';
import { Modal, Checkbox, Input, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { KanbanCard } from '../types';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface Props {
  open: boolean;
  cards: KanbanCard[];
  activeFilter: Set<string>;
  onFilterChange: (filter: Set<string>) => void;
  onClose: () => void;
}

export function PillFilterModal({ open, cards, activeFilter, onFilterChange, onClose }: Props) {
  const [search, setSearch] = useState('');
  const { isMobile } = useBreakpoint();

  const pillCounts = new Map<string, number>();
  for (const card of cards) {
    if (card.pillValue) {
      pillCounts.set(card.pillValue, (pillCounts.get(card.pillValue) ?? 0) + 1);
    }
  }

  const allPills = [...pillCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));

  const visible = search.trim()
    ? allPills.filter(p => p.value.toLowerCase().includes(search.toLowerCase()))
    : allPills;

  function toggle(value: string) {
    const next = new Set(activeFilter);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onFilterChange(next);
  }

  function clearAll() {
    onFilterChange(new Set());
  }

  function selectAll() {
    onFilterChange(new Set(allPills.map(p => p.value)));
  }

  const cardsWithoutPills = cards.filter(c => !c.pillValue).length;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Filter by pill value</span>
          {activeFilter.size > 0 && (
            <span style={{ fontSize: 12, fontWeight: 400, color: '#1677ff', background: '#e6f4ff', borderRadius: 10, padding: '1px 8px' }}>
              {activeFilter.size} active
            </span>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" onClick={selectAll} disabled={allPills.length === 0 || activeFilter.size === allPills.length}>
              Select all
            </Button>
            <Button size="small" onClick={clearAll} disabled={activeFilter.size === 0}>
              Clear filter
            </Button>
          </div>
          <Button type="primary" onClick={onClose}>Done</Button>
        </div>
      }
      width={isMobile ? 'calc(100vw - 24px)' : 440}
    >
      {allPills.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#aaa', padding: '24px 0', fontSize: 13 }}>
          No cards have pill values yet.
        </div>
      ) : (
        <>
          {allPills.length > 8 && (
            <Input
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              placeholder="Search pill values…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: 12 }}
              allowClear
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 380, overflowY: 'auto' }}>
            {visible.map(p => (
              <div
                key={p.value}
                onClick={() => toggle(p.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8,
                  background: activeFilter.has(p.value) ? '#EEF4FF' : '#f9f9fb',
                  border: `1px solid ${activeFilter.has(p.value) ? '#1677ff40' : 'transparent'}`,
                  cursor: 'pointer', transition: 'background 0.1s, border-color 0.1s',
                  userSelect: 'none',
                }}
              >
                <Checkbox
                  checked={activeFilter.has(p.value)}
                  onChange={() => toggle(p.value)}
                  onClick={e => e.stopPropagation()}
                />
                <span style={{ flex: 1, fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.value}
                </span>
                <span style={{ fontSize: 12, color: '#aaa', flexShrink: 0 }}>
                  {p.count} card{p.count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
            {visible.length === 0 && (
              <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, padding: '16px 0' }}>
                No matching values
              </div>
            )}
          </div>
          {activeFilter.size > 0 && cardsWithoutPills > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#aaa', borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
              {cardsWithoutPills} card{cardsWithoutPills !== 1 ? 's' : ''} without a pill value {cardsWithoutPills === 1 ? 'is' : 'are'} hidden while filter is active.
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
