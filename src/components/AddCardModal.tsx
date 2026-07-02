import { useRef, useState } from 'react';
import { Modal, Form, Input, Select, Button, Divider, notification } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import type { KanbanCard, ColumnConfig } from '../types';
import { parseCSV } from '../utils/csvImport';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface Props {
  columns: ColumnConfig[];
  onAdd: (card: Omit<KanbanCard, 'id' | 'order'>) => void;
  onImport: (cards: KanbanCard[]) => void;
}

export function AddCardModal({ columns, onAdd, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm<{ title: string; columnId: string; pillValue: string }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const { isMobile } = useBreakpoint();

  function handleSubmit() {
    form.validateFields().then(values => {
      onAdd({ title: values.title.trim(), columnId: values.columnId, pillValue: values.pillValue?.trim() ?? '' });
      form.resetFields();
      setOpen(false);
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    const result = await parseCSV(file, columns);
    setImporting(false);
    if (result.cards.length === 0) {
      notification.error({ message: 'Import failed', description: 'No valid cards found. Check columns are named "Title" and "Status".' });
      return;
    }
    onImport(result.cards);
    notification.success({
      message: `Imported ${result.cards.length} card${result.cards.length !== 1 ? 's' : ''}`,
      description: result.skippedRows > 0 ? `${result.skippedRows} row${result.skippedRows !== 1 ? 's' : ''} skipped.` : undefined,
      duration: 4,
    });
    setOpen(false);
  }

  return (
    <>
      <Button
        type="primary"
        shape="circle"
        icon={<PlusOutlined style={{ fontSize: 28 }} />}
        onClick={() => setOpen(true)}
        style={{ position: 'fixed', bottom: 32, right: 32, width: 72, height: 72, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 1000 }}
      />

      <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />

      <Modal
        title="Add Card"
        open={open}
        onOk={handleSubmit}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        okText="Add Card"
        width={isMobile ? 'calc(100vw - 24px)' : 480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Title" name="title" rules={[{ required: true, message: 'Please enter a title' }]}>
            <Input size="large" placeholder="Card title" autoFocus onPressEnter={handleSubmit} />
          </Form.Item>
          <Form.Item label="Column" name="columnId" rules={[{ required: true, message: 'Please select a column' }]}>
            <Select size="large" placeholder="Select a column">
              {columns.map(col => (
                <Select.Option key={col.id} value={col.id}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: col.color, flexShrink: 0 }} />
                    {col.label}
                  </span>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Pill value" name="pillValue">
            <Input size="large" placeholder="e.g. 14 Jul, High priority (optional)" />
          </Form.Item>
        </Form>

        <Divider plain style={{ color: '#aaa', fontSize: 12 }}>or import from CSV</Divider>
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <Button icon={<UploadOutlined />} loading={importing} onClick={() => fileRef.current?.click()} style={{ minWidth: 160 }}>
            Choose CSV file…
          </Button>
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            Replaces all current cards. Columns: <em>Title</em>, <em>Status</em>, <em>Pill</em> (optional)
          </div>
        </div>
      </Modal>
    </>
  );
}
