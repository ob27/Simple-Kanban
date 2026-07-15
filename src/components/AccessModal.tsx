import { useState, useEffect } from 'react';
import { Modal, Tag, Button, Select, Popconfirm, message, Tooltip } from 'antd';
import { CrownOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Kanban } from '../types';
import { removeMember, setMemberRole, regenerateInvite } from '../store';
import { UserAvatar } from './UserAvatar';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { buildKanbanInviteUrl } from '../utils/inviteLink';
import { useUserProfiles, resolveDisplay } from '../utils/userProfiles';
import { getKanbanMembers } from '../utils/kanbanMembers';

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

export function AccessModal({ kanban, currentUid, currentEmail, onClose, onChange }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const { isMobile } = useBreakpoint();

  const coOwnerIds = kanban.coOwnerIds ?? [];

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

  function roleForUid(uid: string): Entry['role'] {
    if (uid === kanban.ownerId) return 'creator';
    if (coOwnerIds.includes(uid)) return 'co-owner';
    if (kanban.memberIds.includes(uid)) return 'member';
    return 'viewer';
  }

  const entries: Entry[] = getKanbanMembers(kanban, currentUid, currentEmail).map(m => ({ ...m, role: roleForUid(m.uid) }));

  const isCurrentOwner = kanban.ownerId === currentUid || coOwnerIds.includes(currentUid);
  const profiles = useUserProfiles(entries.map(e => e.uid));

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
      {isCurrentOwner && (
        <>
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#555' }}>Invite link</div>
          <div style={{
            background: '#f5f5f5', borderRadius: 8, padding: '10px 12px',
            fontSize: 12, color: '#555', wordBreak: 'break-all', marginBottom: 8,
          }}>
            {inviteUrl}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Button icon={<CopyOutlined />} onClick={copyInvite} style={{ flex: 1 }}>Copy link</Button>
            <Tooltip title="Generate a new link (invalidates the old one)">
              <Button icon={<ReloadOutlined />} loading={regenerating} onClick={handleRegenerate}>New link</Button>
            </Tooltip>
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', marginBottom: 12 }} />
        </>
      )}

      <div style={{ marginBottom: 8, fontSize: 12, color: '#aaa' }}>
        {entries.length} {entries.length === 1 ? 'person has' : 'people have'} access
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {entries.map(entry => {
          const isSelf = entry.uid === currentUid;
          const isCreator = entry.role === 'creator';
          const isLoading = busy === entry.uid;
          const displayEmail = entry.email || entry.uid;
          const display = resolveDisplay(entry.uid, entry.email, profiles);

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
                  seed={display.avatarSeed}
                  photoURL={display.avatarPhotoURL}
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
                    ? <>{display.name}{isSelf ? ' (you)' : ''}</>
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
          No one else has access yet. Share the link above to invite someone.
        </div>
      )}
    </Modal>
  );
}
