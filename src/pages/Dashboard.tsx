import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Spin, Tag, Tooltip, Drawer, message, Dropdown, Modal, Input, Switch,
} from 'antd';
import {
  PlusOutlined, LogoutOutlined, TeamOutlined, SettingOutlined,
  DownloadOutlined, FileTextOutlined, UploadOutlined, DeleteOutlined,
  FolderOutlined, FolderOpenOutlined, RightOutlined, DownOutlined, UpOutlined,
  ShareAltOutlined, EditOutlined, MoreOutlined, FolderAddOutlined, PictureOutlined,
  ArrowLeftOutlined, UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '../AuthContext';
import {
  subscribeUserKanbans, isKanbanOwner,
  subscribeUserFolders, createFolder, deleteFolder, renameFolder, reorderFolder,
  addKanbanToFolder, removeKanbanFromFolder, generateEditorInvite, setFolderAccolades,
} from '../store';
import type { Kanban, Folder, FolderRole } from '../types';
import { uploadFolderLogo, deleteFolderLogo } from '../utils/logoUpload';
import { CreateKanbanModal } from '../components/CreateKanbanModal';
import { AccessModal } from '../components/AccessModal';
import { FolderMembersModal } from '../components/FolderMembersModal';
import { UserAvatar } from '../components/UserAvatar';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { exportAllKanbansCSV } from '../utils/csvExportAll';
import { getWorkspaceSettings, uploadLogo, deleteLogo, saveNavBgColor, saveWorkspaceAccolades, type WorkspaceSettings } from '../utils/logoUpload';
import { useUserProfiles, resolveDisplay } from '../utils/userProfiles';

const DEFAULT_SETTINGS: WorkspaceSettings = { navLogoUrl: null, boardLogoUrl: null, navBgColor: '#1a1a2e' };

interface LogoSlotProps {
  label: string;
  hint: string;
  url: string | null;
  fileRef: React.RefObject<HTMLInputElement>;
  busy: boolean;
  previewBg: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
}

function LogoSlot({ label, hint, url, fileRef, busy, previewBg, onUpload, onDelete }: LogoSlotProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>{hint}</div>
      {url && (
        <div style={{ marginBottom: 10, padding: 10, background: previewBg, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={url} alt="logo preview" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
          <Button size="small" danger icon={<DeleteOutlined />} loading={busy} onClick={onDelete}>
            Remove
          </Button>
        </div>
      )}
      <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={onUpload} style={{ display: 'none' }} />
      <Button icon={<UploadOutlined />} loading={busy} onClick={() => fileRef.current?.click()} block>
        {url ? 'Replace' : 'Upload'} logo
      </Button>
    </div>
  );
}

export function Dashboard() {
  const { user, signOut } = useAuth();
  const ownProfile = useUserProfiles(user ? [user.uid] : []);
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();
  const [kanbans, setKanbans] = useState<Kanban[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [accessKanban, setAccessKanban] = useState<Kanban | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [uploading, setUploading] = useState<'nav' | 'board' | null>(null);
  const navFileRef = useRef<HTMLInputElement>(null);
  const boardFileRef = useRef<HTMLInputElement>(null);

  // Folder UI state
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('simple-kanban:collapsedFolders');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [createFolderId, setCreateFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState('');
  const [renamingFolderAccolades, setRenamingFolderAccolades] = useState(true);
  const [folderBusy, setFolderBusy] = useState(false);
  const [uploadingIconForFolder, setUploadingIconForFolder] = useState<string | null>(null);
  const folderIconFileRef = useRef<HTMLInputElement>(null);
  const pendingFolderIconUpload = useRef<string | null>(null);
  const [membersFolderId, setMembersFolderId] = useState<string | null>(null);
  const membersFolder = membersFolderId ? folders.find(f => f.id === membersFolderId) ?? null : null;

  useEffect(() => {
    if (!user) return;
    getWorkspaceSettings(user.uid).then(setSettings);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = subscribeUserKanbans(user.uid, kanbans => {
      setKanbans(kanbans);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserFolders(user.uid, setFolders);
    return unsub;
  }, [user]);

  function onCreated(kanban: Kanban) {
    setCreateOpen(false);
    if (createFolderId) {
      const folder = folders.find(f => f.id === createFolderId);
      if (folder) {
        addKanbanToFolder(folder, kanban.id, kanbans).catch(() => message.error('Kanban created, but failed to add to folder'));
      }
      setCreateFolderId(null);
    }
    navigate(`/k/${kanban.id}`);
  }

  async function handleUpload(slot: 'nav' | 'board', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(slot);
    try {
      const url = await uploadLogo(user.uid, slot, file);
      setSettings(s => ({ ...s, [`${slot}LogoUrl`]: url }));
      message.success('Logo uploaded');
    } catch {
      message.error('Upload failed — check Firebase Storage rules are deployed');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  }

  async function handleDelete(slot: 'nav' | 'board') {
    if (!user) return;
    setUploading(slot);
    try {
      await deleteLogo(user.uid, slot);
      setSettings(s => ({ ...s, [`${slot}LogoUrl`]: null }));
      message.success('Logo removed');
    } finally {
      setUploading(null);
    }
  }

  async function handleColorChange(color: string) {
    setSettings(s => ({ ...s, navBgColor: color }));
    if (user) await saveNavBgColor(user.uid, color);
  }

  async function handleWorkspaceAccoladesChange(enabled: boolean) {
    setSettings(s => ({ ...s, accoladesEnabled: enabled }));
    if (user) await saveWorkspaceAccolades(user.uid, enabled);
  }

  // ── Folder handlers ──────────────────────────────────────────────────────────

  async function handleCreateFolder() {
    if (!user || !newFolderName.trim()) return;
    setFolderBusy(true);
    try {
      await createFolder(user.uid, newFolderName.trim(), user.email ?? undefined);
      setNewFolderOpen(false);
      setNewFolderName('');
    } catch {
      message.error('Failed to create folder');
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleDeleteFolder(folder: Folder) {
    try {
      await deleteFolder(folder);
    } catch {
      message.error('Failed to delete folder');
    }
  }

  async function handleRenameFolder() {
    if (!renamingFolder || !renamingFolderName.trim()) return;
    setFolderBusy(true);
    try {
      await Promise.all([
        renameFolder(renamingFolder, renamingFolderName.trim()),
        renamingFolderAccolades !== (renamingFolder.accoladesEnabled ?? true)
          ? setFolderAccolades(renamingFolder.id, renamingFolderAccolades)
          : Promise.resolve(),
      ]);
      setRenamingFolder(null);
      setRenamingFolderName('');
    } catch {
      message.error('Failed to rename folder');
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleAddToFolder(folder: Folder, kanbanId: string) {
    // Remove from current folder first if it's in one
    const currentFolder = folders.find(f => f.id !== folder.id && f.kanbanIds.includes(kanbanId));
    if (currentFolder) {
      await removeKanbanFromFolder(currentFolder, kanbanId).catch(() => {});
    }
    try {
      await addKanbanToFolder(folder, kanbanId, kanbans);
    } catch {
      message.error('Failed to move kanban');
    }
  }

  async function handleRemoveFromFolder(folder: Folder, kanbanId: string) {
    try {
      await removeKanbanFromFolder(folder, kanbanId);
    } catch {
      message.error('Failed to remove from folder');
    }
  }

  async function handleFolderIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const folderId = pendingFolderIconUpload.current;
    e.target.value = '';
    if (!file || !folderId) return;
    setUploadingIconForFolder(folderId);
    try {
      await uploadFolderLogo(folderId, file);
      message.success('Folder icon uploaded');
    } catch {
      message.error('Upload failed');
    } finally {
      setUploadingIconForFolder(null);
      pendingFolderIconUpload.current = null;
    }
  }

  async function handleDeleteFolderIcon(folderId: string) {
    setUploadingIconForFolder(folderId);
    try {
      await deleteFolderLogo(folderId);
      message.success('Folder icon removed');
    } catch {
      message.error('Failed to remove icon');
    } finally {
      setUploadingIconForFolder(null);
    }
  }

  async function handleCopyFolderInviteAs(folder: Folder, role: 'editor' | 'viewer') {
    let token: string;
    if (role === 'editor') {
      token = folder.editorInviteToken ?? await generateEditorInvite(folder);
    } else {
      token = folder.inviteToken;
    }
    const url = `${window.location.origin}/simple-kanban/folder-invite/${token}`;
    navigator.clipboard.writeText(url);
    message.success(`${role === 'editor' ? 'Editor' : 'Viewer'} invite link copied`);
  }

  function getFolderRole(folder: Folder): FolderRole {
    if (!user) return 'viewer';
    if (folder.ownerId === user.uid) return 'owner';
    if ((folder.editorIds ?? []).includes(user.uid)) return 'editor';
    return 'viewer';
  }

  function toggleCollapse(folderId: string) {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      localStorage.setItem('simple-kanban:collapsedFolders', JSON.stringify([...next]));
      return next;
    });
  }

  function handleReorderFolder(folderId: string, direction: -1 | 1) {
    const idx = folders.findIndex(f => f.id === folderId);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= folders.length) return;
    const a = folders[idx];
    const b = folders[swapIdx];
    const aOrder = a.order ?? a.createdAt;
    const bOrder = b.order ?? b.createdAt;
    reorderFolder(a.id, bOrder);
    reorderFolder(b.id, aOrder);
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  const ownedKanbans = kanbans.filter(k => user && k.ownerId === user.uid);
  const editableFolders = folders.filter(f =>
    f.ownerId === user?.uid || (f.editorIds ?? []).includes(user?.uid ?? '')
  );
  const allFolderKanbanIds = new Set(folders.flatMap(f => f.kanbanIds));
  const ungroupedKanbans = kanbans.filter(k => !allFolderKanbanIds.has(k.id));
  const hasFolders = folders.length > 0;

  const navBg = settings.navBgColor || '#1a1a2e';
  const navTextColor = (r: number, g: number, b: number) => (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#1a1a2e' : '#ffffff';
  function hexToRgb(hex: string) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }
  const rgb = hexToRgb(navBg.startsWith('#') && navBg.length === 7 ? navBg : '#1a1a2e');
  const textColor = navTextColor(rgb.r, rgb.g, rgb.b);
  const subtleTextColor = textColor === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  } as React.CSSProperties;

  return (
    <div style={{ height: '100vh', background: '#EEF0F5', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: navBg,
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        transition: 'background 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {settings.navLogoUrl
            ? <img src={settings.navLogoUrl} alt="logo" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />
            : <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: textColor, fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>
                <img src={textColor === '#ffffff' ? '/favicon-white.svg' : '/favicon-black.svg'} alt="" style={{ height: 16, width: 'auto' }} />
                Simple Kanban
              </span>
          }
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'email', label: (user ? resolveDisplay(user.uid, user.email ?? '', ownProfile).name : user), disabled: true },
                { type: 'divider' as const },
                { key: 'all-products', icon: <ArrowLeftOutlined />, label: 'All products' },
                { key: 'profile', icon: <UserOutlined />, label: 'Profile' },
                { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
                { type: 'divider' as const },
                { key: 'signout', icon: <LogoutOutlined />, label: 'Sign out', danger: true },
              ],
              onClick: ({ key }) => {
                if (key === 'all-products') window.location.href = '/';
                if (key === 'profile') window.location.href = '/profile';
                if (key === 'settings') { setWorkspaceOpen(true); if (user) getWorkspaceSettings(user.uid).then(setSettings); }
                if (key === 'signout') signOut();
              },
            }}
          >
            <span style={{ display: 'inline-flex', cursor: 'pointer' }}>
              {user?.email
                ? <UserAvatar email={user.email} seed={user ? resolveDisplay(user.uid, user.email, ownProfile).avatarSeed : undefined} photoURL={user ? ownProfile[user.uid]?.avatarPhotoURL : undefined} size={28} />
                : <span style={{ color: subtleTextColor, fontSize: 13 }}>Account</span>}
            </span>
          </Dropdown>
        </div>
      </div>

      {/* Body */}
      <div className="scrollbar-hidden" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '32px 24px', maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Your Kanbans</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Tooltip title="New folder">
              <Button icon={<FolderAddOutlined />} onClick={() => { setNewFolderName(''); setNewFolderOpen(true); }}>
                {!isMobile && 'New Folder'}
              </Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {!isMobile && 'New Kanban'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spin size="large" /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Folders */}
            {folders.map((folder, folderIdx) => {
              const folderKanbans = kanbans.filter(k => folder.kanbanIds.includes(k.id));
              const isOwner = folder.ownerId === user!.uid;
              const isCollapsed = collapsedFolders.has(folder.id);

              return (
                <div key={folder.id}>
                  {/* Folder header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: isCollapsed ? 0 : 12,
                    padding: '10px 14px',
                    background: '#E2E4EC',
                    borderRadius: isCollapsed ? 10 : '10px 10px 0 0',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                    onClick={() => toggleCollapse(folder.id)}
                  >
                    <span style={{ color: '#666', fontSize: 12, transition: 'transform 0.15s', display: 'inline-flex' }}>
                      {isCollapsed ? <RightOutlined /> : <DownOutlined />}
                    </span>
                    {folder.folderLogoUrl ? (
                      <img
                        src={folder.folderLogoUrl}
                        alt="folder icon"
                        style={{ height: 22, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
                      />
                    ) : (
                      isCollapsed
                        ? <FolderOutlined style={{ color: '#555', fontSize: 16 }} />
                        : <FolderOpenOutlined style={{ color: '#555', fontSize: 16 }} />
                    )}
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {folder.name}
                    </span>
                    <span style={{ fontSize: 12, color: '#999', marginRight: 4 }}>
                      {folderKanbans.length} kanban{folderKanbans.length !== 1 ? 's' : ''}
                    </span>
                    {!isOwner && (
                      <Tag
                        color={getFolderRole(folder) === 'editor' ? 'blue' : 'default'}
                        style={{ marginRight: 4 }}
                      >
                        {getFolderRole(folder) === 'editor' ? 'Editor' : 'Viewer'}
                      </Tag>
                    )}

                    {/* Reorder — owner only: order is shared on the folder doc, so
                        letting any viewer/editor drag it would silently reshuffle
                        everyone else's dashboard too. */}
                    {isOwner && (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <Tooltip title="Move up">
                          <Button
                            size="small" type="text" icon={<UpOutlined />} disabled={folderIdx === 0}
                            onClick={e => { e.stopPropagation(); handleReorderFolder(folder.id, -1); }}
                          />
                        </Tooltip>
                        <Tooltip title="Move down">
                          <Button
                            size="small" type="text" icon={<DownOutlined />} disabled={folderIdx === folders.length - 1}
                            onClick={e => { e.stopPropagation(); handleReorderFolder(folder.id, 1); }}
                          />
                        </Tooltip>
                      </div>
                    )}

                    {/* Share button — owner only: dropdown with editor/viewer link */}
                    {isOwner && (
                      <Dropdown
                        trigger={['click']}
                        menu={{
                          items: [
                            { key: 'editor', icon: <EditOutlined />, label: 'Copy editor invite link' },
                            { key: 'viewer', icon: <ShareAltOutlined />, label: 'Copy viewer invite link' },
                          ],
                          onClick: ({ key, domEvent }) => {
                            domEvent.stopPropagation();
                            handleCopyFolderInviteAs(folder, key as 'editor' | 'viewer');
                          },
                        }}
                      >
                        <Tooltip title="Share folder">
                          <button
                            onClick={e => e.stopPropagation()}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: '#999', borderRadius: 4, lineHeight: 1, fontSize: 14 }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#555')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#999')}
                          >
                            <ShareAltOutlined />
                          </button>
                        </Tooltip>
                      </Dropdown>
                    )}

                    {/* Manage members — owner only */}
                    {isOwner && (
                      <Tooltip title="Manage members">
                        <button
                          onClick={e => { e.stopPropagation(); setMembersFolderId(folder.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: '#999', borderRadius: 4, lineHeight: 1, fontSize: 14 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#555')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#999')}
                        >
                          <TeamOutlined />
                        </button>
                      </Tooltip>
                    )}

                    {/* More options — owner only */}
                    {isOwner && (
                      <Dropdown
                        trigger={['click']}
                        menu={{
                          items: [
                            {
                              key: 'new-kanban',
                              icon: <PlusOutlined />,
                              label: 'New kanban in this folder',
                            },
                            { type: 'divider' as const },
                            {
                              key: 'rename',
                              icon: <EditOutlined />,
                              label: 'Rename folder',
                            },
                            { type: 'divider' },
                            {
                              key: 'upload-icon',
                              icon: <PictureOutlined />,
                              label: uploadingIconForFolder === folder.id ? 'Uploading…' : 'Upload folder icon',
                            },
                            ...(folder.folderLogoUrl ? [{
                              key: 'remove-icon',
                              icon: <DeleteOutlined />,
                              label: 'Remove folder icon',
                            }] : []),
                            { type: 'divider' as const },
                            {
                              key: 'delete',
                              icon: <DeleteOutlined />,
                              label: 'Delete folder',
                              danger: true,
                            },
                          ],
                          onClick: ({ key, domEvent }) => {
                            domEvent.stopPropagation();
                            if (key === 'new-kanban') { setCreateFolderId(folder.id); setCreateOpen(true); }
                            if (key === 'rename') {
                              setRenamingFolder(folder);
                              setRenamingFolderName(folder.name);
                              setRenamingFolderAccolades(folder.accoladesEnabled ?? true);
                            }
                            if (key === 'upload-icon') {
                              pendingFolderIconUpload.current = folder.id;
                              folderIconFileRef.current?.click();
                            }
                            if (key === 'remove-icon') handleDeleteFolderIcon(folder.id);
                            if (key === 'delete') handleDeleteFolder(folder);
                          },
                        }}
                      >
                        <button
                          onClick={e => e.stopPropagation()}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: '#999', borderRadius: 4, lineHeight: 1, fontSize: 14 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#555')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#999')}
                        >
                          <MoreOutlined />
                        </button>
                      </Dropdown>
                    )}
                  </div>

                  {/* Folder contents */}
                  {!isCollapsed && (
                    <div style={{
                      background: '#E8EAF0',
                      borderRadius: '0 0 10px 10px',
                      padding: folderKanbans.length > 0 ? '16px 14px' : '12px 14px',
                    }}>
                      {folderKanbans.length > 0 ? (
                        <div style={gridStyle}>
                          {folderKanbans.map(k => (
                            <KanbanCard
                              key={k.id}
                              kanban={k}
                              isOwner={isKanbanOwner(k, user!.uid)}
                              onClick={() => navigate(`/k/${k.id}`)}
                              onManageAccess={() => setAccessKanban(k)}
                              editableFolders={editableFolders}
                              currentFolder={folder}
                              currentFolderRole={getFolderRole(folder)}
                              onAddToFolder={targetFolderId => {
                                const target = folders.find(f => f.id === targetFolderId);
                                if (target) handleAddToFolder(target, k.id);
                              }}
                              onRemoveFromFolder={() => handleRemoveFromFolder(folder, k.id)}
                              onCreateFolder={() => { setNewFolderName(''); setNewFolderOpen(true); }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>
                          No kanbans in this folder yet. Move kanbans here using the folder button on each card.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ungrouped kanbans */}
            {ungroupedKanbans.length > 0 && (
              <div>
                {hasFolders && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#999', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Ungrouped
                  </div>
                )}
                <div style={gridStyle}>
                  {ungroupedKanbans.map(k => (
                    <KanbanCard
                      key={k.id}
                      kanban={k}
                      isOwner={isKanbanOwner(k, user!.uid)}
                      onClick={() => navigate(`/k/${k.id}`)}
                      onManageAccess={() => setAccessKanban(k)}
                      editableFolders={editableFolders}
                      currentFolder={undefined}
                      currentFolderRole={undefined}
                      onAddToFolder={targetFolderId => {
                        const target = folders.find(f => f.id === targetFolderId);
                        if (target) handleAddToFolder(target, k.id);
                      }}
                      onRemoveFromFolder={() => {}}
                      onCreateFolder={() => { setNewFolderName(''); setNewFolderOpen(true); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {kanbans.length === 0 && !loading && (
              <div style={{ textAlign: 'center', paddingTop: 80 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>
                  Create your first kanban
                </div>
                <div style={{ fontSize: 14, color: '#999', marginBottom: 28, maxWidth: 320, margin: '0 auto 28px' }}>
                  Kanbans help you track work across columns. Give one a name and get moving.
                </div>
                <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setCreateOpen(true)}>
                  New Kanban
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <CreateKanbanModal open={createOpen} onClose={() => { setCreateOpen(false); setCreateFolderId(null); }} onCreated={onCreated} />

      {accessKanban && (
        <AccessModal
          kanban={accessKanban}
          currentUid={user!.uid}
          currentEmail={user!.email ?? ''}
          onClose={() => setAccessKanban(null)}
          onChange={updated => {
            setKanbans(prev => prev.map(k => k.id === updated.id ? updated : k));
            setAccessKanban(updated);
          }}
        />
      )}

      {membersFolder && (
        <FolderMembersModal
          open
          folder={membersFolder}
          onClose={() => setMembersFolderId(null)}
        />
      )}

      {/* Hidden input for folder icon upload */}
      <input
        ref={folderIconFileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,.webp"
        style={{ display: 'none' }}
        onChange={handleFolderIconUpload}
      />

      {/* Create folder modal */}
      <Modal
        title="New Folder"
        open={newFolderOpen}
        onOk={handleCreateFolder}
        onCancel={() => setNewFolderOpen(false)}
        okText="Create"
        okButtonProps={{ disabled: !newFolderName.trim(), loading: folderBusy }}
        destroyOnClose
      >
        <Input
          placeholder="Folder name"
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
          autoFocus
          style={{ marginTop: 8 }}
        />
      </Modal>

      {/* Rename folder modal */}
      <Modal
        title="Rename Folder"
        open={!!renamingFolder}
        onOk={handleRenameFolder}
        onCancel={() => setRenamingFolder(null)}
        okText="Save"
        okButtonProps={{ disabled: !renamingFolderName.trim(), loading: folderBusy }}
        destroyOnClose
      >
        <Input
          placeholder="Folder name"
          value={renamingFolderName}
          onChange={e => setRenamingFolderName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRenameFolder()}
          autoFocus
          style={{ marginTop: 8 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <Switch size="small" checked={renamingFolderAccolades} onChange={setRenamingFolderAccolades} />
          <span style={{ fontSize: 13, color: '#555' }}>
            Celebrate card moves (confetti) for kanbans in this folder by default
          </span>
        </div>
      </Modal>

      {/* Workspace drawer */}
      <Drawer
        title="Workspace"
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        width={isMobile ? '100vw' : 380}
      >
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 3 }}>Gallery navigation colour</div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>Background colour of the top bar on the gallery page.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <div
                style={{ width: 36, height: 36, borderRadius: 8, cursor: 'pointer', background: navBg, border: '2px solid rgba(0,0,0,0.12)' }}
                onClick={() => document.getElementById('nav-color-input')?.click()}
              />
              <input
                id="nav-color-input"
                type="color"
                value={navBg}
                onChange={e => handleColorChange(e.target.value)}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
              />
            </div>
            <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>{navBg.toUpperCase()}</div>
            <Button size="small" type="text" style={{ color: '#aaa', fontSize: 11 }} onClick={() => handleColorChange('#1a1a2e')}>Reset</Button>
          </div>
        </div>

        <LogoSlot
          label="Gallery navigation logo"
          hint="Replaces the 'Simple Kanban' text. Use a negative (light) version for dark nav backgrounds."
          url={settings.navLogoUrl}
          fileRef={navFileRef}
          busy={uploading === 'nav'}
          previewBg={navBg}
          onUpload={e => handleUpload('nav', e)}
          onDelete={() => handleDelete('nav')}
        />
        <LogoSlot
          label="Kanban board logo"
          hint="Shown in the top-left of each board when enabled per-board in Settings. Use a positive (dark/coloured) version for the light grey background."
          url={settings.boardLogoUrl}
          fileRef={boardFileRef}
          busy={uploading === 'board'}
          previewBg="#EEF0F5"
          onUpload={e => handleUpload('board', e)}
          onDelete={() => handleDelete('board')}
        />

        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              size="small"
              checked={settings.accoladesEnabled ?? true}
              onChange={handleWorkspaceAccoladesChange}
            />
            <span style={{ fontSize: 13, color: '#555' }}>Celebrate card moves (confetti) by default</span>
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
            Applies to any kanban or folder that hasn't set its own preference.
          </div>
        </div>

        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 4 }}>Export</div>
          <Button
            icon={<DownloadOutlined />}
            block
            disabled={ownedKanbans.length === 0}
            onClick={() => exportAllKanbansCSV(ownedKanbans)}
          >
            Export all kanbans (CSV)
          </Button>
          <Button
            icon={<FileTextOutlined />}
            block
            disabled={ownedKanbans.length === 0}
            onClick={() => window.open('/simple-kanban/workspace-report', '_blank')}
          >
            Workspace report (PDF)
          </Button>
        </div>
      </Drawer>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MiniProgressBar({ kanban }: { kanban: Kanban }) {
  const total = kanban.cards.length;
  return (
    <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: '#eee' }}>
      {total > 0 && kanban.columns.map(col => {
        const count = kanban.cards.filter(c => c.columnId === col.id).length;
        if (!count) return null;
        return <div key={col.id} style={{ flex: count, background: col.color }} />;
      })}
    </div>
  );
}

interface KanbanCardProps {
  kanban: Kanban;
  isOwner: boolean;
  onClick: () => void;
  onManageAccess: () => void;
  editableFolders: Folder[];
  currentFolder?: Folder;
  currentFolderRole?: FolderRole;
  onAddToFolder: (folderId: string) => void;
  onRemoveFromFolder: () => void;
  onCreateFolder: () => void;
}

function KanbanCard({
  kanban, isOwner, onClick, onManageAccess,
  editableFolders, currentFolder, currentFolderRole, onAddToFolder, onRemoveFromFolder, onCreateFolder,
}: KanbanCardProps) {
  const accentColor = kanban.columns[0]?.color ?? '#1a1a2e';
  const canEditFolder = !currentFolder || currentFolderRole === 'owner' || currentFolderRole === 'editor';
  const ownerProfiles = useUserProfiles([kanban.ownerId]);

  const folderMenuItems = [
    ...(currentFolder && canEditFolder ? [
      { key: '__remove', label: `Remove from "${currentFolder.name}"`, danger: true },
      { type: 'divider' as const },
    ] : []),
    ...editableFolders
      .filter(f => f.id !== currentFolder?.id)
      .map(f => ({ key: f.id, label: `Move to "${f.name}"` })),
    ...(editableFolders.filter(f => f.id !== currentFolder?.id).length > 0 ? [{ type: 'divider' as const }] : []),
    { key: '__new', label: 'New folder...' },
  ];

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)', transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.13)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ height: 6, background: accentColor }} />
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', lineHeight: 1.3 }}>{kanban.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {!isOwner && <Tag color="blue">Shared</Tag>}
            {/* Folder button — show if user can do something with folders */}
            {(editableFolders.length > 0 || canEditFolder) && (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: folderMenuItems,
                  onClick: ({ key, domEvent }) => {
                    domEvent.stopPropagation();
                    if (key === '__remove') onRemoveFromFolder();
                    else if (key === '__new') onCreateFolder();
                    else onAddToFolder(key);
                  },
                }}
              >
                <Tooltip title={currentFolder ? `In "${currentFolder.name}"` : 'Move to folder'}>
                  <button
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 4px', borderRadius: 4, lineHeight: 1, fontSize: 14,
                      color: currentFolder ? '#1677ff' : '#bbb',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = currentFolder ? '#0958d9' : '#888')}
                    onMouseLeave={e => (e.currentTarget.style.color = currentFolder ? '#1677ff' : '#bbb')}
                  >
                    <FolderOutlined />
                  </button>
                </Tooltip>
              </Dropdown>
            )}
            {isOwner && (
              <Tooltip title="Manage access">
                <button
                  onClick={e => { e.stopPropagation(); onManageAccess(); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: '#bbb', borderRadius: 4, lineHeight: 1, fontSize: 14 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#555')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}
                >
                  <TeamOutlined />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
        {!isOwner && kanban.ownerEmail && (
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10 }}>
            Shared by {resolveDisplay(kanban.ownerId, kanban.ownerEmail, ownerProfiles).name}
          </div>
        )}
        <MiniProgressBar kanban={kanban} />
        <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
          {kanban.cards.length} card{kanban.cards.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
