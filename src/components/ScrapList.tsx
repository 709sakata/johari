import { useEffect, useState } from 'react';
import { db, collection, query, orderBy, doc, updateDoc } from '../firebase';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Scrap } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MessageSquare, Clock, User, Loader2, LayoutGrid, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { DIVERSE_EMOJIS } from '../constants/emojis';

import { ScrapStats } from './ScrapStats';
import { CommentCount } from './CommentCount';

import { TruncatedTitle } from './TruncatedTitle';

interface ScrapListProps {
  onSelectScrap: (scrap: Scrap) => void;
  onSelectUser: (userId: string) => void;
  initialScraps?: Scrap[];
}

export function ScrapList({ onSelectScrap, onSelectUser, initialScraps }: ScrapListProps) {
  const [value, loading, error] = useCollection(
    query(collection(db, 'scraps'), orderBy('updatedAt', 'desc'))
  );
  const [windowWidth, setWindowWidth] = useState<number>(1200);

  const scraps = value?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scrap)) || initialScraps || [];
  const isActuallyLoading = loading && scraps.length === 0;

  const getDisplayDate = (date: any) => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    return new Date(date);
  };

  useEffect(() => {
    setWindowWidth(window.innerWidth);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Migration: Assign random emojis to existing scraps missing one
  useEffect(() => {
    if (!loading && value && value.docs.length > 0) {
      const scrapsWithoutEmoji = value.docs.filter(doc => !doc.data().icon_emoji);
      
      if (scrapsWithoutEmoji.length > 0) {
        console.log(`Migrating ${scrapsWithoutEmoji.length} scraps without emojis...`);
        scrapsWithoutEmoji.forEach(async (scrapDoc) => {
          const randomEmoji = DIVERSE_EMOJIS[Math.floor(Math.random() * DIVERSE_EMOJIS.length)];
          try {
            await updateDoc(doc(db, 'scraps', scrapDoc.id), {
              icon_emoji: randomEmoji
            });
          } catch (err) {
            console.error(`Failed to update emoji for scrap ${scrapDoc.id}:`, err);
          }
        });
      }
    }
  }, [loading, value]);

  if (isActuallyLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-gray-500 font-medium">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
        <p className="font-bold">スレッドの取得に失敗しました</p>
        <p className="text-sm opacity-80">{error.message}</p>
      </div>
    );
  }

  if (scraps.length === 0) {
    return (
      <div className="text-center py-32 px-4">
        <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-500/5 ring-1 ring-black/5">
          <Sparkles className="w-10 h-10 text-blue-600" />
        </div>
        <h3 className="font-display text-2xl font-bold text-gray-900 mb-3 tracking-tight">思考の旅を始めましょう</h3>
        <p className="text-gray-500 max-w-sm mx-auto leading-relaxed">
          まだスレッドがありません。最初のスレッドを作成して、あなたの思考を記録し、未知の自分を発見しましょう。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ScrapStats scraps={scraps} className="w-full sm:w-64" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {scraps.map((scrap, index) => (
          <motion.div
            key={scrap.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectScrap(scrap)}
            className="group relative w-full p-3 sm:p-4 bg-white/60 backdrop-blur-sm rounded-[1.25rem] sm:rounded-[2.5rem] transition-all cursor-pointer overflow-hidden flex items-center gap-3 sm:gap-8 border border-white/40 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-100 hover:-translate-y-1.5"
          >
            {/* Glass reflection effect */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
            
            {/* Left Side: Emoji Block (Rounded Rectangle) */}
            <div className="w-14 h-14 sm:w-32 sm:h-32 bg-slate-50 rounded-[1rem] sm:rounded-[2rem] flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-105 group-hover:bg-blue-50 shadow-inner">
              <span className="text-2xl sm:text-5xl select-none filter drop-shadow-sm transition-transform group-hover:rotate-12">
                {scrap.icon_emoji || '📄'}
              </span>
            </div>

            {/* Right Side: Content */}
            <div className="flex-1 min-w-0 pr-1 sm:pr-10 py-0.5 sm:py-3 relative z-10">
              <h3 className={cn(
                "font-display font-bold text-gray-900 group-hover:text-blue-600 transition-colors break-words mb-1.5 sm:mb-3 leading-tight tracking-tight",
                scrap.title.length > 40 ? "text-xs sm:text-lg" : "text-sm sm:text-xl"
              )}>
                <TruncatedTitle title={scrap.title} limit={windowWidth !== null && windowWidth < 640 ? 25 : 45} />
              </h3>

              {/* Tags */}
              {scrap.tags && scrap.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {scrap.tags.slice(0, 3).map(tag => (
                    <span 
                      key={tag}
                      className="px-2 py-0.5 bg-white/80 text-gray-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg border border-gray-100 shadow-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                  {scrap.tags.length > 3 && (
                    <span className="text-[9px] sm:text-[10px] text-gray-400 font-black">
                      +{scrap.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                {/* Author Info */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectUser(scrap.authorId);
                  }}
                  className="flex items-center gap-2.5 hover:text-blue-600 transition-all group/author"
                >
                  {scrap.authorPhoto && scrap.authorPhoto !== "" ? (
                    <div className="relative w-6 h-6 sm:w-7 sm:h-7">
                      <Image 
                        src={scrap.authorPhoto} 
                        alt={scrap.authorName} 
                        fill
                        className="rounded-full shadow-md border-2 border-white group-hover/author:scale-110 transition-transform object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    </div>
                  ) : (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 bg-white rounded-full flex items-center justify-center shadow-md border-2 border-white group-hover/author:scale-110 transition-transform">
                      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                    </div>
                  )}
                  <span className="text-[11px] sm:text-xs font-bold text-gray-700">{scrap.authorName}</span>
                </button>

                {/* Meta Info */}
                <div className="flex items-center gap-4 text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      scrap.status === 'open' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-gray-400"
                    )} />
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      scrap.status === 'open' ? "text-emerald-600" : "text-gray-500"
                    )}>
                      {scrap.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </div>

                  <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {scrap.updatedAt ? formatDistanceToNow(getDisplayDate(scrap.updatedAt)!, { addSuffix: true, locale: ja }) : 'たった今'}
                  </span>
                  
                  <CommentCount scrapId={scrap.id} initialCount={scrap.commentCount} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
