import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import type { Kanban } from '../types';

export function useKanban(id: string) {
  const { user } = useAuth();
  const [kanban, setKanban] = useState<Kanban | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    setLoading(true);
    setNotFound(false);
    getDoc(doc(db, 'kanbans', id)).then(snap => {
      if (!snap.exists()) {
        setNotFound(true);
      } else {
        const data = { id: snap.id, ...snap.data() } as Kanban;
        const hasAccess = data.ownerId === user.uid
          || data.memberIds.includes(user.uid)
          || (data.coOwnerIds ?? []).includes(user.uid);
        if (!hasAccess) { setNotFound(true); }
        else { setKanban(data); }
      }
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [id, user]);

  return { kanban, setKanban, loading, notFound };
}
