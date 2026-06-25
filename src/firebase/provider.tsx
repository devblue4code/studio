'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { api, getAuthToken } from '@/lib/api-client';

const USE_API = process.env.NEXT_PUBLIC_USE_API === 'true';

interface FirebaseContextProps {
  firebaseApp: unknown;
  firestore: unknown;
  auth: unknown;
  user: User | null;
  employeeData: Record<string, unknown> | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextProps | undefined>(undefined);

export const FirebaseProvider: React.FC<{
  children: React.ReactNode;
  firebaseApp: unknown;
  firestore: unknown;
  auth: unknown;
}> = ({ children, firebaseApp, firestore, auth }) => {
  const [user, setUser] = useState<User | null>(null);
  const [employeeData, setEmployeeData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_API) {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      api.me()
        .then((res) => {
          setUser({ uid: res.user.uid, email: res.user.email, displayName: null } as User);
          setEmployeeData(res.employee);
          setLoading(false);
        })
        .catch(() => {
          setUser(null);
          setEmployeeData(null);
          setLoading(false);
        });

      const interval = setInterval(() => {
        if (getAuthToken()) {
          api.me()
            .then((res) => {
              setEmployeeData(res.employee);
            })
            .catch(() => {});
        }
      }, 10000);

      return () => clearInterval(interval);
    }

    // Firebase mode (legacy)
    const { onAuthStateChanged: onAuth, signOut: fbSignOut } = require('firebase/auth');
    const { onSnapshot, collection, query, where, getDocs } = require('firebase/firestore');

    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuth(auth, async (currentUser: User | null) => {
      setUser(currentUser);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (currentUser) {
        setLoading(true);
        const q = query(collection(firestore, 'employees'), where('uid', '==', currentUser.uid));

        unsubscribeDoc = onSnapshot(q, (snapshot: { empty: boolean; docs: { id: string; data: () => Record<string, unknown> }[] }) => {
          if (!snapshot.empty) {
            setEmployeeData({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
            setLoading(false);
          } else {
            const qEmail = query(collection(firestore, 'employees'), where('email', '==', currentUser.email?.toUpperCase()));
            getDocs(qEmail).then((snapEmail: { empty: boolean; docs: { id: string; data: () => Record<string, unknown> }[] }) => {
              if (!snapEmail.empty) {
                setEmployeeData({ id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() });
              } else {
                setEmployeeData(null);
              }
              setLoading(false);
            }).catch(() => setLoading(false));
          }
        }, () => setLoading(false));
      } else {
        setEmployeeData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [auth, firestore]);

  // API mode: also listen to auth state from shim
  useEffect(() => {
    if (!USE_API) return;

    const unsubscribe = onAuthStateChanged(auth as never, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setEmployeeData(null);
        setLoading(false);
      } else {
        api.me()
          .then((res) => {
            setEmployeeData(res.employee);
            setLoading(false);
          })
          .catch(() => {
            setEmployeeData(null);
            setLoading(false);
          });
      }
    });

    return unsubscribe;
  }, [auth]);

  const logout = async () => {
    if (USE_API) {
      const { setAuthToken } = await import('@/lib/api-client');
      setAuthToken(null);
      setUser(null);
      setEmployeeData(null);
      await signOut(auth as never);
    } else {
      await signOut(auth as never);
    }
  };

  return (
    <FirebaseContext.Provider value={{ firebaseApp, firestore, auth, user, employeeData, loading, logout }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useFirebase must be used within FirebaseProvider');
  return context;
};

export const useAuth = () => {
  const context = useFirebase();
  return {
    user: context.user,
    employeeData: context.employeeData,
    loading: context.loading,
    logout: context.logout,
    auth: context.auth,
    firestore: context.firestore,
  };
};

export const useFirestore = () => useFirebase().firestore;
export const useFirebaseApp = () => useFirebase().firebaseApp;
export const useFirebaseAuth = () => useFirebase().auth;
