import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import type { Kanban } from '../types';

export function useKanban(id: string) {
  const { user } = useAuth();
  const [kanban, setKanban] = useState<Kanban | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Tracks the last state received from Firestore so BoardPage can skip
  // saving when a change originated remotely (not from this client).
  const remoteVersion = useRef<Kanban | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    setLoading(true);
    setNotFound(false);

    const unsub = onSnapshot(
      doc(db, 'kanbans', id),
      snap => {
        if (!snap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const data = { id: snap.id, ...snap.data() } as Kanban;
        const hasAccess = data.ownerId === user.uid
          || data.memberIds.includes(user.uid)
          || (data.coOwnerIds ?? []).includes(user.uid)
          || (data.viewerIds ?? []).includes(user.uid);
        if (!hasAccess) {
          setNotFound(true);
        } else {
          remoteVersion.current = data;
          setKanban(data);
        }
        setLoading(false);
      },
      () => { setNotFound(true); setLoading(false); },
    );

    return unsub;
  }, [id, user]);

  return { kanban, setKanban, remoteVersion, loading, notFound };
}
