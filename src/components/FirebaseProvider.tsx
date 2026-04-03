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
  const [showForceStart, setShowForceStart] = useState(false);

  console.log('FirebaseProvider: Rendering, isAuthReady:', isAuthReady);

  useEffect(() => {
    console.log('FirebaseProvider: useEffect mounting');
    
    // Safety timeout for auth initialization - reduced to 2 seconds for better UX
    const timeout = setTimeout(() => {
      console.warn('FirebaseProvider: Auth initialization taking longer than 2s...');
      setShowForceStart(true);
    }, 2000);

    // Absolute fallback - proceed after 5 seconds no matter what
    const absoluteTimeout = setTimeout(() => {
      console.error('FirebaseProvider: Absolute timeout reached (5s). Proceeding...');
      setIsAuthReady(true);
    }, 5000);

    let unsubscribe = () => {};

    try {
      console.log('FirebaseProvider: Setting up onAuthStateChanged...');
      unsubscribe = onAuthStateChanged(auth, 
        (user) => {
          console.log('FirebaseProvider: Auth state changed:', user ? `Logged in as ${user.email}` : 'Logged out');
          setUser(user);
          setIsAuthReady(true);
          clearTimeout(timeout);
          clearTimeout(absoluteTimeout);
        },
        (error) => {
          console.error('FirebaseProvider: Auth state error:', error);
          setIsAuthReady(true); // Proceed anyway on error
          clearTimeout(timeout);
          clearTimeout(absoluteTimeout);
        }
      );
    } catch (err) {
      console.error('FirebaseProvider: Setup error in useEffect:', err);
      setIsAuthReady(true);
    }

    return () => {
      console.log('FirebaseProvider: useEffect unmounting');
      unsubscribe();
      clearTimeout(timeout);
      clearTimeout(absoluteTimeout);
    };
  }, []); // Run only once on mount

  return (
    <AuthContext.Provider value={{ user, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};
