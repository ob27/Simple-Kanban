import { useState } from 'react';
import { Modal, Input, Button, Form } from 'antd';
import { useAuth } from '../AuthContext';
import { createKanban } from '../store';
import type { Kanban } from '../types';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (kanban: Kanban) => void;
}

export function CreateKanbanModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { isMobile } = useBreakpoint();

  async function handleSubmit({ name }: { name: string }) {
    if (!user) return;
    setLoading(true);
    try {
      const kanban = await createKanban(user.uid, name.trim(), user.email ?? undefined);
      form.resetFields();
      onCreated(kanban);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="New Kanban"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={isMobile ? 'calc(100vw - 24px)' : 520}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 8 }}>
        <Form.Item
          name="name"
          label="Kanban name"
          rules={[{ required: true, message: 'Give this kanban a name' }]}
        >
          <Input size="large" placeholder="e.g. My Project Kanban" autoFocus />
        </Form.Item>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={loading}>Create</Button>
        </div>
      </Form>
    </Modal>
  );
}
