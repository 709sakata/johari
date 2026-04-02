'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MyPage } from '../../components/MyPage';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { useAuth } from '../../components/FirebaseProvider';
import { Loader2 } from 'lucide-react';

export default function MyPageRoute() {
  const router = useRouter();
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="text-center glass p-12 rounded-[2.5rem] border border-white/40 shadow-2xl max-w-md w-full">
            <h2 className="text-2xl font-black text-gray-900 mb-4">ログインが必要です</h2>
            <p className="text-gray-500 mb-8 font-medium">マイページを表示するにはログインしてください。</p>
            <button
              onClick={() => router.push('/')}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              トップページに戻る
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow max-w-6xl mx-auto px-4 py-8 w-full">
        <MyPage
          onSelectScrap={(scrap) => router.push(`/scraps/${scrap.id}`)}
          onSelectUser={(userId) => router.push(`/profile/${userId}`)}
        />
      </main>
      <Footer />
    </div>
  );
}
