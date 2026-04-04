import { auth, googleProvider, signInWithPopup, signOut, db, doc, setDoc, serverTimestamp } from '../firebase';
import Image from 'next/image';
import { LogIn, LogOut, User as UserIcon, Edit3, Check, X, Loader2 } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocument } from 'react-firebase-hooks/firestore';
import { useState, useRef, useEffect } from 'react';
import { ExpandableBio } from './ExpandableBio';
import { OperationType } from '../types';
import { handleFirestoreError } from '../lib/firestore';

interface AuthProps {
  onMyPageClick?: () => void;
}

export function Auth({ onMyPageClick }: AuthProps) {
  const [user, loading, error] = useAuthState(auth);
  const [userDoc, userDocLoading] = useDocument(user ? doc(db, `users/${user.uid}`) : null);
  const [showLogout, setShowLogout] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioContent, setBioContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const bio = userDoc?.data()?.bio || '';

  useEffect(() => {
    if (isEditingBio) {
      setBioContent(bio);
    }
  }, [isEditingBio, bio]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLogout(false);
        setIsEditingBio(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBioKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey)) {
      if (e.key === 'b') {
        e.preventDefault();
        insertMarkdownIntoBio('**', '**', e.currentTarget);
      } else if (e.key === 'i') {
        e.preventDefault();
        insertMarkdownIntoBio('*', '*', e.currentTarget);
      } else if (e.key === 'k') {
        e.preventDefault();
        insertMarkdownIntoBio('[', '](url)', e.currentTarget);
      }
    }
  };

  const insertMarkdownIntoBio = (prefix: string, suffix: string, textarea: HTMLTextAreaElement) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = bioContent.substring(start, end);
    const newText = bioContent.substring(0, start) + prefix + selectedText + suffix + bioContent.substring(end);
    
    setBioContent(newText);

    // Set cursor position after update
    setTimeout(() => {
      textarea.focus();
      if (start === end) {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      } else {
        textarea.setSelectionRange(start + prefix.length + selectedText.length + suffix.length, start + prefix.length + selectedText.length + suffix.length);
      }
    }, 0);
  };

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        // Ensure user document exists
        await setDoc(doc(db, `users/${result.user.uid}`), {
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (err) {
      console.error('Login failed', err);
    }
  };

  const handleSaveBio = async () => {
    if (!user) return;
    setIsSaving(true);
    const path = `users/${user.uid}`;
    try {
      await setDoc(doc(db, path), {
        bio: bioContent.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      setIsEditingBio(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  if (loading) return <div className="animate-pulse h-10 w-32 bg-gray-200 rounded-lg" />;
  if (error) return <div className="text-red-500 text-sm">認証エラー: {error.message}</div>;

  if (user) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowLogout(!showLogout)}
          className="flex items-center focus:outline-none"
        >
          {user.photoURL && user.photoURL !== "" ? (
            <div className="relative w-9 h-9">
              <Image 
                src={user.photoURL} 
                alt={user.displayName || ''} 
                fill
                sizes="36px"
                className="rounded-full border-2 border-white shadow-sm hover:border-blue-100 transition-all object-cover" 
                referrerPolicy="no-referrer" 
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white shadow-sm">
              <UserIcon className="w-5 h-5 text-gray-500" />
            </div>
          )}
        </button>

        {showLogout && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">アカウント</p>
              <p className="text-sm font-black text-gray-900 truncate">{user.displayName}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
            </div>

            <div className="px-4 py-3 border-b border-gray-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">自己紹介</p>
                {!isEditingBio && (
                  <button 
                    onClick={() => setIsEditingBio(true)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              {isEditingBio ? (
                <div className="space-y-2">
                  <textarea
                    value={bioContent}
                    onChange={(e) => setBioContent(e.target.value)}
                    onKeyDown={handleBioKeyDown}
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="自己紹介を入力..."
                    rows={3}
                    autoFocus
                  />
                  <div className="flex justify-end gap-1">
                    <button 
                      onClick={() => setIsEditingBio(false)}
                      className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleSaveBio}
                      disabled={isSaving}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <ExpandableBio bio={bio || '自己紹介がありません。'} className="text-xs text-gray-600" />
              )}
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  onMyPageClick?.();
                  setShowLogout(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <UserIcon className="w-4 h-4" />
                マイページ
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all shadow-sm active:scale-95"
    >
      <LogIn className="w-4 h-4" />
      Googleでログイン
    </button>
  );
}
