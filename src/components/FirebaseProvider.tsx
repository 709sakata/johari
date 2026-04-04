'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, User } from '../firebase';
import { Loader2, MessageSquare } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthReady: false,
});

export const useAuth = () => useContext(AuthContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // Fallback to ensure the app proceeds even if Firebase initialization is slow
    // This prevents the app from being stuck on a loading screen indefinitely
    const fallbackTimeout = setTimeout(() => {
      setIsAuthReady((ready) => {
        if (!ready) {
          console.warn('FirebaseProvider: Auth initialization fallback triggered after 10s.');
          return true;
        }
        return ready;
      });
    }, 10000);

    let unsubscribe = () => {};

    try {
      unsubscribe = onAuthStateChanged(auth, 
        (user) => {
          setUser(user);
          setIsAuthReady(true);
          clearTimeout(fallbackTimeout);
        },
        (error) => {
          console.error('FirebaseProvider: Auth state error:', error);
          setIsAuthReady(true);
          clearTimeout(fallbackTimeout);
        }
      );
    } catch (err) {
      console.error('FirebaseProvider: Setup error:', err);
      setIsAuthReady(true);
      clearTimeout(fallbackTimeout);
    }

    return () => {
      unsubscribe();
      clearTimeout(fallbackTimeout);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};
