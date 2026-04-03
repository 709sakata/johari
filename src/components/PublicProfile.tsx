import { useState, useEffect } from 'react';
import { db, collection, query, orderBy, doc, getDoc } from '../firebase';
import { where } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Scrap, User as UserProfile, UserLink } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MessageSquare, Clock, Loader2, User, ExternalLink, Github, Twitter, Globe, Link as LinkIcon } from 'lucide-react';
import Image from 'next/image';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { CommentCount } from './CommentCount';
import { ExpandableBio } from './ExpandableBio';
import { ScrapStats } from './ScrapStats';
import { LinksDialog } from './LinksDialog';

interface PublicProfileProps {
  userId: string;
  onSelectScrap: (scrap: Scrap) => void;
  onSelectUser: (userId: string) => void;
}

export function PublicProfile({ userId, onSelectScrap, onSelectUser }: PublicProfileProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      setIsProfileLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setUserProfile({ id: userDoc.id, ...userDoc.data() } as UserProfile);
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

  const getPlatformIcon = (url: string) => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('github.com')) return <Github className="w-4 h-4" />;
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return <Twitter className="w-4 h-4" />;
    if (lowerUrl.includes('blog') || lowerUrl.includes('note.com')) return <Globe className="w-4 h-4" />;
    return <LinkIcon className="w-4 h-4" />;
  };

  const [linkSearch, setLinkSearch] = useState('');
  const [isLinksDialogOpen, setIsLinksDialogOpen] = useState(false);

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

  const filteredLinks = (userProfile.links || []).filter(url => 
    url.toLowerCase().includes(linkSearch.toLowerCase())
  );

  const title = `${userProfile.displayName || "ユーザー"} のプロフィール | じょはり`;
  const description = userProfile.bio || `${userProfile.displayName || "ユーザー"} さんの思考の窓。じょはり で思考を整理し、対話を楽しんでいます。`;
  const url = origin ? `${origin}/users/${userProfile.id}` : '';

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="glass p-5 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border border-white/40 shadow-2xl shadow-blue-500/5 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-12 text-center sm:text-left">
          {/* Avatar Area */}
          <div className="relative group/avatar flex-shrink-0">
            {userProfile.photoURL && userProfile.photoURL !== "" ? (
              <div className="relative w-20 h-20 sm:w-40 sm:h-40">
                <Image 
                  src={userProfile.photoURL} 
                  alt={userProfile.displayName || ''} 
                  fill
                  className="rounded-[1.5rem] sm:rounded-[3rem] shadow-2xl border-4 border-white object-cover transition-all duration-500 group-hover/avatar:scale-105 group-hover/avatar:rotate-3" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            ) : (
              <div className="w-20 h-20 sm:w-40 sm:h-40 rounded-[1.5rem] sm:rounded-[3rem] bg-white/50 backdrop-blur-sm flex items-center justify-center border-4 border-white shadow-xl">
                <User className="w-10 h-10 sm:w-20 sm:h-20 text-gray-300" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-12 sm:h-12 bg-blue-600 rounded-lg sm:rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20 border-2 border-white">
              <User className="w-3 h-3 sm:w-6 sm:h-6" />
            </div>
          </div>

          {/* Info Area */}
          <div className="flex-1 flex flex-col items-center sm:items-start gap-3 sm:gap-8 min-w-0">
            <div className="space-y-1 sm:space-y-4 w-full">
              <h2 className="font-display text-xl sm:text-5xl font-bold text-gray-900 tracking-tight">
                {userProfile.displayName || 'Anonymous'}
              </h2>
              {userProfile.bio ? (
                <ExpandableBio bio={userProfile.bio} className="max-w-2xl font-medium text-gray-600 text-xs sm:text-lg leading-relaxed" />
              ) : (
                <p className="text-[10px] sm:text-sm text-gray-400 italic font-medium">自己紹介はありません</p>
              )}
            </div>

            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 sm:gap-6">
              {/* Links */}
              {(userProfile.links || []).length > 0 && (
                <button
                  onClick={() => setIsLinksDialogOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:px-5 sm:py-2.5 bg-white/60 hover:bg-white text-gray-600 rounded-full border border-white/40 shadow-sm transition-all active:scale-95 group"
                >
                  <LinkIcon className="w-3 h-3 sm:w-4 h-4 text-blue-500" />
                  <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider">ソースリンク</span>
                  <span className="px-1.5 py-0.5 bg-gray-900 text-white text-[8px] sm:text-[10px] font-black rounded-full min-w-[1.2rem] text-center">
                    {(userProfile.links || []).length}
                  </span>
                </button>
              )}

              {/* Quick Stats */}
              <div className="flex items-center gap-4 sm:gap-8 py-1.5 px-4 sm:px-8 bg-white/40 backdrop-blur-sm rounded-full border border-white/40 shadow-sm">
                <div className="flex items-center gap-1.5 sm:gap-3">
                  <span className="text-[9px] sm:text-[11px] font-black text-gray-400 uppercase tracking-widest">Threads</span>
                  <span className="text-xs sm:text-lg font-black text-gray-900">{allScraps.length}</span>
                </div>
                <div className="w-px h-3 sm:h-6 bg-gray-200/50" />
                <div className="flex items-center gap-1.5 sm:gap-3">
                  <div className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <span className="text-xs sm:text-lg font-black text-gray-900">{allScraps.filter(s => s.status === 'open').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scraps Section */}
      <div className="space-y-8">
        <h3 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-4 ml-2 tracking-tight">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          スレッド一覧
        </h3>
        
        <div className="space-y-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-8 glass border border-red-100 rounded-[2rem] text-red-600">
              <p className="font-bold">スレッドの取得に失敗しました</p>
            </div>
          ) : allScraps.length === 0 ? (
            <div className="text-center py-24 px-4 glass rounded-[2.5rem] border border-dashed border-gray-200">
              <h3 className="font-display text-xl font-bold text-gray-900">
                スレッドはありません
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence mode="popLayout">
                {allScraps.map((scrap, index) => (
                  <motion.div
                    key={scrap.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onSelectScrap(scrap)}
                    className="group relative w-full p-3 sm:p-5 bg-white/60 backdrop-blur-md hover:bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/40 hover:border-blue-200 transition-all cursor-pointer overflow-hidden flex items-center gap-3 sm:gap-6 hover:shadow-2xl hover:-translate-y-1 shadow-xl shadow-blue-500/5"
                  >
                    {/* Left Side: Emoji Block */}
                    <div className="w-14 h-14 sm:w-28 sm:h-28 bg-white rounded-[1rem] sm:rounded-[2rem] flex items-center justify-center flex-shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:bg-blue-50 shadow-sm border border-gray-50">
                      <span className="text-2xl sm:text-5xl select-none transform transition-transform duration-500 group-hover:rotate-12">
                        {scrap.icon_emoji || '📄'}
                      </span>
                    </div>

                    {/* Right Side: Content */}
                    <div className="flex-1 min-w-0 pr-2 py-0.5">
                      <h3 className={cn(
                        "font-display font-bold text-gray-900 group-hover:text-blue-600 transition-colors break-words mb-1.5 sm:mb-3 line-clamp-2 leading-tight tracking-tight",
                        scrap.title.length > 40 ? "text-sm sm:text-lg" : "text-base sm:text-xl"
                      )}>
                        {scrap.title}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full",
                            scrap.status === 'open' ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-gray-400"
                          )} />
                          <span className={cn(
                            "text-[10px] sm:text-[11px] font-black uppercase tracking-widest",
                            scrap.status === 'open' ? "text-emerald-600" : "text-gray-500"
                          )}>
                            {scrap.status === 'open' ? 'Open' : 'Closed'}
                          </span>
                        </div>

                        <div className="flex items-center gap-5 text-gray-400">
                          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            {scrap.updatedAt ? formatDistanceToNow(scrap.updatedAt.toDate(), { addSuffix: true, locale: ja }) : 'たった今'}
                          </span>
                          <CommentCount scrapId={scrap.id} initialCount={scrap.commentCount} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
      {/* Links Dialog */}
      <LinksDialog
        isOpen={isLinksDialogOpen}
        onClose={() => setIsLinksDialogOpen(false)}
        links={userProfile.links || []}
        title={`${userProfile.displayName || 'ユーザー'}のリンク`}
      />
    </div>
  );
}
