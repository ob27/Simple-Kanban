import { useState, useEffect } from 'react';
import { Drawer, Button, Input, Form, InputNumber, Popconfirm, message, Select, Tooltip, Switch } from 'antd';
const { TextArea } = Input;
import { CopyOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Kanban } from '../types';
import { regenerateInvite } from '../store';
import { useBreakpoint } from '../hooks/useBreakpoint';

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
}

export function KanbanSettings({ open, kanban, onClose, onChange, onDelete }: Props) {
  const [form] = Form.useForm();
  const [regenerating, setRegenerating] = useState(false);
  const [columnColors, setColumnColors] = useState<string[]>([]);
  const [columnDescriptions, setColumnDescriptions] = useState<string[]>([]);
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    if (open) {
      setColumnColors(kanban.columns.map(c => c.color));
      setColumnDescriptions(kanban.columns.map(c => c.description ?? ''));
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
        cardFontSize: kanban.cardFontSize ?? 15,
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
    }));
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
      cardFontSize: vals.cardFontSize as number,
      columns: updatedColumns,
    });
    onClose();
  }

  const inviteUrl = `${window.location.origin}/simple-kanban/invite/${kanban.inviteToken}`;

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
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555' }}>Columns</div>
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
            <TextArea
              value={columnDescriptions[i] ?? ''}
              onChange={e => {
                const next = [...columnDescriptions];
                next[i] = e.target.value;
                setColumnDescriptions(next);
              }}
              placeholder="Column description (optional) — shown as an ℹ️ button in the column header"
              autoSize={{ minRows: 1, maxRows: 4 }}
              style={{ marginTop: 6, marginLeft: 36, fontSize: 12, color: '#666' }}
            />
          </div>
        ))}

        {/* Column roles */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 16 }}>Column roles</div>
        <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>Used to calculate groomed % and complete %</div>
        {(['backlogColumnId', 'groomedColumnId', 'doneColumnId'] as const).map((field, i) => (
          <Form.Item key={field} name={field} label={['Backlog', 'Groomed', 'Done'][i]} style={{ marginBottom: 10 }}>
            <Select options={kanban.columns.map(c => ({ value: c.id, label: c.label }))} />
          </Form.Item>
        ))}

        {/* Visibility */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 16 }}>Board sections</div>
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
        </div>

        {/* Card font size */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 16 }}>Card title size</div>
        <Form.Item name="cardFontSize" style={{ marginBottom: 0 }}>
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

        {/* Timeline */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 16 }}>Timeline</div>
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
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555', marginTop: 8 }}>Invite link</div>
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

        {/* Danger zone */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
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
