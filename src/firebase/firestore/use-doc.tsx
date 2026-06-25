'use client';

import { useEffect, useState, useMemo } from 'react';
import { onSnapshot, DocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { DocRef } from '@/firebase/api/firestore-shim';

export function useDoc(docRef: DocRef | null) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const docKey = useMemo(() => {
    if (!docRef) return null;
    return `${docRef.collection}/${docRef.id}`;
  }, [docRef]);

  useEffect(() => {
    if (!docRef || !docKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        setData(snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error('Doc Error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docKey, docRef]);

  return { data, loading, error };
}
