import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, User, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Auth } from './components/Auth';
import { ScrapList } from './components/ScrapList';
import { ScrapThread } from './components/ScrapThread';
import { NewScrapPage } from './components/NewScrapPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MyPage } from './components/MyPage';
import { PublicProfile } from './components/PublicProfile';
import { QASection } from './components/QASection';
import { QADetail } from './components/QADetail';
import { Scrap } from './types';
import { MessageSquare, Loader2, User as UserIcon, Rss, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';
import { Helmet } from 'react-helmet-async';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

import { logActivity, ActivityType } from './lib/analytics';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedScrap, setSelectedScrap] = useState<Scrap | null>(null);
  const [selectedQATaskId, setSelectedQATaskId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scraps' | 'qa' | 'mypage' | 'user' | 'new-scrap' | 'analytics'>('scraps');
  const [isEmbed, setIsEmbed] = useState(false);

  const isAdmin = user?.email === 'naoki.sakata@hopin.co.jp';

  // Track page views
  useEffect(() => {
    if (!isAuthReady) return;
    const path = window.location.pathname + window.location.search;
    logActivity(ActivityType.PAGE_VIEW, path, undefined, {
      tab: activeTab,
      scrapId: selectedScrap?.id,
      qaTaskId: selectedQATaskId,
      userId: selectedUserId
    });
  }, [activeTab, selectedScrap?.id, selectedQATaskId, selectedUserId, isAuthReady]);

  const getPageTitle = () => {
    if (activeTab === 'mypage') {
      return 'マイページ | じょはり';
    }
    if (activeTab === 'scraps' && !selectedScrap) {
      return 'スレッド一覧 | じょはり';
    }
    if (activeTab === 'qa' && !selectedQATaskId) {
      return 'Q&A一覧 | じょはり';
    }
    return 'じょはり | まだ知らない自分に出会う思考の窓';
  };

  const getPageDescription = () => {
    return 'じょはり は、あなたの思考を整理し、他者との対話を通じて「未知の自分」を発見するための場所です。';
  };

  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedScrap?.id, activeTab, selectedUserId]);

  useEffect(() => {
    const handlePopState = async () => {
      const path = window.location.pathname;
      
      // Reset all detail states first
      setSelectedScrap(null);
      setSelectedQATaskId(null);
      setSelectedUserId(null);

      if (path === '/' || path === '') {
        setActiveTab('scraps');
        return;
      }

      if (path.startsWith('/scraps/')) {
        const scrapId = path.split('/scraps/')[1];
        if (scrapId) {
          try {
            const scrapDoc = await getDoc(doc(db, 'scraps', scrapId));
            if (scrapDoc.exists()) {
              setSelectedScrap({ id: scrapDoc.id, ...scrapDoc.data() } as Scrap);
              setActiveTab('scraps');
            }
          } catch (error) {
            console.error('Error fetching scrap on popstate:', error);
          }
        }
      } else if (path.startsWith('/users/')) {
        const userId = path.split('/users/')[1];
        if (userId) {
          setSelectedUserId(userId);
          setActiveTab('user');
        }
      } else if (path.startsWith('/qa/')) {
        const qaId = path.split('/qa/')[1];
        if (qaId) {
          setSelectedQATaskId(qaId);
          setActiveTab('qa');
        }
      } else if (path === '/mypage') {
        setActiveTab('mypage');
      } else if (path === '/new-scrap') {
        setActiveTab('new-scrap');
      } else if (path === '/analytics') {
        setActiveTab('analytics');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthReady(true);

      // Handle query params or path for direct access
      const params = new URLSearchParams(window.location.search);
      let scrapId = params.get('scrapId');
      let userId = params.get('userId');
      const embed = params.get('embed') === 'true';
      setIsEmbed(embed);
      
      // Also check path-based URL (/scraps/:id or /users/:id or /qa/:id)
      const path = window.location.pathname;
      let qaId = params.get('qaId');
      if (!qaId && path.startsWith('/qa/')) {
        qaId = path.split('/qa/')[1];
      }

      if (qaId && !selectedQATaskId) {
        setSelectedQATaskId(qaId);
        setActiveTab('qa');
      }

      if (!scrapId && path.startsWith('/scraps/')) {
        scrapId = path.split('/scraps/')[1];
      }
      if (!userId && path.startsWith('/users/')) {
        userId = path.split('/users/')[1];
      }

      if (scrapId && !selectedScrap) {
        try {
          const scrapDoc = await getDoc(doc(db, 'scraps', scrapId));
          if (scrapDoc.exists()) {
            setSelectedScrap({ id: scrapDoc.id, ...scrapDoc.data() } as Scrap);
            setActiveTab('scraps');
          }
        } catch (error) {
          console.error('Error fetching scrap from URL:', error);
        }
      }

      if (userId && !selectedUserId) {
        setSelectedUserId(userId);
        setActiveTab('user');
      }

      if (path === '/analytics') {
        setActiveTab('analytics');
      } else if (path === '/mypage') {
        setActiveTab('mypage');
      } else if (path === '/new-scrap') {
        setActiveTab('new-scrap');
      }
    });
    return () => unsubscribe();
  }, []);

  if (!isAuthReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-gray-500 font-black tracking-widest uppercase text-[10px]">思考の窓を開いています...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
        <Helmet>
          <title>{getPageTitle()}</title>
          <meta name="description" content={getPageDescription()} />
          <meta property="og:title" content={getPageTitle()} />
          <meta property="og:description" content={getPageDescription()} />
          <meta property="og:url" content={window.location.origin + window.location.pathname} />
          <meta name="twitter:title" content={getPageTitle()} />
          <meta name="twitter:description" content={getPageDescription()} />
        </Helmet>
        {/* Header */}
        {!isEmbed && (
          <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-100">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
              <div 
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => {
                  setSelectedScrap(null);
                  setSelectedQATaskId(null);
                  setSelectedUserId(null);
                  setActiveTab('scraps');
                  window.history.pushState({}, '', '/');
                }}
              >
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-black tracking-tight text-gray-900 group-hover:text-blue-600 transition-colors">
                  じょはり<span className="text-blue-600">.</span>
                </h1>
              </div>

              <div className="flex items-center gap-6">
                <nav className="hidden md:flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
                  <button
                    onClick={() => {
                      setSelectedScrap(null);
                      setSelectedQATaskId(null);
                      setSelectedUserId(null);
                      setActiveTab('scraps');
                      window.history.pushState({}, '', '/');
                    }}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                      activeTab === 'scraps' 
                        ? 'bg-white text-blue-600 shadow-sm border border-gray-100' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    スレッド
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setSelectedScrap(null);
                        setSelectedQATaskId(null);
                        setSelectedUserId(null);
                        setActiveTab('analytics');
                        window.history.pushState({}, '', '/analytics');
                      }}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                        activeTab === 'analytics' 
                          ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      分析
                    </button>
                  )}
{/* 
                  <button
                    onClick={() => {
                      setSelectedScrap(null);
                      setSelectedQATaskId(null);
                      setSelectedUserId(null);
                      setActiveTab('qa');
                      window.history.pushState({}, '', '/');
                    }}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                      activeTab === 'qa' 
                        ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    Q&A
                  </button>
                  */}
                </nav>

                <div className="flex items-center gap-3">
                  <Auth onMyPageClick={() => {
                    setActiveTab('mypage');
                    setSelectedScrap(null);
                    setSelectedQATaskId(null);
                    setSelectedUserId(null);
                    window.history.pushState({}, '', '/mypage');
                  }} />
                  {user && (
                    <button
                      onClick={() => {
                        setActiveTab('new-scrap');
                        setSelectedScrap(null);
                        setSelectedUserId(null);
                        window.history.pushState({}, '', '/new-scrap');
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                    >
                      <span className="hidden sm:inline">投稿する</span>
                      <span className="sm:hidden">投稿</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>
        )}

        {isEmbed && (
          <header className="w-full bg-white border-b border-gray-100">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-black tracking-tight text-gray-900">
                  じょはり<span className="text-blue-600">.</span>
                </h1>
              </div>
            </div>
          </header>
        )}

        <main className={isEmbed ? "max-w-6xl mx-auto px-4 py-4" : "max-w-6xl mx-auto px-4 py-8"}>
          <div className="space-y-8">
            <AnimatePresence mode="wait">
              {activeTab === 'analytics' ? (
                <motion.div
                  key="analytics"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <AnalyticsDashboard />
                </motion.div>
              ) : activeTab === 'scraps' ? (
                selectedScrap ? (
                  <motion.div
                    key="thread"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ScrapThread 
                      scrap={selectedScrap} 
                      onBack={() => {
                        setSelectedScrap(null);
                        window.history.pushState({}, '', '/');
                      }} 
                      onSelectUser={(userId) => {
                        setSelectedUserId(userId);
                        setActiveTab('user');
                        window.history.pushState({}, '', `/users/${userId}`);
                      }}
                      onSelectScrap={(scrap) => {
                        setSelectedScrap(scrap);
                        window.history.pushState({}, '', `/scraps/${scrap.id}`);
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="w-full"
                  >
                    {/* Landing for unauthenticated users */}
                    {!user && (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-b border-gray-100 mb-12 w-full">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20" />
                  <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 relative z-10" />
                </div>
                        <h2 className="text-2xl sm:text-4xl font-black text-gray-900 mb-4 leading-tight max-w-2xl">
                          まだ知らない自分に出会う、<br/>
                          <span className="text-blue-600">思考の窓。</span>
                        </h2>
                        <p className="text-gray-500 text-base mb-8 max-w-lg leading-relaxed">
                          じょはり は、あなたの思考を整理し、他者との対話を通じて「未知の自分」を発見するための場所です。
                        </p>
                        <Auth />
                      </div>
                    )}

                    <ScrapList 
                      onSelectScrap={(scrap) => {
                        setSelectedScrap(scrap);
                        window.history.pushState({}, '', `/scraps/${scrap.id}`);
                      }} 
                      onSelectUser={(userId) => {
                        setSelectedUserId(userId);
                        setActiveTab('user');
                        window.history.pushState({}, '', `/users/${userId}`);
                      }}
                    />
                  </motion.div>
                )
              ) : /* activeTab === 'qa' ? (
                selectedQATaskId ? (
                  <motion.div
                    key="qa-detail"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <QADetail 
                      taskId={selectedQATaskId} 
                      onBack={() => {
                        setSelectedQATaskId(null);
                        window.history.pushState({}, '', '/');
                      }} 
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="qa"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <QASection 
                      onSelectTask={(taskId) => {
                        setSelectedQATaskId(taskId);
                        window.history.pushState({}, '', `/qa/${taskId}`);
                      }} 
                      onSelectScrap={async (scrapId) => {
                        try {
                          const scrapDoc = await getDoc(doc(db, 'scraps', scrapId));
                          if (scrapDoc.exists()) {
                            setSelectedScrap({ id: scrapDoc.id, ...scrapDoc.data() } as Scrap);
                            setActiveTab('scraps');
                            window.history.pushState({}, '', `/scraps/${scrapId}`);
                          }
                        } catch (error) {
                          console.error('Error opening scrap from QA:', error);
                        }
                      }}
                    />
                  </motion.div>
                )
              ) : */ activeTab === 'mypage' ? (
                selectedScrap ? (
                  <motion.div
                    key="thread-mypage"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ScrapThread 
                      scrap={selectedScrap} 
                      onBack={() => {
                        setSelectedScrap(null);
                        window.history.pushState({}, '', '/mypage');
                      }} 
                      onSelectScrap={(scrap) => {
                        setSelectedScrap(scrap);
                        setActiveTab('scraps');
                        window.history.pushState({}, '', `/scraps/${scrap.id}`);
                      }}
                      onSelectUser={(userId) => {
                        setSelectedUserId(userId);
                        setActiveTab('user');
                        window.history.pushState({}, '', `/users/${userId}`);
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="mypage"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <MyPage 
                      onSelectScrap={(scrap) => {
                        setSelectedScrap(scrap);
                        window.history.pushState({}, '', `/scraps/${scrap.id}`);
                      }} 
                      onSelectUser={(userId) => {
                        setSelectedUserId(userId);
                        setSelectedScrap(null);
                        setActiveTab('user');
                        window.history.pushState({}, '', `/users/${userId}`);
                      }}
                    />
                  </motion.div>
                )
              ) : activeTab === 'user' ? (
                <motion.div
                  key="user-profile"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  {selectedUserId && (
                    <PublicProfile 
                      userId={selectedUserId} 
                      onSelectScrap={(scrap) => {
                        setSelectedScrap(scrap);
                        setActiveTab('scraps');
                        window.history.pushState({}, '', `/scraps/${scrap.id}`);
                      }} 
                      onSelectUser={(userId) => {
                        setSelectedUserId(userId);
                        setActiveTab('user');
                        window.history.pushState({}, '', `/users/${userId}`);
                      }}
                    />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="new-scrap"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <NewScrapPage 
                    onClose={() => setActiveTab('scraps')}
                    onSuccess={async (scrapId) => {
                      try {
                        const scrapDoc = await getDoc(doc(db, 'scraps', scrapId));
                        if (scrapDoc.exists()) {
                          setSelectedScrap({ id: scrapDoc.id, ...scrapDoc.data() } as Scrap);
                          setActiveTab('scraps');
                          window.history.pushState({}, '', `/scraps/${scrapId}`);
                        }
                      } catch (error) {
                        console.error('Error fetching new scrap:', error);
                        setActiveTab('scraps');
                      }
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        <footer className="py-12 border-t border-gray-100 bg-white">
          <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 text-gray-400">
              <MessageSquare className="w-5 h-5" />
              <span className="font-black text-sm tracking-widest uppercase">じょはり</span>
            </div>
            <p className="text-gray-400 text-xs">
              まだ知らない自分に出会う思考の窓
            </p>
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-4">
                <a 
                  href="/rss.xml" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase text-gray-400 hover:text-orange-500 transition-colors"
                >
                  <Rss className="w-3 h-3" />
                  RSS Feed
                </a>
              </div>
              <p className="text-[10px] text-gray-300 font-bold tracking-widest uppercase">
                &copy; 2026 Hopin, Inc.
              </p>
            </div>
          </div>
        </footer>

        <Toaster position="top-center" richColors />

        {/* Mobile Bottom Navigation */}
        {!isEmbed && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 px-6 py-3 flex items-center justify-around z-40">
            <button
              onClick={() => {
                setSelectedScrap(null);
                setSelectedQATaskId(null);
                setSelectedUserId(null);
                setActiveTab('scraps');
                window.history.pushState({}, '', '/');
              }}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === 'scraps' ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">スレッド</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  setSelectedScrap(null);
                  setSelectedQATaskId(null);
                  setSelectedUserId(null);
                  setActiveTab('analytics');
                  window.history.pushState({}, '', '/analytics');
                }}
                className={`flex flex-col items-center gap-1 transition-all ${
                  activeTab === 'analytics' ? 'text-indigo-600' : 'text-gray-400'
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">分析</span>
              </button>
            )}
{/*
            <button
              onClick={() => {
                setSelectedScrap(null);
                setSelectedQATaskId(null);
                setSelectedUserId(null);
                setActiveTab('qa');
                window.history.pushState({}, '', '/');
              }}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === 'qa' ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              <div className="relative">
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Q&A</span>
            </button>
            */}
            <button
              onClick={() => {
                setActiveTab('mypage');
                setSelectedScrap(null);
                setSelectedQATaskId(null);
                setSelectedUserId(null);
                window.history.pushState({}, '', '/mypage');
              }}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === 'mypage' ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              <UserIcon className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">マイページ</span>
            </button>
          </nav>
        )}
      </div>
    </ErrorBoundary>
  );
}
