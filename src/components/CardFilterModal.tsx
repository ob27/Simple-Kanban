import { useState } from 'react';
import { Modal, Checkbox, Input, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { KanbanCard, AssignmentDefinition } from '../types';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface Props {
  open: boolean;
  cards: KanbanCard[];
  assignmentDefinitions?: AssignmentDefinition[];
  memberDisplayNameByUid?: Record<string, string>;
  activeFilter: Set<string>;
  onFilterChange: (filter: Set<string>) => void;
  onClose: () => void;
}

// Composite keys disambiguate the two filter dimensions sharing one Set:
// 'pill:<value>' for pillValue, 'assign:<definitionId>:<uid-or-text>' for an
// assignment. Exported so BoardPage's filteredCards predicate builds/reads
// the exact same keys.
export function pillFilterKey(value: string): string {
  return `pill:${value}`;
}
export function assignmentFilterKey(definitionId: string, valueKey: string): string {
  return `assign:${definitionId}:${valueKey}`;
}

interface FilterEntry {
  key: string;
  label: string;
  count: number;
}

export function CardFilterModal({ open, cards, assignmentDefinitions, memberDisplayNameByUid, activeFilter, onFilterChange, onClose }: Props) {
  const [search, setSearch] = useState('');
  const { isMobile } = useBreakpoint();

  const pillCounts = new Map<string, number>();
  for (const card of cards) {
    if (card.pillValue) pillCounts.set(card.pillValue, (pillCounts.get(card.pillValue) ?? 0) + 1);
  }
  const pillEntries: FilterEntry[] = [...pillCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ key: pillFilterKey(value), label: value, count }));

  // One group per assignment definition, each grouping its own distinct
  // values (member uid or free text) across every card — mirrors pill
  // counting above but keyed per-definition since the same uid/text under
  // a different definition is a different filter option.
  const assignmentGroups = (assignmentDefinitions ?? []).map(def => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const card of cards) {
      const val = card.cardAssignments?.[def.id];
      if (!val) continue;
      const valueKey = val.kind === 'member' ? val.uid : `text:${val.text}`;
      const label = val.kind === 'member' ? (memberDisplayNameByUid?.[val.uid] || val.uid) : val.text;
      const existing = counts.get(valueKey);
      counts.set(valueKey, { label, count: (existing?.count ?? 0) + 1 });
    }
    const entries: FilterEntry[] = [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label))
      .map(([valueKey, { label, count }]) => ({ key: assignmentFilterKey(def.id, valueKey), label, count }));
    return { def, entries };
  }).filter(g => g.entries.length > 0);

  const allEntries = [...pillEntries, ...assignmentGroups.flatMap(g => g.entries)];

  function toggle(key: string) {
    const next = new Set(activeFilter);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onFilterChange(next);
  }

  function clearAll() {
    onFilterChange(new Set());
  }

  function selectAll() {
    onFilterChange(new Set(allEntries.map(e => e.key)));
  }

  const matchesSearch = (label: string) => !search.trim() || label.toLowerCase().includes(search.trim().toLowerCase());

  function renderEntry(entry: FilterEntry) {
    return (
      <div
        key={entry.key}
        onClick={() => toggle(entry.key)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', borderRadius: 8,
          background: activeFilter.has(entry.key) ? '#EEF4FF' : '#f9f9fb',
          border: `1px solid ${activeFilter.has(entry.key) ? '#1677ff40' : 'transparent'}`,
          cursor: 'pointer', transition: 'background 0.1s, border-color 0.1s',
          userSelect: 'none',
        }}
      >
        <Checkbox
          checked={activeFilter.has(entry.key)}
          onChange={() => toggle(entry.key)}
          onClick={e => e.stopPropagation()}
        />
        <span style={{ flex: 1, fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.label}
        </span>
        <span style={{ fontSize: 12, color: '#aaa', flexShrink: 0 }}>
          {entry.count} card{entry.count !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  const visiblePills = pillEntries.filter(p => matchesSearch(p.label));
  const visibleGroups = assignmentGroups
    .map(g => ({ ...g, entries: g.entries.filter(e => matchesSearch(e.label)) }))
    .filter(g => g.entries.length > 0);
  const cardsWithoutPills = cards.filter(c => !c.pillValue).length;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Filter cards</span>
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
            <Button size="small" onClick={selectAll} disabled={allEntries.length === 0 || activeFilter.size === allEntries.length}>
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
      {allEntries.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#aaa', padding: '24px 0', fontSize: 13 }}>
          No cards have pill values or assignments yet.
        </div>
      ) : (
        <>
          {allEntries.length > 8 && (
            <Input
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              placeholder="Search filter values…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginBottom: 12 }}
              allowClear
            />
          )}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {visiblePills.length > 0 && (
              <div style={{ marginBottom: visibleGroups.length > 0 ? 14 : 0 }}>
                {assignmentGroups.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Pill value</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {visiblePills.map(renderEntry)}
                </div>
              </div>
            )}
            {visibleGroups.map((g, i) => (
              <div key={g.def.id} style={{ marginBottom: i < visibleGroups.length - 1 ? 14 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{g.def.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {g.entries.map(renderEntry)}
                </div>
              </div>
            ))}
            {visiblePills.length === 0 && visibleGroups.length === 0 && (
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
