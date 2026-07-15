import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';

export interface WorkspaceSettings {
  navLogoUrl: string | null;
  boardLogoUrl: string | null;
  navBgColor: string;
  accoladesEnabled?: boolean;
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  navLogoUrl: null,
  boardLogoUrl: null,
  navBgColor: '#1a1a2e',
};

export async function getWorkspaceSettings(uid: string): Promise<WorkspaceSettings> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  const d = snap.data();
  // Use explicit undefined check: a stored null means "deleted", not "missing".
  // The ?? operator treats null as missing, which would resurrect the legacy logoUrl.
  const navLogoUrl = d.navLogoUrl !== undefined ? (d.navLogoUrl as string | null) : (d.logoUrl as string | null ?? null);
  const boardLogoUrl = d.boardLogoUrl !== undefined ? (d.boardLogoUrl as string | null) : (d.logoUrl as string | null ?? null);
  return {
    navLogoUrl,
    boardLogoUrl,
    navBgColor: (d.navBgColor as string | null) ?? '#1a1a2e',
    accoladesEnabled: d.accoladesEnabled as boolean | undefined,
  };
}

export async function saveWorkspaceAccolades(uid: string, enabled: boolean): Promise<void> {
  await setDoc(doc(db, 'users', uid), { accoladesEnabled: enabled }, { merge: true });
}

export async function uploadLogo(uid: string, slot: 'nav' | 'board', file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  // Always overwrite the same path so old files don't accumulate
  const storageRef = ref(storage, `logos/${uid}/${slot}.${ext}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await setDoc(doc(db, 'users', uid), { [`${slot}LogoUrl`]: url }, { merge: true });
  return url;
}

export async function deleteLogo(uid: string, slot: 'nav' | 'board'): Promise<void> {
  for (const ext of ['png', 'jpg', 'jpeg', 'svg', 'webp']) {
    try { await deleteObject(ref(storage, `logos/${uid}/${slot}.${ext}`)); } catch { /* not found, skip */ }
  }
  await setDoc(doc(db, 'users', uid), { [`${slot}LogoUrl`]: null }, { merge: true });
}

export async function saveNavBgColor(uid: string, color: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { navBgColor: color }, { merge: true });
}

export async function uploadKanbanLogo(kanbanId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const storageRef = ref(storage, `logos/kanbans/${kanbanId}/logo.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteKanbanLogo(kanbanId: string): Promise<void> {
  for (const ext of ['png', 'jpg', 'jpeg', 'svg', 'webp']) {
    try { await deleteObject(ref(storage, `logos/kanbans/${kanbanId}/logo.${ext}`)); } catch { /* skip */ }
  }
}

export async function uploadFolderLogo(folderId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const storageRef = ref(storage, `logos/folders/${folderId}/logo.${ext}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await setDoc(doc(db, 'folders', folderId), { folderLogoUrl: url }, { merge: true });
  return url;
}

export async function deleteFolderLogo(folderId: string): Promise<void> {
  for (const ext of ['png', 'jpg', 'jpeg', 'svg', 'webp']) {
    try { await deleteObject(ref(storage, `logos/folders/${folderId}/logo.${ext}`)); } catch { /* skip */ }
  }
  await setDoc(doc(db, 'folders', folderId), { folderLogoUrl: null }, { merge: true });
}

// Legacy compat — used by WorkspaceReport
export async function getWorkspaceLogo(uid: string): Promise<string | null> {
  const s = await getWorkspaceSettings(uid);
  return s.boardLogoUrl;
}
