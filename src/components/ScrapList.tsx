import { db, collection, query, orderBy } from '../firebase';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Scrap } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MessageSquare, Clock, User, Loader2, LayoutGrid } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

import { ScrapStats } from './ScrapStats';
import { CommentCount } from './CommentCount';

interface ScrapListProps {
  onSelectScrap: (scrap: Scrap) => void;
  onSelectUser: (userId: string) => void;
}

export function ScrapList({ onSelectScrap, onSelectUser }: ScrapListProps) {
  const [value, loading, error] = useCollection(
    query(collection(db, 'scraps'), orderBy('updatedAt', 'desc'))
  );

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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-3">
          <LayoutGrid className="w-6 h-6 text-blue-600" />
          すべてのスレッド
        </h2>
        <ScrapStats scraps={scraps} className="w-full sm:w-64" />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {scraps.map((scrap, index) => (
          <motion.div
            key={scrap.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectScrap(scrap)}
            className="group relative w-full p-4 sm:p-5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-all cursor-pointer overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full",
                    scrap.status === 'open' 
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                      : "bg-gray-50 text-gray-500 border border-gray-100"
                  )}>
                    {scrap.status === 'open' ? 'オープン' : 'クローズ'}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {scrap.updatedAt ? formatDistanceToNow(scrap.updatedAt.toDate(), { addSuffix: true, locale: ja }) : 'たった今'}
                  </span>
                  <CommentCount scrapId={scrap.id} initialCount={scrap.commentCount} />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors break-words">
                  {scrap.title}
                </h3>
                <div className="mt-3 flex items-center gap-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectUser(scrap.authorId);
                    }}
                    className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                  >
                    {scrap.authorPhoto && scrap.authorPhoto !== "" ? (
                      <img src={scrap.authorPhoto} alt={scrap.authorName} className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-5 h-5 text-gray-400 p-0.5 bg-gray-100 rounded-full" />
                    )}
                    <span className="text-xs font-medium text-gray-600 group-hover:text-inherit">{scrap.authorName}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
