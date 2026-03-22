'use client';

export { useFirebaseContext } from './client-provider';

import { useFirebaseContext } from './client-provider';
import { Firestore, Query, onSnapshot, DocumentData } from 'firebase/firestore';
import { useEffect, useRef, useState, useMemo } from 'react';

export function useFirestore(): Firestore | null {
  const { db } = useFirebaseContext();
  return db;
}

export function useCollection<T extends DocumentData>(
  query: Query<T> | null
): { data: T[]; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [query]);

  return { data, loading, error };
}

export function useMemoFirebase<T>(
  factory: () => T,
  deps: unknown[]
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
