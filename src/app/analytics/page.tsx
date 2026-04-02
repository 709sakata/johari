'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnalyticsDashboard } from '../../components/AnalyticsDashboard';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { useAuth } from '../../components/FirebaseProvider';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function AnalyticsRoute() {
  const router = useRouter();
  const { user, isAuthReady } = useAuth();
  const isAdmin = user?.email === 'naoki.sakata@hopin.co.jp';

  useEffect(() => {
    if (isAuthReady && !isAdmin) {
      // Redirect non-admins after auth is ready
      // router.push('/'); 
    }
  }, [isAuthReady, isAdmin, router]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="text-center glass p-12 rounded-[2.5rem] border border-white/40 shadow-2xl max-w-md w-full">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-red-500/10">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-4">アクセス権限がありません</h2>
            <p className="text-gray-500 mb-8 font-medium">このページを表示するには管理者権限が必要です。</p>
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
        <AnalyticsDashboard />
      </main>
      <Footer />
    </div>
  );
}
