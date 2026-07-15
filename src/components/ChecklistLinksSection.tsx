import { useState, useEffect } from 'react';
import { Button, Select, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { ColumnConfig, CardTemplateChecklistLink, InstanceCreationTrigger } from '../types';
import { useAuth } from '../AuthContext';
import { subscribeAvailableTemplates } from '../utils/checklistIntegration';
import type { SclTemplateSummary } from '../utils/checklistIntegration';
import { MAX_CHECKLIST_LINKS } from '../constants';

interface Props {
  links: CardTemplateChecklistLink[];
  columns: ColumnConfig[];
  onChange: (links: CardTemplateChecklistLink[]) => void;
}

const TRIGGER_LABEL: Record<InstanceCreationTrigger['kind'], string> = {
  onCardCreation: 'On card creation',
  onColumnEntry: 'On entering column',
  onDemand: 'On demand only',
};

export function ChecklistLinksSection({ links, columns, onChange }: Props) {
  const { user } = useAuth();
  const [availableTemplates, setAvailableTemplates] = useState<SclTemplateSummary[]>([]);
  const [pickTemplateId, setPickTemplateId] = useState<string | undefined>(undefined);
  const [pickTrigger, setPickTrigger] = useState<InstanceCreationTrigger['kind']>('onDemand');
  const [pickColumnId, setPickColumnId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    return subscribeAvailableTemplates(user.uid, setAvailableTemplates);
  }, [user]);

  function addLink() {
    if (!user || !pickTemplateId) return;
    const template = availableTemplates.find(t => t.id === pickTemplateId);
    if (!template) return;
    let trigger: InstanceCreationTrigger;
    if (pickTrigger === 'onColumnEntry' && pickColumnId) trigger = { kind: 'onColumnEntry', columnId: pickColumnId };
    else if (pickTrigger === 'onCardCreation') trigger = { kind: 'onCardCreation' };
    else trigger = { kind: 'onDemand' };
    const link: CardTemplateChecklistLink = {
      id: crypto.randomUUID(),
      templateId: template.id,
      templateName: template.name,
      trigger,
      linkedAt: Date.now(),
      linkedByUid: user.uid,
    };
    onChange([...links, link]);
    setPickTemplateId(undefined);
    setPickTrigger('onDemand');
    setPickColumnId(undefined);
  }

  const linkedTemplateIds = new Set(links.map(l => l.templateId));
  const pickableTemplates = availableTemplates.filter(t => !linkedTemplateIds.has(t.id));

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555' }}>Simple Checklists</div>
      <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>
        Link up to {MAX_CHECKLIST_LINKS} checklist templates. Each linked template can add a tracked checklist instance to every card.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        {links.map(link => {
          const trigger = link.trigger;
          const columnLabel = trigger.kind === 'onColumnEntry' ? columns.find(c => c.id === trigger.columnId)?.label ?? '?' : null;
          return (
            <div key={link.id} style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid #eee', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.templateName}</div>
                <Tag style={{ marginTop: 2 }}>{TRIGGER_LABEL[trigger.kind]}{columnLabel ? `: ${columnLabel}` : ''}</Tag>
              </div>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onChange(links.filter(l => l.id !== link.id))} />
            </div>
          );
        })}
      </div>

      {links.length < MAX_CHECKLIST_LINKS && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Select
            size="small" placeholder="Choose a checklist template…"
            value={pickTemplateId} onChange={setPickTemplateId}
            options={pickableTemplates.map(t => ({ value: t.id, label: t.name }))}
          />
          <Select
            size="small" value={pickTrigger} onChange={setPickTrigger}
            options={[
              { value: 'onCardCreation', label: 'Create instance when a card is created' },
              { value: 'onColumnEntry', label: 'Create instance when a card enters a column' },
              { value: 'onDemand', label: 'Only create on demand (from the card)' },
            ]}
          />
          {pickTrigger === 'onColumnEntry' && (
            <Select
              size="small" placeholder="Which column?" value={pickColumnId} onChange={setPickColumnId}
              options={columns.map(c => ({ value: c.id, label: c.label }))}
            />
          )}
          <Button size="small" onClick={addLink} disabled={!pickTemplateId || (pickTrigger === 'onColumnEntry' && !pickColumnId)}>
            Add checklist
          </Button>
        </div>
      )}
    </div>
  );
}
