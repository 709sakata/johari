import { useState, useEffect } from 'react';
import { db, collection, query, orderBy, doc, getDoc } from '../firebase';
import { where } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Scrap } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MessageSquare, Clock, ChevronRight, Loader2, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { CommentCount } from './CommentCount';
import { ExpandableBio } from './ExpandableBio';
import { ScrapStats } from './ScrapStats';

interface PublicProfileProps {
  userId: string;
  onSelectScrap: (scrap: Scrap) => void;
  onSelectUser: (userId: string) => void;
}

export function PublicProfile({ userId, onSelectScrap, onSelectUser }: PublicProfileProps) {
  const [userProfile, setUserProfile] = useState<{ displayName?: string; photoURL?: string; bio?: string } | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      setIsProfileLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setIsProfileLoading(false);
      }
    }
    fetchProfile();
  }, [userId]);

  const [value, loading, error] = useCollection(
    query(
      collection(db, 'scraps'),
      where('authorId', '==', userId),
      orderBy('updatedAt', 'desc')
    )
  );

  const allScraps = value?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scrap)) || [];

  if (isProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-gray-500 font-medium">プロフィールを読み込み中...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">ユーザーが見つかりません</h3>
        <p className="text-gray-500 mt-1">お探しのユーザーは存在しないか、非公開です。</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {userProfile.photoURL && userProfile.photoURL !== "" ? (
            <img 
              src={userProfile.photoURL} 
              alt={userProfile.displayName || ''} 
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full shadow-lg border-4 border-white" 
              referrerPolicy="no-referrer" 
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-blue-50 flex items-center justify-center border-4 border-white shadow-lg">
              <User className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600" />
            </div>
          )}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
              {userProfile.displayName || 'Anonymous'}
            </h2>
            {userProfile.bio ? (
              <ExpandableBio bio={userProfile.bio} className="max-w-2xl" />
            ) : (
              <p className="text-xs text-gray-400 italic">自己紹介はありません</p>
            )}
          </div>

          <div className="w-full md:w-64 mt-4 md:mt-0">
            <ScrapStats scraps={allScraps} />
          </div>
        </div>
      </div>

      {/* Scraps Section */}
      <div className="space-y-0">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
          <p className="font-bold">スレッドの取得に失敗しました</p>
        </div>
      ) : allScraps.length === 0 ? (
        <div className="text-center py-20 px-4 bg-white rounded-3xl border border-gray-100 border-dashed">
          <h3 className="text-lg font-bold text-gray-900">
            スレッドはありません
          </h3>
        </div>
      ) : (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <AnimatePresence mode="popLayout">
          {allScraps.map((scrap, index) => (
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
