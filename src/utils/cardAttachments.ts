import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';
import type { Kanban, CardAttachment } from '../types';
import { MAX_ATTACHMENTS_BYTES, MAX_USER_ATTACHMENTS_BYTES } from '../constants';

// `otherOwnedKanbansBytes` is the caller's attachment usage across their
// OTHER owned kanbans (excluding this one) — the account-wide free-tier cap
// only counts boards the uploader owns, not shared boards owned by someone
// else, since that storage cost is really attributed to the actual owner.
export async function uploadCardAttachment(
  kanban: Kanban,
  cardId: string,
  file: File,
  otherOwnedKanbansBytes = 0,
): Promise<Kanban> {
  if ((kanban.attachmentsBytes ?? 0) + file.size > MAX_ATTACHMENTS_BYTES) {
    throw new Error('over-kanban-limit');
  }
  if (otherOwnedKanbansBytes + (kanban.attachmentsBytes ?? 0) + file.size > MAX_USER_ATTACHMENTS_BYTES) {
    throw new Error('over-user-limit');
  }
  const attachmentId = crypto.randomUUID();
  const path = `cardAttachments/${kanban.id}/${cardId}/${attachmentId}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  const attachment: CardAttachment = { id: attachmentId, name: file.name, url, path, size: file.size, type: file.type };
  const updated: Kanban = {
    ...kanban,
    cards: kanban.cards.map(c => c.id === cardId ? { ...c, attachments: [...(c.attachments ?? []), attachment] } : c),
    attachmentsBytes: (kanban.attachmentsBytes ?? 0) + file.size,
  };
  await setDoc(doc(db, 'kanbans', kanban.id), updated);
  return updated;
}

// Comment images/gifs count against the same per-kanban/per-account caps as
// card attachments. Deliberately does NOT write attachmentsBytes to
// Firestore itself (unlike uploadCardAttachment) — the comment this image
// belongs to doesn't exist yet at upload time, and a separate immediate
// setDoc here would race the debounced save that adds the comment moments
// later, risking the byte bump getting silently overwritten. Instead the
// caller folds the returned size into the same local state update that
// adds the comment (see BoardPage's handleCardsChange bytes delta param).
export async function uploadCommentImage(
  kanban: Kanban,
  cardId: string,
  file: File,
  otherOwnedKanbansBytes = 0,
): Promise<{ url: string; path: string; size: number }> {
  if ((kanban.attachmentsBytes ?? 0) + file.size > MAX_ATTACHMENTS_BYTES) {
    throw new Error('over-kanban-limit');
  }
  if (otherOwnedKanbansBytes + (kanban.attachmentsBytes ?? 0) + file.size > MAX_USER_ATTACHMENTS_BYTES) {
    throw new Error('over-user-limit');
  }
  const id = crypto.randomUUID();
  const path = `cardAttachments/${kanban.id}/${cardId}/comments/${id}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, path, size: file.size };
}

export async function deleteCommentImageFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // already gone — proceed regardless
  }
}

export async function deleteCardAttachment(kanban: Kanban, cardId: string, attachment: CardAttachment): Promise<Kanban> {
  try {
    await deleteObject(ref(storage, attachment.path));
  } catch {
    // already gone — proceed to remove the reference regardless
  }
  const updated: Kanban = {
    ...kanban,
    cards: kanban.cards.map(c => c.id === cardId
      ? { ...c, attachments: (c.attachments ?? []).filter(a => a.id !== attachment.id) }
      : c),
    attachmentsBytes: Math.max(0, (kanban.attachmentsBytes ?? 0) - attachment.size),
  };
  await setDoc(doc(db, 'kanbans', kanban.id), updated);
  return updated;
}
