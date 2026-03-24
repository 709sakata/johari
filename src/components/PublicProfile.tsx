import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { db, collection, query, orderBy, doc, getDoc } from '../firebase';
import { where } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Scrap, User as UserProfile, UserLink } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MessageSquare, Clock, Loader2, User, ExternalLink, Github, Twitter, Globe, Link as LinkIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { CommentCount } from './CommentCount';
import { ExpandableBio } from './ExpandableBio';
import { ScrapStats } from './ScrapStats';
import { LinksDialog } from './LinksDialog';
import { QASection } from './QASection';

interface PublicProfileProps {
  userId: string;
  onSelectScrap: (scrap: Scrap) => void;
  onSelectUser: (userId: string) => void;
}

export function PublicProfile({ userId, onSelectScrap, onSelectUser }: PublicProfileProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

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
  const url = `${window.location.origin}/users/${userProfile.id}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "mainEntity": {
      "@type": "Person",
      "name": userProfile.displayName,
      "description": userProfile.bio,
      "image": userProfile.photoURL
    }
  };

  return (
    <div className="space-y-8">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={userProfile.photoURL || `${window.location.origin}/og-image.png`} />
        <meta property="og:url" content={url} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={userProfile.photoURL || `${window.location.origin}/og-image.png`} />
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      </Helmet>
      {/* Profile Header */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
          {/* Avatar Area */}
          <div className="relative group">
            {userProfile.photoURL && userProfile.photoURL !== "" ? (
              <img 
                src={userProfile.photoURL} 
                alt={userProfile.displayName || ''} 
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl shadow-sm border-2 border-gray-50 object-cover" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gray-50 flex items-center justify-center border-2 border-gray-50">
                <User className="w-12 h-12 text-gray-300" />
              </div>
            )}
          </div>

          {/* Info Area */}
          <div className="flex-1 flex flex-col items-center text-center md:items-start md:text-left gap-6 min-w-0">
            <div className="space-y-3 w-full">
              <h2 className="text-lg sm:text-3xl font-black text-gray-900 tracking-tight">
                {userProfile.displayName || 'Anonymous'}
              </h2>
              {userProfile.bio ? (
                <ExpandableBio bio={userProfile.bio} className="max-w-xl mx-auto md:mx-0 font-medium text-gray-500" />
              ) : (
                <p className="text-xs text-gray-400 italic">自己紹介はありません</p>
              )}
            </div>

            <div className="flex flex-wrap justify-center md:justify-start items-center gap-4">
              {/* Links */}
              {(userProfile.links || []).length > 0 && (
                <button
                  onClick={() => setIsLinksDialogOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-full border border-gray-200 transition-all active:scale-95 group"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">ソースリンク</span>
                  <span className="px-1.5 py-0.5 bg-gray-900 text-white text-[9px] font-black rounded-full min-w-[1.5rem] text-center">
                    {(userProfile.links || []).length}
                  </span>
                </button>
              )}

              {/* Quick Stats */}
              <div className="flex items-center gap-4 py-1 px-4 bg-gray-50/50 rounded-full border border-gray-100/50">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Threads</span>
                  <span className="text-xs font-black text-gray-900">{allScraps.length}</span>
                </div>
                <div className="w-px h-3 bg-gray-200" />
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-black text-gray-900">{allScraps.filter(s => s.status === 'open').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Q&A Section */}
      {/* <QASection userId={userId} /> */}

      {/* Scraps Section */}
      <div className="space-y-6">
        <h3 className="text-xl font-black text-gray-900 flex items-center gap-3 ml-2">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          スレッド一覧
        </h3>
        
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 bg-white p-4 sm:p-6 rounded-3xl border border-gray-100">
              <AnimatePresence mode="popLayout">
                {allScraps.map((scrap, index) => (
                  <motion.div
                    key={scrap.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onSelectScrap(scrap)}
                    className="group relative w-full p-2 bg-slate-50/80 hover:bg-slate-100/80 rounded-[2rem] transition-all cursor-pointer overflow-hidden flex items-center gap-4 sm:gap-5"
                  >
                    {/* Left Side: Emoji Block */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 shadow-sm">
                      <span className="text-2xl sm:text-3xl select-none">
                        {scrap.icon_emoji || '📄'}
                      </span>
                    </div>

                    {/* Right Side: Content */}
                    <div className="flex-1 min-w-0 pr-4 sm:pr-6 py-1">
                      <h3 className={cn(
                        "font-bold text-gray-900 group-hover:text-blue-600 transition-colors break-words mb-1.5 line-clamp-2 leading-tight",
                        scrap.title.length > 40 ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                      )}>
                        {scrap.title}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <div className="flex items-center gap-1.5">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            scrap.status === 'open' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-gray-400"
                          )} />
                          <span className={cn(
                            "text-[10px] sm:text-xs font-bold uppercase tracking-wider",
                            scrap.status === 'open' ? "text-emerald-600" : "text-gray-500"
                          )}>
                            {scrap.status === 'open' ? 'Open' : 'Closed'}
                          </span>
                        </div>

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
