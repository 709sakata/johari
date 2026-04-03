import { useState, useEffect } from 'react';
import { db, collection, collectionGroup, query, orderBy, auth, setDoc, doc, getDoc, getDocs, serverTimestamp, writeBatch, updateProfile } from '../firebase';
import { where } from 'firebase/firestore';
import { useCollection, useDocumentData } from 'react-firebase-hooks/firestore';
import { Scrap, User as UserProfile, UserLink } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MessageSquare, Clock, Loader2, User, Code, Check, Plus, Trash2, ExternalLink, Edit2, Save, X, Globe, Github, Twitter, Link as LinkIcon, LayoutGrid, Circle, CheckCircle2, Download } from 'lucide-react';
import Image from 'next/image';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { CommentCount } from './CommentCount';
import { toast } from 'sonner';
import { ScrapStats } from './ScrapStats';
import { LinksDialog } from './LinksDialog';
import { safeStringify } from '../lib/firestore';

interface MyPageProps {
  onSelectScrap: (scrap: Scrap) => void;
  onSelectUser: (userId: string) => void;
}

export function MyPage({ onSelectScrap, onSelectUser }: MyPageProps) {
  const [statusTab, setStatusTab] = useState<'open' | 'closed'>('open');
  const [copied, setCopied] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const authUser = auth.currentUser;

  // Profile data
  const [profile, profileLoading] = useDocumentData(
    authUser ? doc(db, 'users', authUser.uid) : null
  );

  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLinks, setEditLinks] = useState<string[]>([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [bulkLinks, setBulkLinks] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [newLinkInput, setNewLinkInput] = useState('');
  const [isLinksDialogOpen, setIsLinksDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditName(profile.displayName || authUser?.displayName || '');
      setEditBio(profile.bio || '');
      setEditLinks(profile.links || []);
    } else if (authUser) {
      setEditName(authUser.displayName || '');
    }
  }, [profile, authUser]);

  const handleSaveProfile = async () => {
    if (!authUser) return;
    try {
      // Filter out empty links before saving
      const cleanedLinks = editLinks.filter(l => l.trim() !== '');
      
      // 1. Update user profile in Firestore
      await setDoc(doc(db, 'users', authUser.uid), {
        displayName: editName,
        bio: editBio,
        links: cleanedLinks,
        photoURL: authUser.photoURL,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // 2. Update Firebase Auth profile so that new scraps/comments get the correct name
      await updateProfile(authUser, {
        displayName: editName
      });

      // 3. Update denormalized authorName in scraps
      const scrapsQuery = query(collection(db, 'scraps'), where('authorId', '==', authUser.uid));
      const scrapsSnapshot = await getDocs(scrapsQuery);
      
      // 4. Update denormalized authorName in comments (using collectionGroup)
      const commentsQuery = query(collectionGroup(db, 'comments'), where('authorId', '==', authUser.uid));
      const commentsSnapshot = await getDocs(commentsQuery);
      
      // 5. Update denormalized authorName in qa_comments (using collectionGroup)
      const qaCommentsQuery = query(collectionGroup(db, 'qa_comments'), where('authorId', '==', authUser.uid));
      const qaCommentsSnapshot = await getDocs(qaCommentsQuery);
      
      const allDocsToUpdate = [
        ...scrapsSnapshot.docs,
        ...commentsSnapshot.docs,
        ...qaCommentsSnapshot.docs
      ];

      // Firestore batches have a limit of 500 operations
      for (let i = 0; i < allDocsToUpdate.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = allDocsToUpdate.slice(i, i + 500);
        
        chunk.forEach((docToUpdate) => {
          batch.update(docToUpdate.ref, { 
            authorName: editName,
            authorPhoto: authUser.photoURL || ''
          });
        });
        
        await batch.commit();
      }

      setIsEditingProfile(false);
      toast.success('プロフィールを更新しました');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('プロフィールの更新に失敗しました');
    }
  };

  const addLink = (url?: string) => {
    const linkToAdd = url || newLinkInput;
    if (!linkToAdd.trim()) return;
    setEditLinks([linkToAdd.trim(), ...editLinks]);
    setNewLinkInput('');
  };

  const handleBulkAdd = () => {
    const urls = bulkLinks.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (urls.length === 0) return;
    setEditLinks([...urls, ...editLinks]);
    setBulkLinks('');
    setShowBulkAdd(false);
    toast.success(`${urls.length}件のリンクを追加しました`);
  };

  const removeLink = (index: number) => {
    setEditLinks(editLinks.filter((_, i) => i !== index));
  };

  const updateLink = (index: number, value: string) => {
    const newLinks = [...editLinks];
    newLinks[index] = value;
    setEditLinks(newLinks);
  };

  const embedCode = authUser ? `<iframe src="${origin}/users/${authUser.uid}?embed=true" width="100%" height="600" frameborder="0" style="border-radius: 12px; border: 1px solid #eee;"></iframe>` : '';

  const handleBioKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey)) {
      if (e.key === 'b') {
        e.preventDefault();
        insertMarkdownIntoBio('**', '**', e.currentTarget);
      } else if (e.key === 'i') {
        e.preventDefault();
        insertMarkdownIntoBio('*', '*', e.currentTarget);
      } else if (e.key === 'k') {
        e.preventDefault();
        insertMarkdownIntoBio('[', '](url)', e.currentTarget);
      }
    }
  };

  const insertMarkdownIntoBio = (prefix: string, suffix: string, textarea: HTMLTextAreaElement) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editBio.substring(start, end);
    const newText = editBio.substring(0, start) + prefix + selectedText + suffix + editBio.substring(end);
    
    setEditBio(newText);

    // Set cursor position after update
    setTimeout(() => {
      textarea.focus();
      if (start === end) {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      } else {
        textarea.setSelectionRange(start + prefix.length + selectedText.length + suffix.length, start + prefix.length + selectedText.length + suffix.length);
      }
    }, 0);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast.success('埋め込みコードをコピーしました');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJSON = async () => {
    if (!authUser || isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading('データをエクスポート中...');

    try {
      const exportData = {
        user: {
          uid: authUser.uid,
          displayName: profile?.displayName || authUser.displayName,
          bio: profile?.bio || '',
          links: profile?.links || [],
        },
        scraps: [] as any[],
        exportedAt: new Date().toISOString(),
      };

      // allScraps is already available from useCollection
      for (const scrap of allScraps) {
        const commentsQuery = query(collection(db, 'scraps', scrap.id, 'comments'), orderBy('createdAt', 'asc'));
        const commentsSnapshot = await getDocs(commentsQuery);
        const comments = commentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: (doc.data() as any).createdAt?.toDate().toISOString(),
          updatedAt: (doc.data() as any).updatedAt?.toDate().toISOString(),
        }));

        exportData.scraps.push({
          id: scrap.id,
          title: scrap.title,
          content: scrap.content,
          status: scrap.status,
          authorId: scrap.authorId,
          authorName: scrap.authorName,
          authorPhoto: scrap.authorPhoto,
          icon_emoji: scrap.icon_emoji,
          tags: scrap.tags,
          commentCount: scrap.commentCount,
          createdAt: scrap.createdAt?.toDate().toISOString(),
          updatedAt: scrap.updatedAt?.toDate().toISOString(),
          comments,
        });
      }

      const blob = new Blob([safeStringify(exportData, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `johari-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('エクスポートが完了しました', { id: toastId });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('エクスポートに失敗しました', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const [value, loading, error] = useCollection(
    authUser ? query(
      collection(db, 'scraps'),
      where('authorId', '==', authUser.uid),
      orderBy('updatedAt', 'desc')
    ) : null
  );

  if (!authUser) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">ログインが必要です</p>
      </div>
    );
  }

  const allScraps = value?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scrap)) || [];
  const filteredScraps = allScraps.filter(s => s.status === statusTab);

  const getPlatformIcon = (url: string) => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('github.com')) return <Github className="w-4 h-4" />;
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return <Twitter className="w-4 h-4" />;
    if (lowerUrl.includes('blog') || lowerUrl.includes('note.com')) return <Globe className="w-4 h-4" />;
    return <LinkIcon className="w-4 h-4" />;
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Profile Section */}
      <section className="glass rounded-[2rem] sm:rounded-[2.5rem] border border-white/40 p-5 sm:p-10 shadow-2xl shadow-blue-500/5 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-12 text-center sm:text-left">
          {/* Avatar Area */}
          <div className="relative group/avatar flex-shrink-0">
            {authUser.photoURL ? (
              <div className="relative w-20 h-20 sm:w-40 sm:h-40">
                <Image 
                  src={authUser.photoURL} 
                  alt={authUser.displayName || ''} 
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
            {!isEditingProfile ? (
              <div className="space-y-3 sm:space-y-8 w-full flex flex-col items-center sm:items-start">
                <div className="space-y-1 sm:space-y-4 w-full">
                  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-5">
                    <h2 className="font-display text-xl sm:text-5xl font-bold text-gray-900 tracking-tight truncate max-w-full">
                      {profile?.displayName || authUser.displayName || 'ユーザー'}
                    </h2>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        className="p-1.5 sm:p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 bg-white/40 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/40 transition-all active:scale-95 shadow-sm"
                        title="プロフィールを編集"
                      >
                        <Edit2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                      </button>
                      <button
                        onClick={copyToClipboard}
                        className="p-1.5 sm:p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 bg-white/40 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/40 transition-all active:scale-95 shadow-sm"
                        title="埋め込みコードをコピー"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-500" /> : <Code className="w-3.5 h-3.5 sm:w-5 sm:h-5" />}
                      </button>
                    </div>
                  </div>
                  {profile?.bio ? (
                    <p className="text-gray-600 text-xs sm:text-lg leading-relaxed max-w-2xl font-medium">
                      {profile.bio}
                    </p>
                  ) : (
                    <p className="text-[10px] sm:text-sm text-gray-400 italic font-medium">自己紹介を設定しましょう</p>
                  )}
                </div>

                <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 sm:gap-6">
                  {/* Link Tag */}
                  {(profile?.links || []).length > 0 && (
                    <button
                      onClick={() => setIsLinksDialogOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 sm:px-5 sm:py-2.5 bg-white/60 hover:bg-white text-gray-600 rounded-full border border-white/40 shadow-sm transition-all active:scale-95 group"
                    >
                      <LinkIcon className="w-3 h-3 sm:w-4 h-4 text-blue-500" />
                      <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider">ソースリンク</span>
                      <span className="px-1.5 py-0.5 bg-gray-900 text-white text-[8px] sm:text-[10px] font-black rounded-full min-w-[1.2rem] text-center">
                        {(profile?.links || []).length}
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
            ) : (
              <div className="w-full space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">表示名</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="名前を入力"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">自己紹介</label>
                      <textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        onKeyDown={handleBioKeyDown}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[120px] resize-none"
                        placeholder="自分について教えてください"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                        マイリンク ({(editLinks || []).length})
                      </h3>
                      <button
                        onClick={() => setShowBulkAdd(!showBulkAdd)}
                        className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-lg hover:bg-gray-200 transition-all"
                      >
                        一括追加
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={newLinkInput}
                        onChange={(e) => setNewLinkInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addLink()}
                        placeholder="新しいリンクを追加"
                        className="flex-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <button
                        onClick={() => addLink()}
                        className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {showBulkAdd && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 overflow-hidden"
                      >
                        <textarea
                          value={bulkLinks}
                          onChange={(e) => setBulkLinks(e.target.value)}
                          placeholder="1行に1つのURLを入力してください"
                          className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setShowBulkAdd(false)}
                            className="px-3 py-1.5 text-gray-500 text-[10px] font-bold"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={handleBulkAdd}
                            className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-all"
                          >
                            追加する
                          </button>
                        </div>
                      </motion.div>
                    )}

                    <div className="overflow-y-auto pr-2 -mr-2 space-y-2 max-h-[200px] scrollbar-thin scrollbar-thumb-gray-200">
                      <AnimatePresence mode="popLayout">
                        {editLinks.map((url, i) => (
                          <motion.div
                            key={`${url}-${i}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100 group"
                          >
                            <div className="flex-1 min-w-0">
                              <input
                                type="url"
                                value={url}
                                onChange={(e) => updateLink(i, e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                placeholder="URL"
                              />
                            </div>
                            <button
                              onClick={() => removeLink(i)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={handleSaveProfile}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    変更を保存
                  </button>
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    className="px-6 py-3 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      
      {/* Scraps Section */}
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <h2 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-4 tracking-tight">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            マイ・スレッド
          </h2>
        </div>

        <div className="space-y-0">
          {/* Tabs & Export */}
          <div className="flex items-center justify-between gap-4 mb-0">
            <div className="flex items-center gap-1.5 bg-white/40 backdrop-blur-md p-2 rounded-t-[2.5rem] w-fit border-t border-x border-white/40 shadow-sm">
              <button
                onClick={() => setStatusTab('open')}
                className={cn(
                  "flex items-center gap-2.5 px-6 py-3 text-sm font-black uppercase tracking-widest rounded-2xl transition-all",
                  statusTab === 'open' 
                    ? "bg-white text-emerald-600 shadow-xl shadow-emerald-500/10 ring-1 ring-black/5" 
                    : "text-gray-400 hover:text-gray-600 hover:bg-white/50"
                )}
              >
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  statusTab === 'open' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-gray-300"
                )} />
                Open
              </button>
              <button
                onClick={() => setStatusTab('closed')}
                className={cn(
                  "flex items-center gap-2.5 px-6 py-3 text-sm font-black uppercase tracking-widest rounded-2xl transition-all",
                  statusTab === 'closed' 
                    ? "bg-white text-gray-600 shadow-xl shadow-black/10 ring-1 ring-black/5" 
                    : "text-gray-400 hover:text-gray-600 hover:bg-white/50"
                )}
              >
                <CheckCircle2 className="w-4 h-4" />
                Closed
              </button>
            </div>

            <button
              onClick={handleExportJSON}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
              title="データをJSONでエクスポート"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">JSON出力</span>
            </button>
          </div>
        
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 glass rounded-b-[2.5rem] border-t-0">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-gray-500 font-medium">読み込み中...</p>
            </div>
          ) : error ? (
            <div className="p-8 glass border border-red-100 rounded-b-[2.5rem] border-t-0 text-red-600">
              <p className="font-bold">スレッドの取得に失敗しました</p>
              <p className="text-sm opacity-80">{error.message}</p>
            </div>
          ) : filteredScraps.length === 0 ? (
            <div className="text-center py-24 px-4 glass rounded-b-[2.5rem] border-t-0 border-dashed border-gray-200">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-black/5">
                <MessageSquare className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">
                {statusTab === 'open' ? 'オープンなスレッドはありません' : 'クローズしたスレッドはありません'}
              </h3>
              <p className="text-gray-500 max-w-xs mx-auto text-sm leading-relaxed">
                {statusTab === 'open' ? '新しい思考を記録しましょう。' : '完了した思考がここに表示されます。'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-b-[2.5rem] rounded-tr-[2.5rem] border border-gray-100 shadow-2xl shadow-black/5">
              <AnimatePresence mode="popLayout">
                {filteredScraps.map((scrap, index) => (
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
        links={profile?.links || []}
      />
    </div>
  );
}
