import { db, collection, query, orderBy, doc, updateDoc, serverTimestamp, deleteDoc, increment } from '../firebase';
import { useCollection, useDocument } from 'react-firebase-hooks/firestore';
import { Scrap, Comment, OperationType } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import TextareaAutosize from 'react-textarea-autosize';
import { ArrowLeft, Clock, User, Trash2, CheckCircle, Circle, Loader2, MoreVertical, Edit2, Check, X, Reply, MessageSquare, Lock, Unlock, List, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { CommentForm } from './CommentForm';
import { ExpandableBio } from './ExpandableBio';
import { Auth } from './Auth';
import { auth } from '../firebase';
import { handleFirestoreError } from '../lib/firestore';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LinkPreview } from './LinkPreview';
import { toast } from 'sonner';

interface ScrapThreadProps {
  scrap: Scrap;
  onBack: () => void;
  onSelectUser?: (userId: string) => void;
}

function AuthorProfile({ authorId, authorName, authorPhoto, createdAt, onSelectUser }: { authorId: string, authorName: string, authorPhoto: string | null, createdAt: any, onSelectUser?: (userId: string) => void }) {
  const [authorDoc] = useDocument(doc(db, `users/${authorId}`));
  const bio = authorDoc?.data()?.bio;

  return (
    <div className="flex flex-col items-center text-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
      <button 
        onClick={() => onSelectUser?.(authorId)}
        className="group flex flex-col items-center"
      >
        {authorPhoto && authorPhoto !== "" ? (
          <img src={authorPhoto} alt={authorName} className="w-16 h-16 rounded-full border-4 border-white shadow-sm mb-3 group-hover:border-blue-100 transition-all" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-3 group-hover:bg-blue-50 transition-all">
            <User className="w-8 h-8 text-gray-300" />
          </div>
        )}
        <p className="font-black text-gray-900 group-hover:text-blue-600 transition-colors">{authorName}</p>
      </button>
      {bio && (
        <ExpandableBio bio={bio} className="text-xs mt-2 px-2 w-full" />
      )}
      <p className="text-[10px] text-gray-400 mt-3 uppercase tracking-widest font-bold">
        {createdAt ? formatDistanceToNow(createdAt.toDate(), { addSuffix: true, locale: ja }) : 'たった今'}に作成
      </p>
    </div>
  );
}

function BioDisplay({ userId, className }: { userId: string, className?: string }) {
  const [userDoc] = useDocument(doc(db, `users/${userId}`));
  const bio = userDoc?.data()?.bio;
  if (!bio) return null;
  return <ExpandableBio bio={bio} className={className} />;
}

export function ScrapThread({ scrap: initialScrap, onBack, onSelectUser }: ScrapThreadProps) {
  const [scrapValue, scrapLoading, scrapError] = useDocument(doc(db, `scraps/${initialScrap.id}`));
  const [commentsValue, loading, error] = useCollection(
    query(collection(db, `scraps/${initialScrap.id}/comments`), orderBy('createdAt', 'asc'))
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(initialScrap.title);
  const [isDeletingScrap, setIsDeletingScrap] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrap = scrapValue?.exists() ? ({ id: scrapValue.id, ...scrapValue.data() } as Scrap) : initialScrap;
  const allComments = commentsValue?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)) || [];
  
  // Auto-fix comment count if it's missing or incorrect
  useEffect(() => {
    if (scrapValue?.exists() && !loading && commentsValue) {
      const actualCount = commentsValue.size;
      const currentCount = scrapValue.data()?.commentCount;
      if (currentCount === undefined || currentCount !== actualCount) {
        updateDoc(doc(db, 'scraps', scrap.id), {
          commentCount: actualCount
        }).catch(err => console.error('Error auto-fixing comment count:', err));
      }
    }
  }, [scrapValue, commentsValue, loading, scrap.id]);

  const parentComments = allComments.filter(c => !c.parentId);
  const replies = allComments.filter(c => c.parentId);

  useEffect(() => {
    if (!isEditingTitle) {
      setEditedTitle(scrap.title);
    }
  }, [scrap.title, isEditingTitle]);

  useEffect(() => {
    const handleScroll = () => {
      // Show button if we've scrolled down a bit, but not at the very bottom
      const scrolled = window.scrollY;
      const windowHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;
      
      // Show if we've scrolled more than 300px and are more than 400px away from the bottom
      setShowScrollButton(scrolled > 300 && (fullHeight - scrolled - windowHeight > 400));
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleUpdateTitle = async () => {
    if (!editedTitle.trim() || editedTitle === scrap.title) {
      setIsEditingTitle(false);
      setEditedTitle(scrap.title);
      return;
    }

    setIsUpdating(true);
    const path = `scraps/${scrap.id}`;
    try {
      await updateDoc(doc(db, path), {
        title: editedTitle.trim(),
        updatedAt: serverTimestamp(),
      });
      setIsEditingTitle(false);
      toast.success('タイトルを更新しました');
    } catch (error) {
      toast.error('タイトルの更新に失敗しました');
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentContent.trim()) return;

    setIsUpdating(true);
    const path = `scraps/${scrap.id}/comments/${commentId}`;
    try {
      await updateDoc(doc(db, path), {
        content: editingCommentContent.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingCommentId(null);
      toast.success('コメントを更新しました');
    } catch (error) {
      toast.error('コメントの更新に失敗しました');
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setIsUpdating(true);
    const path = `scraps/${scrap.id}/comments/${commentId}`;
    try {
      const commentReplies = allComments.filter(c => c.parentId === commentId);
      for (const reply of commentReplies) {
        await deleteDoc(doc(db, `scraps/${scrap.id}/comments/${reply.id}`));
      }
      await deleteDoc(doc(db, path));

      // Update scrap comment count
      await updateDoc(doc(db, 'scraps', scrap.id), {
        commentCount: increment(-(commentReplies.length + 1)),
        updatedAt: serverTimestamp()
      });
      toast.success('コメントを削除しました');
    } catch (error) {
      toast.error('コメントの削除に失敗しました');
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleStatus = async () => {
    setIsUpdating(true);
    const path = `scraps/${scrap.id}`;
    try {
      await updateDoc(doc(db, path), {
        status: scrap.status === 'open' ? 'closed' : 'open',
        updatedAt: serverTimestamp(),
      });
      toast.success(scrap.status === 'open' ? 'スレッドを閉じました' : 'スレッドを再開しました');
    } catch (error) {
      toast.error('ステータスの更新に失敗しました');
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteScrap = async () => {
    setIsUpdating(true);
    const path = `scraps/${scrap.id}`;
    try {
      await deleteDoc(doc(db, path));
      toast.success('スレッドを削除しました');
      onBack();
    } catch (error) {
      toast.error('スレッドの削除に失敗しました');
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setIsUpdating(false);
    }
  };

  const isAuthor = auth.currentUser?.uid === scrap.authorId;
  const excerpt = (text: string) => {
    const clean = text.replace(/[#*`]/g, '').trim();
    return clean.length > 20 ? clean.substring(0, 20) + '...' : clean;
  };

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <div className="">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">一覧に戻る</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
        {/* Main Content */}
        <div className="space-y-6 min-w-0">
          {/* Mobile Sidebar Content */}
          <div className="lg:hidden space-y-4">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 space-y-4">
                {isAuthor && (
                  <button
                    onClick={toggleStatus}
                    disabled={isUpdating}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all active:scale-95 ${
                      scrap.status === 'open'
                        ? "bg-gray-900 text-white hover:bg-gray-800"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100"
                    }`}
                  >
                    {scrap.status === 'open' ? (
                      <>
                        <Lock className="w-4 h-4" />
                        スレッドを閉じる
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        スレッドを再開する
                      </>
                    )}
                  </button>
                )}
                <AuthorProfile 
                  authorId={scrap.authorId} 
                  authorName={scrap.authorName} 
                  authorPhoto={scrap.authorPhoto} 
                  createdAt={scrap.createdAt} 
                  onSelectUser={onSelectUser}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div className="mb-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-full border ${
                    scrap.status === 'open' 
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                      : "bg-gray-50 text-gray-500 border-gray-100"
                  }`}>
                    {scrap.status === 'open' ? 'オープン' : 'クローズ'}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-400 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {scrap.createdAt ? formatDistanceToNow(scrap.createdAt.toDate(), { addSuffix: true, locale: ja }) : 'たった今'}
                  </span>
                  <span className="text-xs sm:text-sm text-gray-400 flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    {scrap.commentCount ?? 0}
                  </span>
                </div>

                {isAuthor && (
                  <div className="relative">
                    <button 
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    <AnimatePresence>
                      {showMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-10"
                        >
                          <button
                            onClick={toggleStatus}
                            disabled={isUpdating}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            {scrap.status === 'open' ? <Circle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            {scrap.status === 'open' ? 'スレッドを閉じる' : 'スレッドを再開する'}
                          </button>
                          <button
                            onClick={() => setIsDeletingScrap(true)}
                            disabled={isUpdating}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            スレッドを削除
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="flex-1 text-xl sm:text-3xl font-black text-gray-900 leading-tight bg-gray-50 border-b-2 border-blue-600 focus:outline-none px-1 py-0.5"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
                        handleUpdateTitle();
                      }
                      if (e.key === 'Escape') {
                        setIsEditingTitle(false);
                        setEditedTitle(scrap.title);
                      }
                    }}
                  />
                  <button
                    onClick={handleUpdateTitle}
                    disabled={isUpdating}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  >
                    <Check className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingTitle(false);
                      setEditedTitle(scrap.title);
                    }}
                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                <div className="group/title relative inline-block w-full">
                  <h1 
                    className="text-xl sm:text-3xl font-black text-gray-900 leading-tight cursor-pointer hover:text-blue-600 transition-colors pr-8 break-words"
                    onClick={() => isAuthor && setIsEditingTitle(true)}
                  >
                    {scrap.title}
                    {isAuthor && (
                      <span className="inline-flex items-center ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity align-middle">
                        <Edit2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300 hover:text-blue-600" />
                      </span>
                    )}
                  </h1>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-6 border-t border-gray-50">
              <button 
                onClick={() => onSelectUser?.(scrap.authorId)}
                className="flex items-center gap-3 group/author w-full max-w-full min-w-0"
              >
                {scrap.authorPhoto && scrap.authorPhoto !== "" ? (
                  <img src={scrap.authorPhoto} alt={scrap.authorName} className="w-10 h-10 rounded-full border border-gray-100 group-hover:border-blue-100 transition-all" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-all">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{scrap.authorName}</p>
                  <BioDisplay userId={scrap.authorId} className="text-xs text-gray-500 mt-0.5 italic truncate" />
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">作成者</p>
                </div>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">{error.message}</div>
          ) : (
            <div className="space-y-4">
              {parentComments.map((comment, index) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  scrapId={scrap.id}
                  index={index}
                  isAuthor={auth.currentUser?.uid === comment.authorId}
                  allReplies={replies}
                  isUpdating={isUpdating}
                  setIsUpdating={setIsUpdating}
                  editingCommentId={editingCommentId}
                  setEditingCommentId={setEditingCommentId}
                  editingCommentContent={editingCommentContent}
                  setEditingCommentContent={setEditingCommentContent}
                  handleUpdateComment={handleUpdateComment}
                  handleDeleteComment={handleDeleteComment}
                  scrapStatus={scrap.status}
                  setDeletingCommentId={setDeletingCommentId}
                  onSelectUser={onSelectUser}
                />
              ))}
            </div>
          )}

            {scrap.status === 'open' ? (
              auth.currentUser ? (
                <div className="px-0">
                  <CommentForm scrapId={scrap.id} />
                </div>
              ) : (
                <div className="px-0">
                  <div className="bg-blue-50 p-6 sm:p-10 rounded-[32px] border border-blue-100 text-center shadow-sm">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-2">対話に参加しましょう</h3>
                  <p className="text-sm sm:text-base text-gray-500 mb-8 font-medium">コメントを投稿したり、返信したりするにはログインが必要です。</p>
                  <div className="flex justify-center">
                    <Auth />
                  </div>
                </div>
              </div>
            )
            ) : (
              <div className="px-0">
                <div className="bg-gray-50 p-6 sm:p-8 rounded-2xl border border-dashed border-gray-200 text-center">
                <p className="text-sm sm:text-base text-gray-500 font-medium">このスレッドはクローズされています。新しいコメントは追加できません。</p>
              </div>
            </div>
          )}
          <div ref={bottomRef} className="h-px" />
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col gap-6 sticky top-24 max-h-[calc(100vh-120px)] w-[300px]">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0">
            <div className="p-6 space-y-6">
              {/* Status Toggle Button */}
              {isAuthor && (
                <button
                  onClick={toggleStatus}
                  disabled={isUpdating}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all active:scale-95 ${
                    scrap.status === 'open'
                      ? "bg-gray-900 text-white hover:bg-gray-800"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100"
                  }`}
                >
                  {scrap.status === 'open' ? (
                    <>
                      <Lock className="w-4 h-4" />
                      スレッドを閉じる
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      スレッドを再開する
                    </>
                  )}
                </button>
              )}

              {/* Author Info */}
              <AuthorProfile 
                authorId={scrap.authorId} 
                authorName={scrap.authorName} 
                authorPhoto={scrap.authorPhoto} 
                createdAt={scrap.createdAt} 
                onSelectUser={onSelectUser}
              />
            </div>
          </div>

          {/* Table of Contents (Hierarchical) */}
          {parentComments.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 flex-shrink-0">
                <List className="w-4 h-4 text-blue-600" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">目次</p>
              </div>
              <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {parentComments.map((pc) => {
                  // 再帰的にすべての子孫コメントを取得する関数
                  const getDescendants = (pid: string): Comment[] => {
                    const children = replies.filter(r => r.parentId === pid);
                    let result = [...children];
                    children.forEach(child => {
                      result = [...result, ...getDescendants(child.id)];
                    });
                    return result;
                  };
                  
                  // すべての子孫を取得し、作成日時順にソート
                  const pcDescendants = getDescendants(pc.id).sort((a, b) => {
                    const tA = a.createdAt?.toMillis() || 0;
                    const tB = b.createdAt?.toMillis() || 0;
                    return tA - tB;
                  });

                  return (
                    <div key={pc.id} className="space-y-2">
                      <div 
                        className="group cursor-pointer p-2 hover:bg-blue-50 rounded-lg transition-colors border-l-2 border-transparent hover:border-blue-600"
                        onClick={() => {
                          const el = document.getElementById(pc.id);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                      >
                        <p className="text-xs text-gray-600 font-bold group-hover:text-blue-700 truncate">
                          {excerpt(pc.content)}
                        </p>
                      </div>
                      {pcDescendants.length > 0 && (
                        <div className="ml-4 border-l-2 border-gray-100 pl-4 space-y-2">
                          {pcDescendants.map(r => (
                            <div 
                              key={r.id}
                              className="group cursor-pointer p-1.5 hover:bg-blue-50 rounded-lg transition-colors border-l-2 border-transparent hover:border-blue-600"
                              onClick={() => {
                                const el = document.getElementById(r.id);
                                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                            >
                              <p className="text-[11px] text-gray-500 font-medium group-hover:text-blue-700 truncate">
                                {excerpt(r.content)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
      {/* Delete Scrap Confirmation Modal */}
      <AnimatePresence>
        {isDeletingScrap && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full"
            >
              <h3 className="text-xl font-black text-gray-900 mb-4">スレッドを削除</h3>
              <p className="text-gray-500 mb-8 leading-relaxed">このスレッドを削除してもよろしいですか？この操作は取り消せません。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeletingScrap(false)}
                  className="flex-1 px-4 py-2.5 font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={deleteScrap}
                  className="flex-1 px-4 py-2.5 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-lg shadow-red-200"
                >
                  削除する
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Comment Confirmation Modal */}
      <AnimatePresence>
        {deletingCommentId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full"
            >
              <h3 className="text-xl font-black text-gray-900 mb-4">コメントを削除</h3>
              <p className="text-gray-500 mb-8 leading-relaxed">このコメントを削除してもよろしいですか？返信もすべて削除されます。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingCommentId(null)}
                  className="flex-1 px-4 py-2.5 font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    handleDeleteComment(deletingCommentId);
                    setDeletingCommentId(null);
                  }}
                  className="flex-1 px-4 py-2.5 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-lg shadow-red-200"
                >
                  削除する
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={scrollToBottom}
            className="fixed bottom-8 right-8 z-50 p-4 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-all active:scale-95 group flex items-center justify-center"
            title="最新の返信へ移動"
          >
            <ChevronDown className="w-6 h-6 group-hover:translate-y-0.5 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function CommentItem({ 
  comment, 
  scrapId, 
  index, 
  isAuthor, 
  allReplies, 
  isUpdating, 
  setIsUpdating,
  editingCommentId,
  setEditingCommentId,
  editingCommentContent,
  setEditingCommentContent,
  handleUpdateComment,
  handleDeleteComment,
  scrapStatus,
  setDeletingCommentId,
  onSelectUser,
  isReply = false
}: any) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);
  const replies = allReplies.filter((r: any) => r.parentId === comment.id);
  const isEditing = editingCommentId === comment.id;

  // Helper to render content with base64 images
  const getRenderContent = () => {
    let content = comment.content;
    if (comment.images) {
      Object.entries(comment.images).forEach(([id, base64]) => {
        content = content.split(`(${id})`).join(`(${base64})`);
      });
    }
    return content;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`group/comment ${
        isReply 
          ? 'py-2' 
          : 'bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm scroll-mt-24'
      }`}
      id={comment.id}
    >
      <div className={isReply ? '' : ''}>
        <div className="flex items-center justify-between gap-2 mb-6">
          <button 
            onClick={() => onSelectUser?.(comment.authorId)}
            className="flex items-center gap-3 group/author"
          >
            {comment.authorPhoto && comment.authorPhoto !== "" ? (
              <img src={comment.authorPhoto} alt={comment.authorName} className="w-8 h-8 rounded-full border border-gray-100 group-hover:border-blue-100 transition-all" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-all">
                <User className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{comment.authorName}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: ja }) : 'たった今'}
                {comment.updatedAt && <span className="ml-2">(編集済み)</span>}
              </p>
            </div>
          </button>

          {isAuthor && !isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setEditingCommentId(comment.id);
                  setEditingCommentContent(comment.content);
                }}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="編集"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeletingCommentId(comment.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="削除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <TextareaAutosize
              value={editingCommentContent}
              onChange={(e) => setEditingCommentContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleUpdateComment(comment.id);
                }
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none text-sm"
              minRows={4}
              maxRows={20}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingCommentId(null)}
                className="px-4 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleUpdateComment(comment.id)}
                disabled={isUpdating || !editingCommentContent.trim()}
                className="px-4 py-1.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm prose-blue max-w-none text-gray-800 text-[13px] sm:text-sm leading-relaxed prose-headings:font-black prose-h1:text-lg sm:prose-h1:text-xl prose-h2:text-base sm:prose-h2:text-lg prose-h3:text-sm sm:prose-h3:text-base prose-h4:text-[13px] sm:prose-h4:text-sm prose-p:text-inherit prose-li:text-inherit">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm, remarkEmoji, remarkMath]} 
              rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeKatex]}
              components={{
                p: ({ children }) => <div className="mb-4 last:mb-0">{children}</div>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4 border border-gray-100 rounded-lg">
                    <table className="w-max min-w-full divide-y divide-gray-200">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="px-4 py-2 bg-gray-50 font-bold text-gray-700 whitespace-nowrap">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-2 whitespace-nowrap">{children}</td>
                ),
                img: ({ node, ...props }) => {
                  if (!props.src || props.src === "") return null;
                  return (
                    <img 
                      {...props} 
                      className="max-h-64 sm:max-h-96 rounded-xl shadow-sm cursor-zoom-in hover:opacity-95 transition-opacity my-4" 
                      onClick={() => {
                        setEnlargedImageUrl(props.src || null);
                        setIsEnlarged(true);
                      }}
                    />
                  );
                },
                a: ({ node, ...props }) => {
                  const isUrl = props.href && (props.href.startsWith('http://') || props.href.startsWith('https://'));
                  if (isUrl && props.href) {
                    return (
                      <span className="block not-prose my-4">
                        <LinkPreview url={props.href} />
                      </span>
                    );
                  }
                  return (
                    <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" />
                  );
                }
              }}
            >
              {getRenderContent()}
            </ReactMarkdown>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isEditing && scrapStatus === 'open' && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Reply className="w-3.5 h-3.5" />
                返信を追加
              </button>
            )}
            {replies.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <MessageSquare className="w-3.5 h-3.5" />
                {replies.length} 件の返信
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isReplying && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`border-t border-gray-50 bg-gray-50/30 p-6 ${isReply ? 'mt-2' : ''}`}
          >
            <CommentForm 
              scrapId={scrapId} 
              parentId={comment.id} 
              onSuccess={() => setIsReplying(false)}
              autoFocus
            />
          </motion.div>
        )}
        {isEnlarged && enlargedImageUrl && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
            onClick={() => setIsEnlarged(false)}
          >
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={enlargedImageUrl}
              alt="Enlarged"
              className="max-w-full max-h-full rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setIsEnlarged(false)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        )}
      </AnimatePresence>

      {replies.length > 0 && (
        <div className={isReply ? "space-y-2 mt-2" : "ml-4 mt-4 border-l-2 border-gray-100 pl-8 space-y-4"}>
          {replies.map((reply: any, rIndex: number) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              scrapId={scrapId}
              index={rIndex}
              isAuthor={auth.currentUser?.uid === reply.authorId}
              allReplies={allReplies}
              isUpdating={isUpdating}
              setIsUpdating={setIsUpdating}
              editingCommentId={editingCommentId}
              setEditingCommentId={setEditingCommentId}
              editingCommentContent={editingCommentContent}
              setEditingCommentContent={setEditingCommentContent}
              handleUpdateComment={handleUpdateComment}
              handleDeleteComment={handleDeleteComment}
              scrapStatus={scrapStatus}
              setDeletingCommentId={setDeletingCommentId}
              onSelectUser={onSelectUser}
              isReply={true}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
