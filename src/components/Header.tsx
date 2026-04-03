'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, Search, TrendingUp } from 'lucide-react';
import { Auth } from './Auth';
import { useAuth } from './FirebaseProvider';
import { cn } from '../lib/utils';
import { usePathname, useRouter } from 'next/navigation';
import { ScrapSearchModal } from './ScrapSearchModal';
import { AnimatePresence } from 'motion/react';

export const Header: React.FC = () => {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isAdmin = user?.email === 'naoki.sakata@hopin.co.jp';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
        <Link 
          href="/"
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 group-hover:scale-105 transition-transform">
            <MessageSquare className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-gray-900 group-hover:text-blue-600 transition-colors">
            じょはり<span className="text-blue-600">.</span>
          </h1>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg sm:rounded-xl border border-gray-100 transition-all group"
            >
              <Search className="w-3.5 h-3.5 sm:w-4 h-4" />
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest hidden sm:inline">検索</span>
              <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 bg-white rounded border border-gray-100 text-[9px] font-black text-gray-300">
                <span className="text-[10px]">⌘</span> K
              </div>
            </button>

            <nav className="hidden md:flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
              <Link
                href="/"
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                  pathname === '/' || pathname.startsWith('/scraps/')
                    ? 'bg-white text-blue-600 shadow-sm border border-gray-100' 
                    : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                スレッド
              </Link>
              {isAdmin && (
                <Link
                  href="/analytics"
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                    pathname === '/analytics'
                      ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' 
                      : 'text-gray-400 hover:text-gray-600'
                  )}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  分析
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Auth onMyPageClick={() => {
              router.push('/mypage', { scroll: false });
            }} />
            {user && (
              <Link
                href="/new-scrap"
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
              >
                <span className="hidden sm:inline">投稿する</span>
                <span className="sm:hidden">投稿</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSearchOpen && (
          <ScrapSearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onSelect={(scrap) => {
              setIsSearchOpen(false);
              router.push(`/scraps/${scrap.id}`, { scroll: false });
            }}
          />
        )}
      </AnimatePresence>
    </header>
  );
};
