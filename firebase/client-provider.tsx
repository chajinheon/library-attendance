'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Firestore } from 'firebase/firestore';
import { Auth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './config';

interface FirebaseContextValue {
  db: Firestore | null;
  auth: Auth | null;
  isReady: boolean;
}

const FirebaseContext = createContext<FirebaseContextValue>({
  db: null,
  auth: null,
  isReady: false,
});

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error('Anonymous sign-in failed:', e);
        }
      }
      setIsReady(true);
    });
    return () => unsubscribe();
  }, []);

  return (
    <FirebaseContext.Provider value={{ db, auth, isReady }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebaseContext() {
  return useContext(FirebaseContext);
}
