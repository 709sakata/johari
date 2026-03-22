import { useEffect } from 'react';
import { db, collection, query, orderBy, doc, updateDoc } from '../firebase';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Scrap } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MessageSquare, Clock, User, Loader2, LayoutGrid, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { DIVERSE_EMOJIS } from '../constants/emojis';

import { ScrapStats } from './ScrapStats';
import { CommentCount } from './CommentCount';

import { TruncatedTitle } from './TruncatedTitle';

interface ScrapListProps {
  onSelectScrap: (scrap: Scrap) => void;
  onSelectUser: (userId: string) => void;
}

export function ScrapList({ onSelectScrap, onSelectUser }: ScrapListProps) {
  const [value, loading, error] = useCollection(
    query(collection(db, 'scraps'), orderBy('updatedAt', 'desc'))
  );

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

  if (loading) {
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

  const scraps = value?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scrap)) || [];

  if (scraps.length === 0) {
    return (
      <div className="text-center py-20 px-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">スレッドがありません</h3>
        <p className="text-gray-500 mt-1">最初のスレッドを作成して、思考の記録を始めましょう。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ScrapStats scraps={scraps} className="w-full sm:w-64" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {scraps.map((scrap, index) => (
          <motion.div
            key={scrap.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectScrap(scrap)}
            className="group relative w-full p-2 bg-slate-50/80 hover:bg-slate-100/80 rounded-[2rem] transition-all cursor-pointer overflow-hidden flex items-center gap-4 sm:gap-5"
          >
            {/* Left Side: Emoji Block (Rounded Rectangle) */}
            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
              <span className="text-2xl sm:text-3xl select-none">
                {scrap.icon_emoji || '📄'}
              </span>
            </div>

            {/* Right Side: Content */}
            <div className="flex-1 min-w-0 pr-4 sm:pr-6 py-1">
              <h3 className={cn(
                "font-bold text-gray-900 group-hover:text-blue-600 transition-colors break-words mb-1.5 leading-tight",
                scrap.title.length > 40 ? "text-xs sm:text-sm" : "text-sm sm:text-base"
              )}>
                <TruncatedTitle title={scrap.title} limit={45} />
              </h3>
              
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {/* Author Info */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectUser(scrap.authorId);
                  }}
                  className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                >
                  {scrap.authorPhoto && scrap.authorPhoto !== "" ? (
                    <img src={scrap.authorPhoto} alt={scrap.authorName} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full shadow-sm" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <User className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                    </div>
                  )}
                  <span className="text-[10px] sm:text-xs font-bold text-gray-700">{scrap.authorName}</span>
                </button>

                {/* Meta Info */}
                <div className="flex items-center gap-3 text-gray-400">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    {scrap.updatedAt ? formatDistanceToNow(scrap.updatedAt.toDate(), { addSuffix: true, locale: ja }) : 'たった今'}
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
