import React from 'react';
import Link from 'next/link';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { db, collection, query, orderBy, limit, getDocs } from '../firebase';
import { MessageSquare, Clock, ArrowRight, Home, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { generateSlug } from '@/lib/utils';

async function getRecentScraps() {
  try {
    const q = query(
      collection(db, 'scraps'),
      orderBy('updatedAt', 'desc'),
      limit(6)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
  } catch (e) {
    console.error('Error fetching recent scraps for 404 page:', e);
    return [];
  }
}

export default async function NotFound() {
  const recentScraps = await getRecentScraps();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow pt-32 pb-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-20">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-50 rounded-[2rem] mb-8 shadow-sm">
              <Search className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-gray-900 mb-6 tracking-tight">
              ページが見つかりません
            </h1>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 font-medium">
              お探しのページは移動したか、削除された可能性があります。<br className="hidden sm:block" />
              代わりに、最近更新されたこちらのスレッドはいかがですか？
            </p>
            <Link 
              href="/"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20 hover:scale-105"
            >
              <Home className="w-5 h-5" />
              ホームに戻る
            </Link>
          </div>

          {recentScraps.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                  <span className="w-1.5 h-8 bg-blue-600 rounded-full" />
                  最近の更新
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {recentScraps.map((scrap) => (
                  <Link 
                    key={scrap.id}
                    href={`/scraps/${scrap.id}/${generateSlug(scrap.title)}`}
                    className="group bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all flex flex-col h-full"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <span className="text-3xl">{scrap.emoji || '📝'}</span>
                      <div className="flex flex-wrap gap-1">
                        {scrap.tags?.slice(0, 2).map((tag: string) => (
                          <span key={tag} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-6 flex-grow leading-snug">
                      {scrap.title}
                    </h3>
                    
                    <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-50">
                      <div className="flex items-center gap-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4" />
                          {scrap.commentCount || 0}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {scrap.updatedAt ? formatDistanceToNow(scrap.updatedAt.toDate(), { addSuffix: true, locale: ja }) : '不明'}
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
