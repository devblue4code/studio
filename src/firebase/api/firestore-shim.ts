/**
 * Firestore compatibility shim — redirects all Firestore operations to REST API.
 * Enabled via tsconfig path alias: "firebase/firestore" -> this file
 */

import { api } from '@/lib/api-client';

// --- Types (opaque refs) ---

export interface ApiFirestore {
  _type: 'api-firestore';
}

export interface CollectionRef {
  _type: 'collection';
  path: string;
}

export interface DocRef {
  _type: 'doc';
  collection: string;
  id: string;
}

export interface QueryRef {
  _type: 'query';
  collection: string;
  where: { field: string; op: string; value: unknown }[];
  orderBy: { field: string; direction?: 'asc' | 'desc' }[];
  limit?: number;
}

export type Firestore = ApiFirestore;
export type DocumentData = Record<string, unknown>;
export type Query<T = DocumentData> = QueryRef;
export type DocumentReference<T = DocumentData> = DocRef;
export type QuerySnapshot<T = DocumentData> = { docs: { id: string; data: () => T; exists: boolean }[] };
export type DocumentSnapshot<T = DocumentData> = { id: string; data: () => T; exists: boolean };

// --- Firestore instance ---

export function getFirestore(_app?: unknown): ApiFirestore {
  return { _type: 'api-firestore' };
}

// --- Collection / Doc ---

export function collection(_firestore: ApiFirestore, path: string, ..._segments: string[]): CollectionRef {
  const fullPath = [path, ..._segments].join('/');
  return { _type: 'collection', path: fullPath };
}

export function doc(_firestore: ApiFirestore, path: string, ...segments: string[]): DocRef {
  const parts = [path, ...segments];
  if (parts.length === 2 && !parts[1].includes('/')) {
    return { _type: 'doc', collection: parts[0], id: parts[1] };
  }
  // settings/vacation pattern
  if (parts[0] === 'settings') {
    return { _type: 'doc', collection: 'settings', id: parts[1] };
  }
  const id = parts[parts.length - 1];
  const collectionPath = parts.slice(0, -1).join('/');
  return { _type: 'doc', collection: collectionPath, id };
}

// --- Query builders ---

export function query(
  ref: CollectionRef | QueryRef,
  ...constraints: unknown[]
): QueryRef {
  const base: QueryRef = ref._type === 'query'
    ? { ...ref }
    : { _type: 'query', collection: ref.path, where: [], orderBy: [] };

  for (const c of constraints) {
    const constraint = c as { _type: string; field?: string; op?: string; value?: unknown; direction?: string; count?: number };
    if (constraint._type === 'where') {
      base.where.push({ field: constraint.field!, op: constraint.op!, value: constraint.value });
    } else if (constraint._type === 'orderBy') {
      base.orderBy.push({ field: constraint.field!, direction: constraint.direction as 'asc' | 'desc' });
    } else if (constraint._type === 'limit') {
      base.limit = constraint.count;
    }
  }

  return base;
}

export function where(field: string, op: string, value: unknown) {
  return { _type: 'where', field, op, value };
}

export function orderBy(field: string, direction?: 'asc' | 'desc') {
  return { _type: 'orderBy', field, direction: direction || 'asc' };
}

export function limit(count: number) {
  return { _type: 'limit', count };
}

// --- Timestamps ---

export function serverTimestamp() {
  return { _serverTimestamp: true, toDate: () => new Date() };
}

export function arrayUnion(...values: unknown[]) {
  return { _arrayUnion: values };
}

// --- Write operations ---

export async function addDoc(colRef: CollectionRef, data: DocumentData) {
  const result = await api.addDoc(colRef.path, data);
  return { id: result.doc.id as string };
}

export async function updateDoc(docRef: DocRef, data: DocumentData) {
  if (docRef.collection === 'settings') {
    await api.setSetting(docRef.id, data);
    return;
  }
  await api.updateDoc(docRef.collection, docRef.id, data);
}

export async function setDoc(docRef: DocRef, data: DocumentData, options?: { merge?: boolean }) {
  if (docRef.collection === 'settings') {
    if (options?.merge) {
      const existing = await api.getSetting(docRef.id);
      await api.setSetting(docRef.id, { ...existing.doc, ...data });
    } else {
      await api.setSetting(docRef.id, data);
    }
    return;
  }
  try {
    await api.updateDoc(docRef.collection, docRef.id, data);
  } catch {
    await api.addDoc(docRef.collection, { ...data, id: docRef.id });
  }
}

export async function deleteDoc(docRef: DocRef) {
  await api.deleteDoc(docRef.collection, docRef.id);
}

// --- Read operations (one-time) ---

export async function getDocs(q: QueryRef): Promise<QuerySnapshot> {
  const result = await api.query({
    collection: q.collection,
    where: q.where,
    orderBy: q.orderBy,
    limit: q.limit,
  });

  return {
    docs: result.docs.map((d) => ({
      id: d.id as string,
      exists: true,
      data: () => d as DocumentData,
    })),
  };
}

export async function getDoc(docRef: DocRef): Promise<DocumentSnapshot> {
  if (docRef.collection === 'settings') {
    const result = await api.getSetting(docRef.id);
    return {
      id: docRef.id,
      exists: !!result.doc,
      data: () => result.doc as DocumentData,
    };
  }

  const result = await api.getDoc(docRef.collection, docRef.id);
  return {
    id: docRef.id,
    exists: !!result.doc,
    data: () => result.doc as DocumentData,
  };
}

// --- Snapshot listener (polling) ---

type SnapshotCallback = (snapshot: QuerySnapshot | DocumentSnapshot) => void;

export function onSnapshot(
  ref: QueryRef | DocRef,
  onNext: SnapshotCallback,
  onError?: (error: Error) => void
): () => void {
  let active = true;
  const POLL_MS = 5000;

  const poll = async () => {
    if (!active) return;
    try {
      if ((ref as QueryRef)._type === 'query') {
        const q = ref as QueryRef;
        const result = await api.query({
          collection: q.collection,
          where: q.where,
          orderBy: q.orderBy,
          limit: q.limit,
        });
        onNext({
          docs: result.docs.map((d) => ({
            id: d.id as string,
            exists: true,
            data: () => d as DocumentData,
          })),
        } as QuerySnapshot);
      } else {
        const d = ref as DocRef;
        if (d.collection === 'settings') {
          const result = await api.getSetting(d.id);
          onNext({
            id: d.id,
            exists: !!result.doc,
            data: () => result.doc as DocumentData,
          });
        } else {
          const result = await api.getDoc(d.collection, d.id);
          onNext({
            id: d.id,
            exists: !!result.doc,
            data: () => result.doc as DocumentData,
          });
        }
      }
    } catch (err) {
      onError?.(err as Error);
    }

    if (active) setTimeout(poll, POLL_MS);
  };

  poll();
  return () => { active = false; };
}

// Re-export Timestamp-like helper for compatibility
export const Timestamp = {
  now: () => ({ toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000) }),
  fromDate: (d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime() / 1000) }),
};
