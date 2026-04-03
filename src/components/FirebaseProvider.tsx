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
    // Monkey-patch console.warn/error to prevent circular structure errors in AI Studio
    // Optimized to avoid expensive Object.keys checks on every log
    const originalWarn = console.warn;
    const originalError = console.error;

    const sanitizeArgs = (args: any[]) => {
      return args.map(arg => {
        try {
          if (arg instanceof Node) {
            const id = arg instanceof Element ? arg.id : '';
            return `[DOM Node: ${arg.nodeName}${id ? '#' + id : ''}]`;
          }
          if (typeof arg === 'object' && arg !== null) {
            // Check for React internal properties which cause circularity
            // Using a more direct check instead of Object.keys().some()
            for (const key in arg) {
              if (key.startsWith('__react')) {
                return `[React Internal Object]`;
              }
            }
          }
        } catch (e) {
          return '[Unsafe Object]';
        }
        return arg;
      });
    };

    console.warn = (...args: any[]) => originalWarn(...sanitizeArgs(args));
    console.error = (...args: any[]) => originalError(...sanitizeArgs(args));

    // Safety timeout for auth initialization
    const timeout = setTimeout(() => {
      if (!isAuthReady) {
        console.warn('Auth initialization timed out, proceeding anyway...');
        setIsAuthReady(true);
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      clearTimeout(timeout);
    });

    return () => {
      unsubscribe();
      clearTimeout(timeout);
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [isAuthReady]); // Run once on mount, but include isAuthReady for linting

  if (!isAuthReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-3xl opacity-50 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-3xl opacity-50 animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-200 animate-bounce">
            <MessageSquare className="w-10 h-10 text-white" />
          </div>
          
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <h1 className="text-2xl font-black tracking-tight text-gray-900">
                じょはり<span className="text-blue-600">.</span>
              </h1>
            </div>
            <p className="text-gray-400 font-black tracking-[0.2em] uppercase text-[10px] animate-pulse">
              思考の窓を開いています
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};
