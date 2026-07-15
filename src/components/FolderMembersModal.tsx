import { useState } from 'react';
import { Modal, Tag, Select, Button, message, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { Folder } from '../types';
import { setFolderMemberRole, removeFolderMember } from '../store';
import { useUserProfiles, resolveDisplay } from '../utils/userProfiles';
import { UserAvatar } from './UserAvatar';

interface Props {
  open: boolean;
  folder: Folder;
  onClose: () => void;
}

export function FolderMembersModal({ open, folder, onClose }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const editorIds = folder.editorIds ?? [];

  async function handleRoleChange(uid: string, newRole: 'editor' | 'viewer') {
    setBusy(uid);
    try {
      await setFolderMemberRole(folder, uid, newRole);
    } catch {
      message.error('Failed to update role');
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(uid: string) {
    setBusy(uid + '_remove');
    try {
      await removeFolderMember(folder, uid);
    } catch {
      message.error('Failed to remove member');
    } finally {
      setBusy(null);
    }
  }

  const members = folder.memberIds.map(uid => ({
    uid,
    email: folder.memberEmails?.[uid] ?? uid,
    role: editorIds.includes(uid) ? 'editor' as const : 'viewer' as const,
  }));
  const profiles = useUserProfiles(members.map(m => m.uid));

  return (
    <Modal
      title="Folder members"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width={420}
    >
      {members.length === 0 ? (
        <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
          No members yet. Share an invite link to add people.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {members.map(m => {
            const display = resolveDisplay(m.uid, m.email, profiles);
            return (
            <div key={m.uid} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', background: '#f9f9fb', borderRadius: 8,
            }}>
              <UserAvatar email={m.email} seed={display.avatarSeed} photoURL={display.avatarPhotoURL} size={22} />
              <span style={{ flex: 1, fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {display.name}
              </span>
              <Select
                size="small"
                value={m.role}
                style={{ width: 90 }}
                disabled={busy === m.uid}
                loading={busy === m.uid}
                onChange={val => handleRoleChange(m.uid, val)}
                options={[
                  { value: 'editor', label: <Tag color="blue" style={{ margin: 0 }}>Editor</Tag> },
                  { value: 'viewer', label: <Tag color="default" style={{ margin: 0 }}>Viewer</Tag> },
                ]}
              />
              <Popconfirm
                title="Remove this member?"
                description="They'll lose access to this folder and its kanbans."
                onConfirm={() => handleRemove(m.uid)}
                okText="Remove"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={busy === m.uid + '_remove'}
                  style={{ flexShrink: 0 }}
                />
              </Popconfirm>
            </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
