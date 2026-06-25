'use client';

import { useEffect, useState, useMemo } from 'react';
import { onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import type { QueryRef } from '@/firebase/api/firestore-shim';

export function useCollection(queryRef: QueryRef | null) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const queryKey = useMemo(() => {
    if (!queryRef) return null;
    return JSON.stringify({
      collection: queryRef.collection,
      where: queryRef.where,
      orderBy: queryRef.orderBy,
      limit: queryRef.limit,
    });
  }, [queryRef]);

  useEffect(() => {
    if (!queryRef || !queryKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error('Collection Error:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [queryKey, queryRef]);

  return { data, loading, error };
}
