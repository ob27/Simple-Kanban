import { useState, useEffect } from 'react';
import { Button, Spin, Popover } from 'antd';
import { InfoCircleOutlined, RightOutlined, PlusOutlined } from '@ant-design/icons';
import type { CardTemplateChecklistLink, CardChecklistInstanceRef } from '../types';
import { subscribeInstanceSummary, getTemplateDescription } from '../utils/checklistIntegration';
import type { SclInstanceSummary, SclCheckItemComponent } from '../utils/checklistIntegration';

interface Props {
  links: CardTemplateChecklistLink[];
  refs: CardChecklistInstanceRef[];
  readOnly?: boolean;
  onCreateOnDemand: (link: CardTemplateChecklistLink) => void;
  creatingLinkId?: string | null;
}

function DescriptionInfoButton({ templateId }: { templateId: string }) {
  const [description, setDescription] = useState<string | null | undefined>(undefined);

  function handleOpenChange(open: boolean) {
    if (open && description === undefined) {
      getTemplateDescription(templateId).then(d => setDescription(d || null));
    }
  }

  return (
    <Popover
      trigger="click"
      onOpenChange={handleOpenChange}
      content={<div style={{ maxWidth: 240, fontSize: 12, color: '#555' }}>
        {description === undefined ? <Spin size="small" /> : description ?? 'No description'}
      </div>}
    >
      <Button
        type="text" size="small" icon={<InfoCircleOutlined />}
        style={{ color: '#bbb', width: 20, height: 20, minWidth: 20 }}
        onClick={e => e.stopPropagation()}
      />
    </Popover>
  );
}

// A plain two-color "done vs outstanding" bar — Kanban's own ProgressBar.tsx
// is column-segmented (N colors keyed by ColumnConfig) and isn't a fit for
// this simpler done/total shape, so this is a small bespoke bar rather than
// a reuse of that component.
function ChecklistProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#eee', flex: 1 }}>
      <div style={{ flex: `0 0 ${pct}%`, background: '#4A90D9', transition: 'flex 0.3s' }} />
      <div style={{ flex: `0 0 ${100 - pct}%`, background: '#E2725C', transition: 'flex 0.3s' }} />
    </div>
  );
}

// Boolean-style components store an explicit `false` for their default
// (unchecked/off) state — a defined value, but not a DONE one — so those
// types need `value === true`, not just "has a value", or an untouched
// checkbox would count as answered. Every other type just needs a
// defined, non-null value. Not full per-type validation like Checklists'
// own isComponentValueValid (e.g. text format/min-length rules aren't
// checked here) — good enough for a lightweight card-level indicator.
const BOOLEAN_COMPONENT_TYPES = new Set(['checkpoint', 'checkbox', 'toggle']);

function isComponentAnswered(component: SclCheckItemComponent, value: unknown): boolean {
  if (BOOLEAN_COMPONENT_TYPES.has(component.type)) return value === true;
  return value !== undefined && value !== null;
}

// Progress across ALL check items, not just required ones —
// totalRequiredCount/completedRequiredCount are 0/0 for a checklist with no
// required items at all, which would otherwise hide the bar entirely even
// though there's real work left to do. An item counts as answered once
// every one of its components is answered (matches this session's own
// "composite item" model — a checkbox+namePicker item isn't done until
// both parts are filled in).
function itemProgress(summary: SclInstanceSummary): { completed: number; total: number } {
  const items = summary.versionSnapshot?.checkItems ?? [];
  const responses = summary.responses ?? {};
  const completed = items.filter(item => {
    const values = responses[item.id]?.values;
    if (!values) return false;
    return item.components.every(c => isComponentAnswered(c, values[c.id]?.value));
  }).length;
  return { completed, total: items.length };
}

function LinkedChecklistRow({ instanceId, onSummary }: { instanceId: string; onSummary: (instanceId: string, summary: SclInstanceSummary | null) => void }) {
  const [summary, setSummary] = useState<SclInstanceSummary | null | undefined>(undefined);

  useEffect(() => subscribeInstanceSummary(instanceId, s => { setSummary(s); onSummary(instanceId, s); }), [instanceId]);

  if (summary === undefined) return <Spin size="small" />;
  if (summary === null || summary.source?.orphaned) {
    return <span style={{ fontSize: 12, color: '#c0392b', fontStyle: 'italic' }}>Checklist removed</span>;
  }

  const { completed, total } = itemProgress(summary);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summary.templateName || summary.name}
          </span>
          <DescriptionInfoButton templateId={summary.templateId} />
          <span style={{ fontSize: 12, color: '#999' }}>{summary.status}</span>
        </div>
        {total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <ChecklistProgressBar completed={completed} total={total} />
            <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>{completed}/{total}</span>
          </div>
        )}
      </div>
      <Button
        type="text" size="small" icon={<RightOutlined />}
        style={{ color: '#bbb' }}
        onClick={() => window.open(`/simple-checklists/i/${instanceId}`, '_blank', 'noopener')}
      />
    </div>
  );
}

export function CardChecklistSection({ links, refs, readOnly, onCreateOnDemand, creatingLinkId }: Props) {
  const [summaries, setSummaries] = useState<Record<string, SclInstanceSummary | null>>({});

  if (links.length === 0) return null;

  const resolvedSummaries = Object.values(summaries).filter((s): s is SclInstanceSummary => !!s && !s.source?.orphaned);
  const completeCount = resolvedSummaries.filter(s => s.status === 'complete').length;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Checklists
        </span>
        {resolvedSummaries.length > 0 && (
          <span style={{ fontSize: 12, color: '#888' }}>{completeCount} of {resolvedSummaries.length} Complete</span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {links.map(link => {
          const ref = refs.find(r => r.linkId === link.id);
          return (
            <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9f9fb', borderRadius: 8, padding: '8px 12px' }}>
              {ref ? (
                <LinkedChecklistRow instanceId={ref.instanceId} onSummary={(id, s) => setSummaries(prev => ({ ...prev, [id]: s }))} />
              ) : (
                <>
                  <div style={{ flex: 1, fontSize: 13, color: '#888' }}>{link.templateName}</div>
                  {!readOnly && (
                    <Button size="small" icon={<PlusOutlined />} loading={creatingLinkId === link.id} onClick={() => onCreateOnDemand(link)}>
                      Add
                    </Button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
