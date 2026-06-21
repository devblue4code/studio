
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, signOut } from 'firebase/auth';

interface FirebaseContextProps {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  employeeData: any | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextProps | undefined>(undefined);

export const FirebaseProvider: React.FC<{
  children: React.ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}> = ({ children, firebaseApp, firestore, auth }) => {
  const [user, setUser] = useState<User | null>(null);
  const [employeeData, setEmployeeData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Limpa listener anterior se existir
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (currentUser) {
        setLoading(true);
        const q = query(collection(firestore, 'employees'), where('uid', '==', currentUser.uid));
        
        unsubscribeDoc = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            setEmployeeData({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
            setLoading(false);
          } else {
            // Tenta busca por email caso o UID ainda não esteja propagado
            const qEmail = query(collection(firestore, 'employees'), where('email', '==', currentUser.email?.toUpperCase()));
            getDocs(qEmail).then(snapEmail => {
              if (!snapEmail.empty) {
                setEmployeeData({ id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() });
              } else {
                setEmployeeData(null);
              }
              setLoading(false);
            }).catch(() => {
              setLoading(false);
            });
          }
        }, (error) => {
          console.error("Erro no listener de employeeData:", error);
          setLoading(false);
        });
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

  const logout = async () => {
    await signOut(auth);
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
    firestore: context.firestore
  };
};

export const useFirebaseApp = () => useFirebase().firebaseApp;
export const useFirestore = () => useFirebase().firestore;
export const useFirebaseAuth = () => useFirebase().auth;
