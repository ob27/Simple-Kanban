import { useRef, useState } from 'react';
import { Modal, Form, Input, Select, Button, Divider, notification } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import type { DPKCard, ColumnId } from '../types';
import { COLUMNS } from '../constants';
import { parseCSV } from '../utils/csvImport';

interface Props {
  onAdd: (card: Omit<DPKCard, 'id'>) => void;
  onImport: (cards: DPKCard[]) => void;
}

export function AddCardModal({ onAdd, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm<{ dpkNumber: string; columnId: ColumnId }>();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    form.validateFields().then(values => {
      onAdd({ dpkNumber: values.dpkNumber.toUpperCase(), columnId: values.columnId });
      form.resetFields();
      setOpen(false);
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);

    const result = await parseCSV(file);
    setImporting(false);

    if (result.cards.length === 0) {
      notification.error({
        message: 'Import failed',
        description: 'No valid cards found. Check columns are named "DPK Number" and "Status".',
      });
      return;
    }

    onImport(result.cards);
    notification.success({
      message: `Imported ${result.cards.length} card${result.cards.length !== 1 ? 's' : ''}`,
      description: result.skippedRows > 0 ? `${result.skippedRows} row${result.skippedRows !== 1 ? 's' : ''} skipped (missing or unrecognised status).` : undefined,
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
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          width: 72,
          height: 72,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          zIndex: 1000,
        }}
      />

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <Modal
        title="Add DPK Cards"
        open={open}
        onOk={handleSubmit}
        onCancel={() => { setOpen(false); form.resetFields(); }}
        okText="Add Card"
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="DPK Number"
            name="dpkNumber"
            rules={[{ required: true, message: 'Please enter a DPK number' }]}
          >
            <Input
              size="large"
              placeholder="e.g. DPK 8060"
              autoFocus
              onPressEnter={handleSubmit}
            />
          </Form.Item>
          <Form.Item
            label="Column"
            name="columnId"
            rules={[{ required: true, message: 'Please select a column' }]}
          >
            <Select size="large" placeholder="Select a stage">
              {COLUMNS.map(col => (
                <Select.Option key={col.id} value={col.id}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'inline-block',
                      width: 12, height: 12,
                      borderRadius: 2,
                      background: col.color,
                      flexShrink: 0,
                    }} />
                    {col.label}
                  </span>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>

        <Divider plain style={{ color: '#aaa', fontSize: 12 }}>or import from CSV</Divider>

        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <Button
            icon={<UploadOutlined />}
            loading={importing}
            onClick={() => fileRef.current?.click()}
            style={{ minWidth: 160 }}
          >
            Choose CSV file…
          </Button>
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            Replaces all current cards. Columns: <em>DPK Number</em>, <em>Status</em>
          </div>
        </div>
      </Modal>
    </>
  );
}
