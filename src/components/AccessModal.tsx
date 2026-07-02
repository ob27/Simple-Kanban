import { useState, useEffect } from 'react';
import { Modal, Tag, Button, Select, Popconfirm, message, Tooltip } from 'antd';
import { CrownOutlined } from '@ant-design/icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Kanban } from '../types';
import { removeMember, setMemberRole } from '../store';
import { UserAvatar } from './UserAvatar';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface Props {
  kanban: Kanban;
  currentUid: string;
  currentEmail: string;
  onClose: () => void;
  onChange: (updated: Kanban) => void;
}

interface Entry {
  uid: string;
  email: string;
  role: 'creator' | 'co-owner' | 'member' | 'viewer';
}

function resolveEmail(uid: string, kanban: Kanban, currentUid: string, currentEmail: string): string {
  if (uid === currentUid && currentEmail) return currentEmail;
  if (uid === kanban.ownerId && kanban.ownerEmail) return kanban.ownerEmail;
  return kanban.memberEmails?.[uid] || '';
}

export function AccessModal({ kanban, currentUid, currentEmail, onClose, onChange }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const { isMobile } = useBreakpoint();

  const coOwnerIds = kanban.coOwnerIds ?? [];
  const viewerIds = kanban.viewerIds ?? [];

  // Silently backfill missing owner email and current user's member email
  useEffect(() => {
    const updates: Record<string, string> = {};
    if (kanban.ownerId === currentUid && currentEmail && !kanban.ownerEmail) {
      updates['ownerEmail'] = currentEmail;
    }
    if (kanban.memberIds.includes(currentUid) && currentEmail && !kanban.memberEmails?.[currentUid]) {
      updates[`memberEmails.${currentUid}`] = currentEmail;
    }
    if (Object.keys(updates).length > 0) {
      updateDoc(doc(db, 'kanbans', kanban.id), updates).catch(() => {});
    }
  }, [kanban.id, kanban.ownerId, kanban.ownerEmail, kanban.memberIds, kanban.memberEmails, currentUid, currentEmail]);

  const entries: Entry[] = [
    {
      uid: kanban.ownerId,
      email: resolveEmail(kanban.ownerId, kanban, currentUid, currentEmail),
      role: 'creator',
    },
    ...coOwnerIds.map(uid => ({
      uid,
      email: resolveEmail(uid, kanban, currentUid, currentEmail),
      role: 'co-owner' as const,
    })),
    ...kanban.memberIds
      .filter(uid => uid !== kanban.ownerId && !coOwnerIds.includes(uid))
      .map(uid => ({
        uid,
        email: resolveEmail(uid, kanban, currentUid, currentEmail),
        role: 'member' as const,
      })),
    ...viewerIds
      .filter(uid => uid !== kanban.ownerId && !coOwnerIds.includes(uid) && !kanban.memberIds.includes(uid))
      .map(uid => ({
        uid,
        email: resolveEmail(uid, kanban, currentUid, currentEmail),
        role: 'viewer' as const,
      })),
  ];

  const isCurrentOwner = kanban.ownerId === currentUid || coOwnerIds.includes(currentUid);

  async function handleRoleChange(uid: string, role: 'co-owner' | 'member' | 'viewer') {
    setBusy(uid);
    try {
      const updated = await setMemberRole(kanban, uid, role);
      onChange(updated);
      message.success(`Role updated`);
    } catch {
      message.error('Failed to update role');
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(uid: string) {
    setBusy(uid);
    try {
      const updated = await removeMember(kanban, uid);
      onChange(updated);
      message.success('Access removed');
    } catch {
      message.error('Failed to remove access');
    } finally {
      setBusy(null);
    }
  }

  const ROLE_COLORS: Record<string, string> = {
    creator: 'gold',
    'co-owner': 'purple',
    member: 'blue',
    viewer: 'default',
  };

  const ROLE_LABELS: Record<string, string> = {
    creator: 'Creator',
    'co-owner': 'Co-owner',
    member: 'Member',
    viewer: 'Viewer',
  };

  return (
    <Modal
      title={`Manage access — ${kanban.name}`}
      open
      onCancel={onClose}
      footer={null}
      width={isMobile ? 'calc(100vw - 24px)' : 480}
    >
      <div style={{ marginBottom: 8, fontSize: 12, color: '#aaa' }}>
        {entries.length} {entries.length === 1 ? 'person has' : 'people have'} access
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entries.map(entry => {
          const isSelf = entry.uid === currentUid;
          const isCreator = entry.role === 'creator';
          const isLoading = busy === entry.uid;
          const displayEmail = entry.email || entry.uid;

          return (
            <div
              key={entry.uid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid #f5f5f5',
              }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <UserAvatar
                  email={entry.email || entry.uid}
                  size={32}
                  ring={isCreator ? '#d4a017' : entry.role === 'co-owner' ? '#7B2D8B' : undefined}
                />
                {(isCreator || entry.role === 'co-owner') && (
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 14, height: 14, borderRadius: '50%',
                    background: isCreator ? '#d4a017' : '#7B2D8B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1.5px solid #fff',
                  }}>
                    <CrownOutlined style={{ fontSize: 7, color: '#fff' }} />
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: entry.email ? '#1a1a2e' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.email
                    ? <>{entry.email}{isSelf ? ' (you)' : ''}</>
                    : <Tooltip title={entry.uid}><span>Unknown user <span style={{ fontSize: 11, fontWeight: 400 }}>({entry.uid.slice(0, 8)}…)</span></span></Tooltip>
                  }
                </div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>
                  {ROLE_LABELS[entry.role]}
                </div>
              </div>

              {isCurrentOwner && !isCreator && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <Select
                    size="small"
                    value={entry.role}
                    disabled={isLoading}
                    style={{ width: 110 }}
                    onChange={v => handleRoleChange(entry.uid, v as 'co-owner' | 'member' | 'viewer')}
                    options={[
                      { value: 'co-owner', label: 'Co-owner' },
                      { value: 'member', label: 'Member' },
                      { value: 'viewer', label: 'Viewer' },
                    ]}
                  />
                  <Popconfirm
                    title="Remove access?"
                    description={`${displayEmail} will lose access to this kanban.`}
                    onConfirm={() => handleRemove(entry.uid)}
                    okText="Remove"
                    okButtonProps={{ danger: true }}
                  >
                    <Button size="small" danger type="text" loading={isLoading}>
                      Remove
                    </Button>
                  </Popconfirm>
                </div>
              )}

              {!isCurrentOwner && (
                <Tag color={ROLE_COLORS[entry.role]}>
                  {ROLE_LABELS[entry.role]}
                </Tag>
              )}
            </div>
          );
        })}
      </div>

      {entries.length === 1 && (
        <div style={{ paddingTop: 16, fontSize: 13, color: '#aaa', textAlign: 'center' }}>
          No one else has access yet. Share the invite link from Settings.
        </div>
      )}
    </Modal>
  );
}
