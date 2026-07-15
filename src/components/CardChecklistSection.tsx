import { useState, useEffect } from 'react';
import { Button, Spin } from 'antd';
import { ExportOutlined, PlusOutlined } from '@ant-design/icons';
import type { CardTemplateChecklistLink, CardChecklistInstanceRef } from '../types';
import { subscribeInstanceSummary } from '../utils/checklistIntegration';
import type { SclInstanceSummary } from '../utils/checklistIntegration';

interface Props {
  links: CardTemplateChecklistLink[];
  refs: CardChecklistInstanceRef[];
  readOnly?: boolean;
  onCreateOnDemand: (link: CardTemplateChecklistLink) => void;
  creatingLinkId?: string | null;
}

function LinkedChecklistRow({ instanceId }: { instanceId: string }) {
  const [summary, setSummary] = useState<SclInstanceSummary | null | undefined>(undefined);

  useEffect(() => subscribeInstanceSummary(instanceId, setSummary), [instanceId]);

  if (summary === undefined) return <Spin size="small" />;
  if (summary === null || summary.source?.orphaned) {
    return <span style={{ fontSize: 12, color: '#c0392b', fontStyle: 'italic' }}>Checklist removed</span>;
  }
  const outstanding = summary.totalRequiredCount
    ? `${(summary.totalRequiredCount ?? 0) - (summary.completedRequiredCount ?? 0)} outstanding`
    : summary.status;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.name}</div>
        <div style={{ fontSize: 11, color: '#888' }}>{outstanding}</div>
      </div>
      <Button
        size="small" icon={<ExportOutlined />}
        onClick={() => window.open(`/simple-checklists/i/${instanceId}`, '_blank', 'noopener')}
      >
        Open
      </Button>
    </div>
  );
}

export function CardChecklistSection({ links, refs, readOnly, onCreateOnDemand, creatingLinkId }: Props) {
  if (links.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
        Checklists
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {links.map(link => {
          const ref = refs.find(r => r.linkId === link.id);
          return (
            <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9f9fb', borderRadius: 8, padding: '8px 12px' }}>
              {ref ? (
                <LinkedChecklistRow instanceId={ref.instanceId} />
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
