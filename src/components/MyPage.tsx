import { useState } from 'react';
import { db, collection, query, orderBy, auth } from '../firebase';
import { where } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Scrap } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MessageSquare, Clock, ChevronRight, Loader2, User, LayoutGrid, CheckCircle2, Circle, Code, Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { CommentCount } from './CommentCount';
import { toast } from 'sonner';

import { ScrapStats } from './ScrapStats';

interface MyPageProps {
  onSelectScrap: (scrap: Scrap) => void;
  onSelectUser: (userId: string) => void;
}

export function MyPage({ onSelectScrap, onSelectUser }: MyPageProps) {
  const [statusTab, setStatusTab] = useState<'open' | 'closed'>('open');
  const [copied, setCopied] = useState(false);
  const user = auth.currentUser;

  const embedCode = user ? `<iframe src="${window.location.origin}/users/${user.uid}?embed=true" width="100%" height="600" frameborder="0" style="border-radius: 12px; border: 1px solid #eee;"></iframe>` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success('埋め込みコードをコピーしました');
    setTimeout(() => setCopied(false), 2000);
  };

  const [value, loading, error] = useCollection(
    user ? query(
      collection(db, 'scraps'),
      where('authorId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    ) : null
  );

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">ログインが必要です</p>
      </div>
    );
  }

  const allScraps = value?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scrap)) || [];
  const filteredScraps = allScraps.filter(s => s.status === statusTab);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            {user.photoURL && user.photoURL !== "" ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || ''} 
                className="w-8 h-8 rounded-full shadow-sm border border-gray-100" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <User className="w-8 h-8 text-blue-600" />
            )}
            <div className="flex items-center gap-3">
              <span>{user.displayName || 'マイページ'}</span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-95 border border-gray-100"
                title="埋め込み用iframeコードをコピー"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Code className="w-3 h-3" />}
                <span className="hidden sm:inline">iframeをコピー</span>
              </button>
            </div>
          </h2>

          <ScrapStats scraps={allScraps} className="w-full sm:w-64" />
        </div>
      </div>

      <div className="space-y-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-t-2xl self-start w-fit">
          <button
            onClick={() => setStatusTab('open')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all",
              statusTab === 'open' 
                ? "bg-white text-emerald-600 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Circle className="w-4 h-4" />
            オープン
          </button>
          <button
            onClick={() => setStatusTab('closed')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all",
              statusTab === 'closed' 
                ? "bg-white text-gray-600 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <CheckCircle2 className="w-4 h-4" />
            クローズ
          </button>
        </div>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-500 font-medium">読み込み中...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
          <p className="font-bold">スレッドの取得に失敗しました</p>
          <p className="text-sm opacity-80">{error.message}</p>
        </div>
      ) : filteredScraps.length === 0 ? (
        <div className="text-center py-20 px-4 bg-white rounded-3xl border border-gray-100 border-dashed">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {statusTab === 'open' ? 'オープンなスレッドはありません' : 'クローズしたスレッドはありません'}
          </h3>
          <p className="text-gray-500 mt-1">
            {statusTab === 'open' ? '新しい思考を記録しましょう。' : '完了した思考がここに表示されます。'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-b-3xl rounded-tr-3xl border border-gray-100 shadow-sm overflow-hidden">
        <AnimatePresence mode="popLayout">
          {filteredScraps.map((scrap, index) => (
            <motion.div
              key={scrap.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
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
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      )}
    </div>
  </div>
  );
}
