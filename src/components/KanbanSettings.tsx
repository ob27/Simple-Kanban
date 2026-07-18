import { useState, useEffect, useRef } from 'react';
import { Drawer, Button, Input, Form, InputNumber, Popconfirm, message, Select, Tooltip, Switch, Popover } from 'antd';
const { TextArea } = Input;
import { CopyOutlined, ReloadOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, PrinterOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { Kanban, AssignmentDefinition, CardTemplateChecklistLink } from '../types';
import { regenerateInvite } from '../store';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { uploadKanbanLogo, deleteKanbanLogo } from '../utils/logoUpload';
import { buildKanbanInviteUrl } from '../utils/inviteLink';
import { MAX_ATTACHMENTS_BYTES, MAX_USER_ATTACHMENTS_BYTES, MAX_ASSIGNMENT_DEFINITIONS, formatBytes } from '../constants';
import { ChecklistLinksSection } from './ChecklistLinksSection';

const MONTH_OPTIONS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
].map((label, i) => ({ label, value: i }));

const YEAR_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const y = 2018 + i;
  return { label: String(y), value: y };
});

interface Props {
  open: boolean;
  kanban: Kanban;
  onClose: () => void;
  onChange: (kanban: Kanban) => void;
  onDelete: () => void;
  onExportCSV: () => void;
  onPrintReport: () => void;
  onDuplicate: () => void;
  folderLogoUrl?: string | null;
  accountAttachmentsBytes?: number;
}

// A live example of exactly what a stale/very-stale card actually looks
// like (same emoji + same kc-smoke/kc-flame keyframes as the real card face
// in KanbanCard.tsx) — "stale" isn't a self-explanatory word on its own, so
// people were reasonably reluctant to turn a setting on without knowing
// what it would visibly do to their board.
function StaleExampleCard({ label, emoji, style }: { label: string; emoji: string; style: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: 84, height: 40, background: '#fff', border: '1px solid #eee', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ position: 'absolute', top: -6, right: 6 }}>
          <span style={{ fontSize: 14, display: 'inline-block', ...style }}>{emoji}</span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: '#999' }}>{label}</span>
    </div>
  );
}

function StaleExamplePopoverContent() {
  return (
    <div style={{ maxWidth: 240 }}>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
        A card that hasn't moved in the given number of days gets a small animated icon in its corner — nothing else changes.
      </div>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
        <StaleExampleCard label="Stale" emoji="💨" style={{ opacity: 0.5, animation: 'kc-smoke 2.4s ease-in infinite' }} />
        <StaleExampleCard label="Very stale (2×)" emoji="🔥" style={{ animation: 'kc-flame 0.6s ease-in-out infinite', filter: 'drop-shadow(0 0 4px rgba(255,120,0,0.8))' }} />
      </div>
    </div>
  );
}

export function KanbanSettings({ open, kanban, onClose, onChange, onDelete, onExportCSV, onPrintReport, onDuplicate, folderLogoUrl, accountAttachmentsBytes }: Props) {
  const [form] = Form.useForm();
  const [regenerating, setRegenerating] = useState(false);
  const [columnColors, setColumnColors] = useState<string[]>([]);
  const [columnDescriptions, setColumnDescriptions] = useState<string[]>([]);
  const [columnMaxCards, setColumnMaxCards] = useState<Array<number | undefined>>([]);
  const [kanbanLogoUrl, setKanbanLogoUrl] = useState<string | undefined>(undefined);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [staleAfterDaysValue, setStaleAfterDaysValue] = useState<number | undefined>(undefined);
  const [assignmentDefs, setAssignmentDefs] = useState<AssignmentDefinition[]>([]);
  const [checklistLinks, setChecklistLinks] = useState<CardTemplateChecklistLink[]>([]);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    if (open) {
      setColumnColors(kanban.columns.map(c => c.color));
      setColumnDescriptions(kanban.columns.map(c => c.description ?? ''));
      setColumnMaxCards(kanban.columns.map(c => c.maxCards));
      setKanbanLogoUrl(kanban.kanbanLogoUrl);
      setStaleAfterDaysValue(kanban.staleAfterDays);
      setAssignmentDefs(kanban.assignmentDefinitions ?? []);
      setChecklistLinks(kanban.cardTemplateChecklistLinks ?? []);
      form.setFieldsValue({
        name: kanban.name,
        totalEstimated: kanban.totalEstimated,
        projectStartYear: kanban.projectStartYear,
        projectStartMonth: kanban.projectStartMonth,
        projectEndYear: kanban.projectEndYear,
        projectEndMonth: kanban.projectEndMonth,
        backlogColumnId: kanban.backlogColumnId ?? kanban.columns[0]?.id,
        groomedColumnId: kanban.groomedColumnId ?? kanban.columns[2]?.id,
        doneColumnId: kanban.doneColumnId ?? kanban.columns[5]?.id,
        showProgressBar: kanban.showProgressBar ?? true,
        showLifeline: kanban.showLifeline ?? true,
        showLogo: kanban.showLogo ?? false,
        showKanbanLogo: kanban.showKanbanLogo ?? false,
        showFolderLogo: kanban.showFolderLogo ?? false,
        showSearchBar: kanban.showSearchBar ?? false,
        showShareCluster: kanban.showShareCluster ?? false,
        wrapCardText: kanban.wrapCardText ?? false,
        cardFontSize: kanban.cardFontSize ?? 15,
        showStoryPoints: kanban.showStoryPoints ?? false,
        showAssignmentsOnCard: kanban.showAssignmentsOnCard ?? false,
        accoladesEnabled: kanban.accoladesEnabled ?? true,
        commentSortOrder: kanban.commentSortOrder ?? 'oldest',
        showHistory: kanban.showHistory ?? false,
        ...Object.fromEntries(kanban.columns.map((c, i) => [`col_${i}`, c.label])),
      });
    }
  }, [open, kanban, form]);

  function handleSave() {
    const vals = form.getFieldsValue();
    const updatedColumns = kanban.columns.map((col, i) => ({
      ...col,
      label: (vals[`col_${i}`] as string) || col.label,
      color: columnColors[i] ?? col.color,
      description: columnDescriptions[i] ?? col.description ?? '',
      maxCards: columnMaxCards[i] ?? undefined,
    }));
    // Blank rows (never given a label) are dropped rather than saved as
    // empty definitions. Deleted definitions are NOT cleaned up off
    // existing cards here — cardAssignments referencing a since-removed id
    // just stop rendering anywhere (see CardNotesModal.tsx/KanbanCard.tsx),
    // which avoids this save also having to rewrite every card's data.
    const cleanedAssignmentDefs = assignmentDefs
      .filter(d => d.label.trim())
      .slice(0, MAX_ASSIGNMENT_DEFINITIONS)
      .map(d => ({ ...d, label: d.label.trim() }));
    onChange({
      ...kanban,
      name: vals.name as string,
      totalEstimated: vals.totalEstimated as number,
      projectStartYear: vals.projectStartYear as number,
      projectStartMonth: vals.projectStartMonth as number,
      projectEndYear: vals.projectEndYear as number,
      projectEndMonth: vals.projectEndMonth as number,
      backlogColumnId: vals.backlogColumnId as string,
      groomedColumnId: vals.groomedColumnId as string,
      doneColumnId: vals.doneColumnId as string,
      showProgressBar: vals.showProgressBar as boolean,
      showLifeline: vals.showLifeline as boolean,
      showLogo: vals.showLogo as boolean,
      showKanbanLogo: vals.showKanbanLogo as boolean,
      showFolderLogo: vals.showFolderLogo as boolean,
      showSearchBar: vals.showSearchBar as boolean,
      showShareCluster: vals.showShareCluster as boolean,
      wrapCardText: vals.wrapCardText as boolean,
      kanbanLogoUrl,
      cardFontSize: vals.cardFontSize as number,
      showStoryPoints: vals.showStoryPoints as boolean,
      showAssignmentsOnCard: vals.showAssignmentsOnCard as boolean,
      accoladesEnabled: vals.accoladesEnabled as boolean,
      commentSortOrder: vals.commentSortOrder as 'newest' | 'oldest',
      showHistory: vals.showHistory as boolean,
      staleAfterDays: staleAfterDaysValue,
      columns: updatedColumns,
      assignmentDefinitions: cleanedAssignmentDefs.length ? cleanedAssignmentDefs : undefined,
      cardTemplateChecklistLinks: checklistLinks.length ? checklistLinks : undefined,
    });
    onClose();
  }

  const inviteUrl = buildKanbanInviteUrl(kanban);

  function copyInvite() {
    navigator.clipboard.writeText(inviteUrl);
    message.success('Invite link copied');
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const updated = await regenerateInvite(kanban);
      onChange(updated);
      message.success('New invite link generated');
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Drawer
      title="Kanban Settings"
      open={open}
      onClose={onClose}
      width={isMobile ? '100vw' : 420}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSave}>Save</Button>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        {/* Name */}
        <Form.Item name="name" label="Kanban name" rules={[{ required: true }]}>
          <Input size="large" />
        </Form.Item>

        {/* Columns */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>Columns</div>
        {kanban.columns.map((col, i) => (
          <div key={col.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Color swatch + hidden native color picker */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
                    background: columnColors[i] ?? col.color,
                    border: '2px solid rgba(0,0,0,0.12)',
                    boxSizing: 'border-box',
                  }}
                  onClick={() => document.getElementById(`col-color-${i}`)?.click()}
                />
                <input
                  id={`col-color-${i}`}
                  type="color"
                  value={columnColors[i] ?? col.color}
                  onChange={e => {
                    const next = [...columnColors];
                    next[i] = e.target.value;
                    setColumnColors(next);
                  }}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                />
              </div>
              <Form.Item name={`col_${i}`} style={{ marginBottom: 0, flex: 1 }}>
                <Input size="middle" />
              </Form.Item>
            </div>
            <div style={{ marginLeft: 36, marginTop: 6 }}>
              <TextArea
                value={columnDescriptions[i] ?? ''}
                onChange={e => {
                  const next = [...columnDescriptions];
                  next[i] = e.target.value;
                  setColumnDescriptions(next);
                }}
                placeholder="Column description (optional)"
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{ fontSize: 12, color: '#555', width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 36, marginTop: 6 }}>
              <Switch
                size="small"
                checked={columnMaxCards[i] !== undefined}
                onChange={on => {
                  const next = [...columnMaxCards];
                  next[i] = on ? 10 : undefined;
                  setColumnMaxCards(next);
                }}
              />
              <span style={{ fontSize: 12, color: '#888' }}>Limit visible cards</span>
              {columnMaxCards[i] !== undefined && (
                <InputNumber
                  min={1} max={999} size="small"
                  value={columnMaxCards[i]}
                  onChange={v => {
                    const next = [...columnMaxCards];
                    next[i] = v ?? 1;
                    setColumnMaxCards(next);
                  }}
                  style={{ width: 64 }}
                />
              )}
            </div>
          </div>
        ))}

        {/* Column roles */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>Column roles</div>
        <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>Used to calculate groomed % and complete %</div>
        {(['backlogColumnId', 'groomedColumnId', 'doneColumnId'] as const).map((field, i) => (
          <Form.Item key={field} name={field} label={['Backlog', 'Groomed', 'Done'][i]} style={{ marginBottom: 10 }}>
            <Select options={kanban.columns.map(c => ({ value: c.id, label: c.label }))} />
          </Form.Item>
        ))}

        {/* Assignments */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>Assignments</div>
        <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>
          Define up to {MAX_ASSIGNMENT_DEFINITIONS} responsibility labels (e.g. &quot;Asset Manager&quot;) that can be assigned per card.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          {assignmentDefs.map((def, i) => (
            <div key={def.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Input
                value={def.label}
                placeholder={`Assignment ${i + 1} (e.g. Asset Manager)`}
                onChange={e => setAssignmentDefs(prev => prev.map(d => d.id === def.id ? { ...d, label: e.target.value } : d))}
                style={{ flex: 1 }}
              />
              <Button
                size="small" type="text" danger icon={<DeleteOutlined />}
                onClick={() => setAssignmentDefs(prev => prev.filter(d => d.id !== def.id))}
              />
            </div>
          ))}
          <Button
            size="small"
            disabled={assignmentDefs.length >= MAX_ASSIGNMENT_DEFINITIONS}
            onClick={() => setAssignmentDefs(prev => [...prev, { id: crypto.randomUUID(), label: '' }])}
            style={{ alignSelf: 'flex-start' }}
          >
            + Add assignment{assignmentDefs.length >= MAX_ASSIGNMENT_DEFINITIONS ? ` (max ${MAX_ASSIGNMENT_DEFINITIONS})` : ''}
          </Button>
        </div>

        {/* Simple Checklists integration */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <ChecklistLinksSection links={checklistLinks} columns={kanban.columns} onChange={setChecklistLinks} />
        </div>

        {/* Visibility */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>Board sections</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Form.Item name="showProgressBar" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
            <span style={{ fontSize: 13, color: '#555' }}>Show progress bar</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Form.Item name="showLifeline" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
            <span style={{ fontSize: 13, color: '#555' }}>Show project lifeline</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Form.Item name="showLogo" valuePropName="checked" noStyle>
              <Switch
                size="small"
                onChange={v => { if (v) form.setFieldValue('showKanbanLogo', false); }}
              />
            </Form.Item>
            <span style={{ fontSize: 13, color: '#555' }}>Show workspace logo</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Form.Item name="showKanbanLogo" valuePropName="checked" noStyle>
              <Switch
                size="small"
                onChange={v => { if (v) { form.setFieldValue('showLogo', false); form.setFieldValue('showFolderLogo', false); } }}
              />
            </Form.Item>
            <span style={{ fontSize: 13, color: '#555' }}>Show kanban logo</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tooltip title={!folderLogoUrl ? 'Set a folder icon in the gallery first' : undefined}>
              <span style={{ display: 'inline-flex', cursor: !folderLogoUrl ? 'not-allowed' : undefined }}>
                <Form.Item name="showFolderLogo" valuePropName="checked" noStyle>
                  <Switch
                    size="small"
                    disabled={!folderLogoUrl}
                    style={!folderLogoUrl ? { pointerEvents: 'none' } : undefined}
                    onChange={v => { if (v) { form.setFieldValue('showLogo', false); form.setFieldValue('showKanbanLogo', false); } }}
                  />
                </Form.Item>
              </span>
            </Tooltip>
            <span style={{ fontSize: 13, color: folderLogoUrl ? '#555' : '#bbb' }}>Show folder icon</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Form.Item name="showSearchBar" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
            <span style={{ fontSize: 13, color: '#555' }}>Show card search bar</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Form.Item name="showShareCluster" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
            <span style={{ fontSize: 13, color: '#555' }}>Show member avatars & invite</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Form.Item name="showStoryPoints" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
            <span style={{ fontSize: 13, color: '#555' }}>Show story points</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Form.Item name="showAssignmentsOnCard" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
            <span style={{ fontSize: 13, color: '#555' }}>Show assignments on card face</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Form.Item name="accoladesEnabled" valuePropName="checked" noStyle>
              <Switch size="small" />
            </Form.Item>
            <span style={{ fontSize: 13, color: '#555' }}>Celebrate card moves (confetti)</span>
          </div>
        </div>

        {/* Stale cards */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#555' }}>Card staleness</span>
          <Popover content={<StaleExamplePopoverContent />} trigger="click" placement="right">
            <InfoCircleOutlined style={{ color: '#bbb', cursor: 'pointer', fontSize: 13 }} />
          </Popover>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Switch
            size="small"
            checked={staleAfterDaysValue !== undefined}
            onChange={on => setStaleAfterDaysValue(on ? 7 : undefined)}
          />
          <span style={{ fontSize: 13, color: '#555' }}>Flag stale cards</span>
          {staleAfterDaysValue !== undefined && (
            <>
              <span style={{ fontSize: 12, color: '#888' }}>after</span>
              <InputNumber
                min={1} max={365} size="small"
                value={staleAfterDaysValue}
                onChange={v => setStaleAfterDaysValue(v ?? 1)}
                style={{ width: 64 }}
              />
              <span style={{ fontSize: 12, color: '#888' }}>days without moving</span>
            </>
          )}
        </div>

        {/* Kanban logo upload */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0', marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 8 }}>Kanban logo</div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            Upload a logo specific to this kanban. Appears above the progress bar when &quot;Show kanban logo&quot; is on.
          </div>
          {kanbanLogoUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 10px', background: '#EEF0F5', borderRadius: 8 }}>
              <img src={kanbanLogoUrl} alt="kanban logo" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={uploadingLogo}
                onClick={async () => {
                  setUploadingLogo(true);
                  try {
                    await deleteKanbanLogo(kanban.id);
                    setKanbanLogoUrl(undefined);
                    form.setFieldValue('showKanbanLogo', false);
                    message.success('Kanban logo removed');
                  } catch {
                    message.error('Failed to remove logo');
                  } finally {
                    setUploadingLogo(false);
                  }
                }}
              >Remove</Button>
            </div>
          )}
          <input
            ref={logoFileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.svg,.webp"
            style={{ display: 'none' }}
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploadingLogo(true);
              try {
                const url = await uploadKanbanLogo(kanban.id, file);
                setKanbanLogoUrl(url);
                form.setFieldValue('showKanbanLogo', true);
                form.setFieldValue('showLogo', false);
                message.success('Logo uploaded');
              } catch {
                message.error('Upload failed — check Firebase Storage rules');
              } finally {
                setUploadingLogo(false);
                e.target.value = '';
              }
            }}
          />
          <Button
            icon={<UploadOutlined />}
            size="small"
            loading={uploadingLogo}
            onClick={() => logoFileRef.current?.click()}
          >
            {kanbanLogoUrl ? 'Replace logo' : 'Upload logo'}
          </Button>
        </div>

        {/* Card font size */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>Card title size</div>
        <Form.Item name="cardFontSize" style={{ marginBottom: 10 }}>
          <Select
            options={[
              { value: 11, label: 'Extra small (11px) — for longer titles' },
              { value: 13, label: 'Small (13px)' },
              { value: 15, label: 'Medium (15px) — default' },
              { value: 18, label: 'Large (18px)' },
              { value: 22, label: 'Extra large (22px) — for short titles' },
            ]}
          />
        </Form.Item>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Form.Item name="wrapCardText" valuePropName="checked" noStyle>
            <Switch size="small" />
          </Form.Item>
          <span style={{ fontSize: 13, color: '#555' }}>Wrap card text</span>
        </div>

        {/* Comments */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>Comments</div>
        <Form.Item name="commentSortOrder" label="Sort order on cards" style={{ marginBottom: 10 }}>
          <Select
            options={[
              { value: 'oldest', label: 'Oldest first' },
              { value: 'newest', label: 'Newest first' },
            ]}
          />
        </Form.Item>

        {/* History */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>History</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Form.Item name="showHistory" valuePropName="checked" noStyle>
            <Switch size="small" />
          </Form.Item>
          <span style={{ fontSize: 13, color: '#555' }}>Show board history tab</span>
        </div>

        {/* Timeline */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>Timeline</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Form.Item name="projectStartMonth" label="Start month">
            <Select options={MONTH_OPTIONS} />
          </Form.Item>
          <Form.Item name="projectStartYear" label="Start year">
            <Select options={YEAR_OPTIONS} />
          </Form.Item>
          <Form.Item name="projectEndMonth" label="End month">
            <Select options={MONTH_OPTIONS} />
          </Form.Item>
          <Form.Item name="projectEndYear" label="End year">
            <Select options={YEAR_OPTIONS} />
          </Form.Item>
        </div>

        {/* Total estimated */}
        <Form.Item name="totalEstimated" label="Total estimated cards">
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>

        {/* Invite */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>Invite link</div>
        <div style={{
          background: '#f5f5f5', borderRadius: 8, padding: '10px 12px',
          fontSize: 12, color: '#555', wordBreak: 'break-all', marginBottom: 8,
        }}>
          {inviteUrl}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<CopyOutlined />} onClick={copyInvite} style={{ flex: 1 }}>Copy link</Button>
          <Tooltip title="Generate a new link (invalidates the old one)">
            <Button icon={<ReloadOutlined />} loading={regenerating} onClick={handleRegenerate}>New link</Button>
          </Tooltip>
        </div>

        {/* Export */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 8 }}>Export</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={<DownloadOutlined />} block onClick={onExportCSV}>
              Export as CSV
            </Button>
            <Button icon={<PrinterOutlined />} block onClick={onPrintReport}>
              Print / PDF
            </Button>
          </div>
        </div>

        {/* Storage */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 4 }}>Attachment storage</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {formatBytes(kanban.attachmentsBytes ?? 0)} of {formatBytes(MAX_ATTACHMENTS_BYTES)} used on this board
          </div>
          {accountAttachmentsBytes !== undefined && (
            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
              {formatBytes(accountAttachmentsBytes)} of {formatBytes(MAX_USER_ATTACHMENTS_BYTES)} used across your account
            </div>
          )}
        </div>

        {/* Duplicate */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <Button icon={<CopyOutlined />} block onClick={onDuplicate}>
            Duplicate this kanban
          </Button>
        </div>

        {/* Danger zone */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#ff4d4f', marginBottom: 8 }}>Danger zone</div>
          <Popconfirm
            title="Delete this kanban?"
            description="This will permanently delete the kanban and all its cards."
            onConfirm={onDelete}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} block>Delete Kanban</Button>
          </Popconfirm>
        </div>
      </Form>
    </Drawer>
  );
}
