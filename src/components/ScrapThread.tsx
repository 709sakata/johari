'use client';

import { db, collection, query, orderBy, doc, updateDoc, serverTimestamp, deleteDoc, increment, getDoc, collectionGroup, where, limit } from '../firebase';
import { useCollection, useDocument } from 'react-firebase-hooks/firestore';
import { Scrap, Comment, OperationType } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import TextareaAutosize from 'react-textarea-autosize';
import Image from 'next/image';
import { ArrowLeft, Clock, User, Trash2, CheckCircle, Circle, Loader2, MoreVertical, Edit2, Check, X, Reply, MessageSquare, Lock, Unlock, List, ChevronDown, RefreshCw, Copy, Hash } from 'lucide-react';
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
import { cn } from '../lib/utils';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LinkPreview } from './LinkPreview';
import { ScrapMention } from './ScrapMention';
import { toast } from 'sonner';
import { DIVERSE_EMOJIS } from '../constants/emojis';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { parseScrapboxLinks } from '../lib/scrapbox';
import { ScrapLink } from './ScrapLink';

function BacklinkCard({ scrapId, commentContent, onSelectScrap }: { scrapId: string, commentContent: string, onSelectScrap?: (scrap: Scrap) => void }) {
  const [scrapValue] = useDocument(doc(db, 'scraps', scrapId));
  
  if (!scrapValue?.exists()) return null;
  const scrap = { id: scrapValue.id, ...scrapValue.data() } as Scrap;

  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelectScrap?.(scrap)}
      className="flex flex-col gap-4 p-6 bg-white/60 backdrop-blur-xl rounded-[2rem] border border-white/40 shadow-xl shadow-blue-500/5 hover:shadow-2xl hover:shadow-blue-500/10 transition-all text-left group relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/20 via-blue-500/40 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
          <span className="text-xl">{scrap.icon_emoji || '📄'}</span>
        </div>
        <span className="font-display font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 text-base">{scrap.title}</span>
      </div>
      <div className="relative">
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed opacity-70 italic pl-4 border-l-2 border-blue-100">
          &quot;{commentContent.replace(/[#*_\-~\[\]\(\)>]/g, "").trim()}&quot;
        </p>
      </div>
    </motion.button>
  );
}

interface ScrapThreadProps {
  scrap: Scrap;
  onBack: () => void;
  onSelectUser?: (userId: string) => void;
  onSelectScrap?: (scrap: Scrap) => void;
  onCreateScrap?: (title: string) => void;
}

const getDisplayDate = (date: any) => {
  if (!date) return null;
  if (typeof date.toDate === 'function') return date.toDate();
  return new Date(date);
};

function AuthorProfile({ authorId, authorName, authorPhoto, createdAt, onSelectUser }: { authorId: string, authorName: string, authorPhoto: string | null, createdAt: any, onSelectUser?: (userId: string) => void }) {
  const [authorDoc] = useDocument(doc(db, `users/${authorId}`));
  const bio = authorDoc?.data()?.bio;

  return (
    <div className="flex flex-col items-center text-center p-8 bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/40 shadow-xl shadow-blue-500/5 transition-all hover:shadow-2xl hover:shadow-blue-500/10 group/profile relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/10 via-blue-500/30 to-blue-500/10 opacity-0 group-hover/profile:opacity-100 transition-opacity" />
      <div 
        onClick={() => onSelectUser?.(authorId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onSelectUser?.(authorId);
          }
        }}
        role="button"
        tabIndex={0}
        className="group flex flex-col items-center cursor-pointer focus:outline-none w-full"
      >
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors" />
          {authorPhoto && authorPhoto !== "" ? (
            <div className="relative w-24 h-24">
              <Image 
                src={authorPhoto} 
                alt={authorName} 
                fill
                className="rounded-full border-4 border-white shadow-2xl group-hover:scale-105 transition-all duration-500 ease-out object-cover" 
                referrerPolicy="no-referrer" 
              />
            </div>
          ) : (
            <div className="relative w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-2xl group-hover:scale-105 transition-all duration-500 ease-out">
              <User className="w-12 h-12 text-gray-300" />
            </div>
          )}
        </div>
        <p className="font-display font-bold text-xl text-gray-900 group-hover:text-blue-600 transition-colors tracking-tight mb-1">{authorDoc?.data()?.displayName || authorName}</p>
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">作成者</p>
      </div>
      {bio && (
        <ExpandableBio bio={bio} className="text-xs mt-6 px-2 w-full text-gray-500 leading-relaxed font-medium" />
      )}
      <div className="w-12 h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent my-6" />
      <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-[0.2em] font-black">
        <Clock className="w-3 h-3" />
        <span>{createdAt ? formatDistanceToNow(getDisplayDate(createdAt)!, { addSuffix: true, locale: ja }) : 'たった今'}に作成</span>
      </div>
    </div>
  );
}

function BioDisplay({ userId, className }: { userId: string, className?: string }) {
  const [userDoc] = useDocument(doc(db, `users/${userId}`));
  const bio = userDoc?.data()?.bio;
  if (!bio) return null;
  return <ExpandableBio bio={bio} className={className} />;
}

export function ScrapThread({ scrap: initialScrap, onBack, onSelectUser, onSelectScrap, onCreateScrap }: ScrapThreadProps) {
  const [scrapValue, scrapLoading, scrapError] = useDocument(doc(db, `scraps/${initialScrap.id}`));
  const [commentsValue, loading, error] = useCollection(
    query(collection(db, `scraps/${initialScrap.id}/comments`), orderBy('createdAt', 'asc'))
  );
  
  // Fetch backlinks (comments that mention this scrap's title)
  const [backlinksValue] = useCollection(
    query(
      collectionGroup(db, 'comments'),
      where('linkedTitles', 'array-contains', initialScrap.title),
      limit(20)
    )
  );
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(initialScrap.title);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editedTags, setEditedTags] = useState(initialScrap.tags?.join(' ') || '');
  const [isPickingEmoji, setIsPickingEmoji] = useState(false);
  const [isDeletingScrap, setIsDeletingScrap] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const tocContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const scrap = scrapValue?.exists() ? ({ id: scrapValue.id, ...scrapValue.data() } as Scrap) : initialScrap;
  const allComments = useMemo(() => commentsValue?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)) || [], [commentsValue]);
  
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // SEO description from comments
  const seoDescription = allComments.slice(0, 5).map(c => c.content.replace(/[#*_\-~\[\]\(\)>]/g, "").replace(/\s+/g, " ").trim()).join(" ").substring(0, 160);
  const description = seoDescription || `新しいスレッド「${scrap.title}」が作成されました。`;
  const ogImage = origin ? `${origin}/api/og-image/${scrap.id}` : '';
  const url = origin ? `${origin}/scraps/${scrap.id}` : '';

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "headline": scrap.title,
    "author": {
      "@type": "Person",
      "name": scrap.authorName
    },
    "datePublished": scrap.createdAt?.toDate?.()?.toISOString?.() || scrap.createdAt,
    "dateModified": scrap.updatedAt?.toDate?.()?.toISOString?.() || scrap.updatedAt,
    "image": ogImage,
    "description": description
  };

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

  // Handle click outside for menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const parentComments = allComments.filter(c => !c.parentId);
  const replies = allComments.filter(c => c.parentId);

  useEffect(() => {
    if (!isEditingTitle) {
      setEditedTitle(scrap.title);
    }
  }, [scrap.title, isEditingTitle]);

  useEffect(() => {
    if (!isEditingTags) {
      setEditedTags(scrap.tags?.join(' ') || '');
    }
  }, [scrap.tags, isEditingTags]);

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

  // Scroll Spy Implementation
  useEffect(() => {
    if (loading || allComments.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-100px 0px -70% 0%',
        threshold: 0,
      }
    );

    allComments.forEach((comment) => {
      const el = document.getElementById(comment.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [loading, allComments]);

  // Auto-scroll sidebar ToC item into view
  useEffect(() => {
    if (activeId) {
      const tocItem = document.getElementById(`toc-${activeId}`);
      if (tocItem) {
        tocItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeId]);

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

  const handleUpdateTags = async () => {
    const tags = editedTags
      .split(/[,\s]+/)
      .map(tag => tag.trim().replace(/^#/, ''))
      .filter(tag => tag.length > 0);

    setIsUpdating(true);
    const path = `scraps/${scrap.id}`;
    try {
      await updateDoc(doc(db, path), {
        tags: tags,
        updatedAt: serverTimestamp(),
      });
      setIsEditingTags(false);
      toast.success('タグを更新しました');
    } catch (error) {
      toast.error('タグの更新に失敗しました');
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
    setShowMenu(false);
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

  const isAdminUser = auth.currentUser?.email === 'naoki.sakata@hopin.co.jp';
  const isAuthor = auth.currentUser?.uid === scrap.authorId || isAdminUser;

  const openEmojiPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthor) return;
    setIsPickingEmoji(true);
  };

  const handleSelectEmoji = async (emojiData: EmojiClickData) => {
    setIsPickingEmoji(false);
    const path = 'scraps';
    try {
      await updateDoc(doc(db, path, scrap.id), {
        icon_emoji: emojiData.emoji,
        updatedAt: serverTimestamp()
      });
      toast.success('絵文字を変更しました');
    } catch (error) {
      toast.error('絵文字の変更に失敗しました');
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const copyThreadAsMarkdown = () => {
    setShowMenu(false);
    const scrapDate = scrap.createdAt ? scrap.createdAt.toDate().toLocaleString('ja-JP') : '不明';
    let markdown = `# ${scrap.icon_emoji || ''} ${scrap.title}\n`;
    markdown += `Author: ${scrap.authorName}\n`;
    markdown += `Date: ${scrapDate}\n\n`;
    markdown += `---\n\n`;

    // Sort comments by date
    const sortedComments = [...allComments].sort((a, b) => {
      const tA = a.createdAt?.toMillis() || 0;
      const tB = b.createdAt?.toMillis() || 0;
      return tA - tB;
    });

    sortedComments.forEach((comment) => {
      const commentDate = comment.createdAt ? comment.createdAt.toDate().toLocaleString('ja-JP') : '不明';
      markdown += `## ${comment.authorName} (${commentDate})\n`;
      markdown += `${comment.content}\n\n`;
      markdown += `---\n\n`;
    });

    navigator.clipboard.writeText(markdown.trim()).then(() => {
      toast.success('スレッド全体をMarkdownとしてコピーしました');
    }).catch(() => {
      toast.error('コピーに失敗しました');
    });
  };

  const excerpt = (text: string) => {
    const clean = text.replace(/[#*`]/g, '').trim();
    if (clean.length <= 20) return clean;
    return (
      <>
        {clean.substring(0, 20)}
        <span className="text-[0.7em] opacity-40 ml-0.5 align-baseline">...</span>
      </>
    );
  };

  return (
    <article className="max-w-6xl mx-auto pb-20">
      <nav className="mb-6" aria-label="パンくずリスト">
        <ol className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">
          <li>
            <button onClick={onBack} className="hover:text-blue-600 transition-colors">ホーム</button>
          </li>
          <li className="flex items-center gap-2">
            <span className="opacity-30">/</span>
            <span className="text-gray-900 truncate max-w-[150px] sm:max-w-[300px]">{scrap.title}</span>
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-stretch">
        {/* Main Content */}
        <div className="space-y-6 min-w-0">
          {/* Mobile Sidebar Content */}
          <aside className="lg:hidden space-y-4">
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
                    aria-label={scrap.status === 'open' ? 'スレッドを閉じる' : 'スレッドを再開する'}
                  >
                    {scrap.status === 'open' ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span className="hidden sm:inline">スレッドを閉じる</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span className="hidden sm:inline">スレッドを再開する</span>
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
          </aside>

          <article className="glass p-6 sm:p-12 rounded-[2rem] sm:rounded-[2.5rem] border border-white/40 shadow-2xl shadow-blue-500/10">
            <header className="mb-8 sm:mb-10">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <span className={`px-3 sm:px-4 py-1 sm:py-1.5 text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] rounded-full border ${
                    scrap.status === 'open' 
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-100" 
                      : "bg-gray-50 text-gray-500 border-gray-100"
                  }`}>
                    {scrap.status === 'open' ? 'オープン' : 'クローズ'}
                  </span>
                  <time className="text-[10px] sm:text-xs text-gray-400 font-black uppercase tracking-widest flex items-center gap-1.5" dateTime={typeof scrap.createdAt === 'string' ? scrap.createdAt : scrap.createdAt?.toDate?.()?.toISOString?.()}>
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {scrap.createdAt ? formatDistanceToNow(getDisplayDate(scrap.createdAt)!, { addSuffix: true, locale: ja }) : 'たった今'}
                  </time>
                  <span className="text-[10px] sm:text-xs text-gray-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {scrap.commentCount ?? 0}
                  </span>
                </div>

                {isAuthor && (
                  <div className="relative" ref={menuRef}>
                    <button 
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-2 sm:p-3 text-gray-400 hover:text-gray-900 hover:bg-white rounded-full transition-all shadow-sm border border-transparent hover:border-gray-100"
                    >
                      <MoreVertical className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <AnimatePresence>
                      {showMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute right-0 mt-3 w-56 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/40 py-3 z-10"
                        >
                          <button
                            onClick={toggleStatus}
                            disabled={isUpdating}
                            className="w-full flex items-center gap-4 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all"
                          >
                            {scrap.status === 'open' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            {scrap.status === 'open' ? 'スレッドを閉じる' : 'スレッドを再開する'}
                          </button>
                          <button
                            onClick={copyThreadAsMarkdown}
                            className="w-full flex items-center gap-4 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all"
                          >
                            <Copy className="w-4 h-4" />
                            Markdownでコピー
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMenu(false);
                              setIsPickingEmoji(true);
                            }}
                            className="w-full flex items-center gap-4 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all"
                          >
                            <RefreshCw className="w-4 h-4" />
                            絵文字を変更
                          </button>
                          <div className="my-2 border-t border-gray-50" />
                          <button
                            onClick={() => {
                              setIsDeletingScrap(true);
                              setShowMenu(false);
                            }}
                            disabled={isUpdating}
                            className="w-full flex items-center gap-4 px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-all"
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
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
                  <TextareaAutosize
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="flex-1 w-full text-xl sm:text-4xl font-display font-bold text-gray-900 leading-tight bg-white/50 border-b-4 border-blue-600 focus:outline-none px-2 py-1 rounded-t-xl resize-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleUpdateTitle();
                      }
                      if (e.key === 'Escape') {
                        setIsEditingTitle(false);
                        setEditedTitle(scrap.title);
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={handleUpdateTitle}
                      disabled={isUpdating || !editedTitle.trim()}
                      className="p-2 sm:p-3 text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50"
                      title="保存 (⌘+Enter)"
                    >
                      <Check className="w-5 h-5 sm:w-7 sm:h-7" />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingTitle(false);
                        setEditedTitle(scrap.title);
                      }}
                      className="p-2 sm:p-3 text-gray-400 hover:bg-gray-100 rounded-2xl transition-all active:scale-95"
                      title="キャンセル (Esc)"
                    >
                      <X className="w-5 h-5 sm:w-7 sm:h-7" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group/title relative inline-block w-full">
                  <h1 
                    className={cn(
                      "font-display font-bold text-gray-900 leading-tight cursor-pointer hover:text-blue-600 transition-colors pr-10 break-words tracking-tight",
                      scrap.title.length > 50 ? "text-xl sm:text-3xl" : 
                      scrap.title.length > 25 ? "text-2xl sm:text-4xl" : 
                      "text-3xl sm:text-5xl"
                    )}
                    onClick={() => isAuthor && setIsEditingTitle(true)}
                  >
                    {scrap.icon_emoji && (
                      <span className="relative inline-block mr-2 sm:mr-4 align-top">
                        <span 
                          className="inline-block transition-all hover:rotate-12 hover:scale-125 cursor-pointer p-2 bg-white/50 rounded-2xl active:scale-95" 
                          onClick={openEmojiPicker}
                          title="絵文字を変更"
                        >
                          {scrap.icon_emoji}
                        </span>
                        
                        <AnimatePresence>
                          {isPickingEmoji && (
                            <>
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPickingEmoji(false);
                                }}
                                className="fixed inset-0 z-40"
                              />
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                className="absolute top-full left-0 mt-4 z-50 bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden font-sans"
                                style={{
                                  // @ts-ignore
                                  '--epr-search-input-font-size': '14px',
                                  '--epr-category-label-font-size': '14px',
                                  '--epr-emoji-size': '24px',
                                  '--epr-header-padding': '16px 16px',
                                  '--epr-bg-color': '#ffffff',
                                  '--epr-category-navigation-button-size': '24px',
                                  '--epr-search-input-bg-color': '#f1f3f4',
                                  '--epr-search-input-border-radius': '24px',
                                  '--epr-search-input-padding': '8px 16px',
                                  '--epr-category-label-bg-color': '#ffffff',
                                  '--epr-category-label-text-color': '#202124',
                                  '--epr-highlight-color': '#1a73e8',
                                  '--epr-hover-bg-color': '#f1f3f4',
                                  '--epr-focus-bg-color': '#ffffff',
                                  '--epr-picker-border-radius': '16px',
                                } as React.CSSProperties}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <EmojiPicker
                                  onEmojiClick={handleSelectEmoji}
                                  autoFocusSearch={false}
                                  theme={Theme.LIGHT}
                                  width={320}
                                  height={400}
                                  lazyLoadEmojis={true}
                                  searchPlaceHolder="Search"
                                  previewConfig={{ showPreview: false }}
                                  skinTonesDisabled={true}
                                  searchDisabled={false}
                                  // @ts-ignore
                                  categoriesLocation="top"
                                />
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </span>
                    )}
                    {scrap.title}
                  </h1>
                </div>
              )}

              {/* Tags Section */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {isEditingTags ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full max-w-2xl">
                    <div className="flex-1 flex items-center gap-3 w-full bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-blue-100 shadow-inner group focus-within:ring-4 focus-within:ring-blue-500/5 transition-all">
                      <Hash className="w-5 h-5 text-blue-400 ml-1" />
                      <input
                        type="text"
                        value={editedTags}
                        onChange={(e) => setEditedTags(e.target.value)}
                        placeholder="タグをスペース区切りで入力 (例: 思考 アイデア)"
                        className="flex-1 text-sm bg-transparent focus:outline-none py-1 font-bold text-gray-700 placeholder:text-gray-300"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateTags();
                          if (e.key === 'Escape') setIsEditingTags(false);
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={handleUpdateTags}
                        disabled={isUpdating}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
                      >
                        <Check className="w-4 h-4" />
                        <span>保存</span>
                      </button>
                      <button
                        onClick={() => setIsEditingTags(false)}
                        className="p-2.5 text-gray-400 hover:bg-gray-100 rounded-xl transition-all active:scale-95"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {scrap.tags && scrap.tags.length > 0 ? (
                      scrap.tags.map(tag => (
                        <span 
                          key={tag}
                          className="px-3 py-1 bg-white/80 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-gray-100 shadow-sm"
                        >
                          #{tag}
                        </span>
                      ))
                    ) : (
                      isAuthor && (
                        <span className="text-[10px] text-gray-300 font-black uppercase tracking-widest italic">タグなし</span>
                      )
                    )}
                    {isAuthor && (
                      <button
                        onClick={() => setIsEditingTags(true)}
                        className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                        title="タグを編集"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </header>

            <div className="flex items-center gap-4 pt-8 border-t border-gray-50">
              <div 
                onClick={() => onSelectUser?.(scrap.authorId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectUser?.(scrap.authorId);
                  }
                }}
                role="button"
                tabIndex={0}
                className="flex items-center gap-4 group/author w-full max-w-full min-w-0 cursor-pointer focus:outline-none"
              >
                {scrap.authorPhoto && scrap.authorPhoto !== "" ? (
                  <div className="relative w-12 h-12">
                    <Image 
                      src={scrap.authorPhoto} 
                      alt={scrap.authorName} 
                      fill
                      className="rounded-full border-2 border-white shadow-md group-hover:scale-110 transition-all object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-all shadow-md border-2 border-white">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-base font-display font-bold text-gray-900 group-hover:text-blue-600 transition-colors tracking-tight">{scrap.authorName}</p>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mt-0.5">作成者</p>
                </div>
              </div>
            </div>
          </article>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">{error.message}</div>
          ) : (
            <section className="space-y-4" aria-label="コメント一覧">
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
                  onSelectScrap={onSelectScrap}
                  onCreateScrap={onCreateScrap}
                />
              ))}
            </section>
          )}

            {scrap.status === 'open' ? (
              auth.currentUser ? (
                <div className="px-0">
                  <CommentForm scrapId={scrap.id} onCreateScrap={onCreateScrap} />
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

          {/* Backlinks Section */}
          {backlinksValue && backlinksValue.docs.length > 0 && (
            <div className="mt-20 pt-20 border-t border-gray-100">
              <div className="flex items-center gap-3 mb-10">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <Hash className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-display text-xl font-bold text-gray-900 tracking-tight">リンクされているスレッド</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {backlinksValue.docs
                  .filter(doc => {
                    // Don't show links from the current scrap
                    const path = doc.ref.path;
                    return !path.includes(`scraps/${initialScrap.id}/`);
                  })
                  .map(backlinkDoc => {
                    const data = backlinkDoc.data() as Comment;
                    const scrapId = backlinkDoc.ref.parent.parent?.id;
                    if (!scrapId) return null;

                    return (
                      <BacklinkCard 
                        key={backlinkDoc.id} 
                        scrapId={scrapId} 
                        commentContent={data.content}
                        onSelectScrap={onSelectScrap}
                      />
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col gap-6 w-[300px]">
          <div className="glass rounded-[2.5rem] overflow-hidden flex-shrink-0">
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
                      <span className="hidden sm:inline">スレッドを閉じる</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span className="hidden sm:inline">スレッドを再開する</span>
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
            <div className="sticky top-20 glass rounded-[2.5rem] p-6 space-y-4 flex flex-col max-h-[calc(100vh-100px)]">
              <div className="flex items-center justify-between gap-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <List className="w-4 h-4 text-blue-600" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">目次</p>
                </div>
                {scrap.icon_emoji && <span className="text-xl">{scrap.icon_emoji}</span>}
              </div>
              <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1" ref={tocContainerRef}>
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

                  const isActive = activeId === pc.id;

                  return (
                    <div key={pc.id} className="space-y-2">
                      <div 
                        id={`toc-${pc.id}`}
                        className={`group cursor-pointer p-2 rounded-lg transition-all border-l-2 ${
                          isActive 
                            ? "bg-blue-50 border-blue-600 shadow-sm" 
                            : "hover:bg-blue-50 border-transparent hover:border-blue-600"
                        }`}
                        onClick={() => {
                          const el = document.getElementById(pc.id);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                      >
                        <p className={`text-xs transition-colors truncate ${
                          isActive ? "text-blue-700 font-black" : "text-gray-600 font-bold group-hover:text-blue-700"
                        }`}>
                          {excerpt(pc.content)}
                        </p>
                      </div>
                      {pcDescendants.length > 0 && (
                        <div className="ml-4 border-l-2 border-gray-100 pl-4 space-y-2">
                          {pcDescendants.map(r => {
                            const isReplyActive = activeId === r.id;
                            return (
                              <div 
                                key={r.id}
                                id={`toc-${r.id}`}
                                className={`group cursor-pointer p-1.5 rounded-lg transition-all border-l-2 ${
                                  isReplyActive 
                                    ? "bg-blue-50 border-blue-600 shadow-sm" 
                                    : "hover:bg-blue-50 border-transparent hover:border-blue-600"
                                }`}
                                onClick={() => {
                                  const el = document.getElementById(r.id);
                                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                              >
                                <p className={`text-[11px] transition-colors truncate ${
                                  isReplyActive ? "text-blue-700 font-bold" : "text-gray-500 font-medium group-hover:text-blue-700"
                                }`}>
                                  {excerpt(r.content)}
                                </p>
                              </div>
                            );
                          })}
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
            className="fixed bottom-24 sm:bottom-10 right-6 sm:right-10 z-50 p-4 glass rounded-full hover:bg-white text-blue-600 shadow-2xl transition-all active:scale-95 group flex items-center justify-center border border-white/40"
            title="最新の返信へ移動"
          >
            <ChevronDown className="w-6 h-6 group-hover:translate-y-0.5 transition-transform" />
          </motion.button>
        )}
      </AnimatePresence>
    </article>
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
  onSelectScrap,
  onCreateScrap,
  isReply = false
}: any) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);
  const replies = allReplies.filter((r: any) => r.parentId === comment.id);
  const isEditing = editingCommentId === comment.id;

  // Helper to render content with base64 images and scrapbox links
  const getRenderContent = () => {
    let content = comment.content;
    
    // Parse scrapbox links [Title] -> [Title](scrap:Title)
    content = parseScrapboxLinks(content);

    if (comment.images) {
      Object.entries(comment.images).forEach(([id, base64]) => {
        // Ensure we replace both the markdown syntax and any other occurrences
        content = content.split(id).join(base64);
      });
    }
    return content;
  };

  const insertMarkdownIntoEditing = (prefix: string, suffix: string, textarea: HTMLTextAreaElement) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editingCommentContent.substring(start, end);
    const newText = editingCommentContent.substring(0, start) + prefix + selectedText + suffix + editingCommentContent.substring(end);
    
    setEditingCommentContent(newText);

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

  const copyCommentAsMarkdown = () => {
    const commentDate = comment.createdAt ? comment.createdAt.toDate().toLocaleString('ja-JP') : '不明';
    let markdown = `## ${comment.authorName} (${commentDate})\n`;
    markdown += `${comment.content}`;

    navigator.clipboard.writeText(markdown.trim()).then(() => {
      toast.success('コメントをMarkdownとしてコピーしました');
    }).catch(() => {
      toast.error('コピーに失敗しました');
    });
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`group/comment relative ${
        isReply 
          ? 'py-3' 
          : 'bg-white/60 backdrop-blur-md p-8 sm:p-10 rounded-[2.5rem] border border-white/40 shadow-xl shadow-blue-500/5 hover:shadow-2xl hover:shadow-blue-500/10 transition-all scroll-mt-24'
      }`}
      id={comment.id}
    >
      {/* Glass reflection effect */}
      {!isReply && <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-[2.5rem]" />}

      <div className={`relative z-10 ${isReply ? 'pl-4 border-l-2 border-gray-100' : ''}`}>
        <div className="flex items-center justify-between gap-2 mb-8">
          <button 
            onClick={() => onSelectUser?.(comment.authorId)}
            className="flex items-center gap-4 group/author min-w-0"
          >
            <div className="relative flex-shrink-0">
              {comment.authorPhoto && comment.authorPhoto !== "" ? (
                <div className="relative w-10 h-10 sm:w-12 sm:h-12">
                  <Image 
                    src={comment.authorPhoto} 
                    alt={comment.authorName} 
                    fill
                    className="rounded-full border-2 border-white shadow-md group-hover/author:scale-110 transition-all object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white flex items-center justify-center shadow-md border-2 border-white group-hover/author:scale-110 transition-all">
                  <User className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                </div>
              )}
            </div>
            <div className="text-left min-w-0">
              <p className="font-display text-sm sm:text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors tracking-tight leading-none mb-1.5 truncate">{comment.authorName}</p>
              <p className="text-[9px] sm:text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <time dateTime={comment.createdAt ? comment.createdAt.toDate().toISOString() : undefined}>
                  {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: ja }) : 'たった今'}
                </time>
                {comment.updatedAt && <span className="ml-2 opacity-60">(編集済み)</span>}
              </p>
            </div>
          </button>

          {isAuthor && !isEditing && (
            <div className="flex items-center gap-2 opacity-0 group-hover/comment:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setEditingCommentId(comment.id);
                  setEditingCommentContent(comment.content);
                }}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-blue-100"
                title="編集"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeletingCommentId(comment.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-red-100"
                title="削除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <TextareaAutosize
              value={editingCommentContent}
              onChange={(e) => setEditingCommentContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey)) {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateComment(comment.id);
                  } else if (e.key === 'b') {
                    e.preventDefault();
                    insertMarkdownIntoEditing('**', '**', e.currentTarget);
                  } else if (e.key === 'i') {
                    e.preventDefault();
                    insertMarkdownIntoEditing('*', '*', e.currentTarget);
                  } else if (e.key === 'k') {
                    e.preventDefault();
                    insertMarkdownIntoEditing('[', '](url)', e.currentTarget);
                  }
                }
              }}
              className="w-full px-6 py-5 rounded-2xl border border-gray-100 bg-white/50 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all resize-none text-base font-medium"
              minRows={4}
              maxRows={20}
              autoFocus
              maxLength={50000}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditingCommentId(null)}
                className="px-6 py-2.5 text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleUpdateComment(comment.id)}
                disabled={isUpdating || !editingCommentContent.trim()}
                className="px-8 py-2.5 text-sm font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 active:scale-95"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <div className="prose prose-base sm:prose-lg prose-blue max-w-none text-gray-800 text-[16px] sm:text-[18px] leading-relaxed prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-2xl sm:prose-h1:text-3xl prose-h2:text-xl sm:prose-h2:text-2xl prose-h3:text-lg sm:prose-h3:text-xl prose-h4:text-base sm:prose-h4:text-lg prose-p:text-inherit prose-li:text-inherit">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm, remarkEmoji, remarkMath]} 
              rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeKatex]}
              components={{
                p: ({ children }) => <div className="mb-5 last:mb-0">{children}</div>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-6 border border-gray-100 rounded-2xl shadow-sm">
                    <table className="w-max min-w-full divide-y divide-gray-200">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="px-5 py-3 bg-gray-50 font-black uppercase tracking-widest text-[11px] text-gray-500 whitespace-nowrap">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-gray-700">{children}</td>
                ),
                img: ({ node, ...props }) => {
                  if (!props.src || props.src === "") return null;
                  return (
                    <div className="relative w-full h-64 sm:h-96 my-6">
                      <Image 
                        src={props.src as string} 
                        alt={(props.alt as string) || ''}
                        fill
                        className="rounded-2xl shadow-xl cursor-zoom-in hover:opacity-95 transition-all hover:scale-[1.02] object-contain" 
                        onClick={() => {
                          setEnlargedImageUrl((props.src as string) || null);
                          setIsEnlarged(true);
                        }}
                      />
                    </div>
                  );
                },
                a: ({ node, ...props }) => {
                  const isUrl = props.href && (props.href.startsWith('http://') || props.href.startsWith('https://'));
                  const isScrapMention = props.href && props.href.startsWith('/scraps/');
                  const isScrapboxLink = props.href && props.href.startsWith('scrap:');
                  
                  if (isScrapboxLink && props.href) {
                    const title = decodeURIComponent(props.href.split('scrap:')[1]);
                    return (
                      <ScrapLink 
                        title={title} 
                        className="my-0.5" 
                        onClick={(scrap) => onSelectScrap?.(scrap)}
                        onCreate={(title) => onCreateScrap?.(title)}
                      />
                    );
                  }

                  if (isScrapMention && props.href) {
                    const scrapId = props.href.split('/').pop() || '';
                    return (
                      <ScrapMention 
                        scrapId={scrapId} 
                        className="my-2" 
                        onClick={async () => {
                          if (onSelectScrap) {
                            try {
                              const scrapDoc = await getDoc(doc(db, 'scraps', scrapId));
                              if (scrapDoc.exists()) {
                                onSelectScrap({ id: scrapDoc.id, ...scrapDoc.data() } as Scrap);
                              }
                            } catch (error) {
                              console.error('Error selecting mentioned scrap:', error);
                            }
                          }
                        }}
                      />
                    );
                  }

                  if (isUrl && props.href) {
                    return (
                      <span className="block not-prose my-6">
                        <LinkPreview url={props.href} />
                      </span>
                    );
                  }
                  return (
                    <a {...props} className="text-blue-600 hover:underline font-bold" target="_blank" rel="noopener noreferrer" />
                  );
                }
              }}
            >
              {getRenderContent()}
            </ReactMarkdown>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {!isEditing && scrapStatus === 'open' && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-all group/reply"
              >
                <div className="p-2 bg-gray-50 group-hover/reply:bg-blue-50 rounded-lg transition-colors">
                  <Reply className="w-4 h-4" />
                </div>
                <span className="hidden sm:inline">返信を追加</span>
              </button>
            )}
            {!isEditing && (
              <button
                onClick={copyCommentAsMarkdown}
                className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-all group/copy"
                title="Markdownとしてコピー"
              >
                <div className="p-2 bg-gray-50 group-hover/copy:bg-blue-50 rounded-lg transition-colors">
                  <Copy className="w-4 h-4" />
                </div>
              </button>
            )}
            {replies.length > 0 && (
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <MessageSquare className="w-4 h-4" />
                </div>
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
            className={`border-t border-gray-50 bg-gray-50/30 p-3 sm:p-6 ${isReply ? 'mt-2' : ''}`}
          >
            <CommentForm 
              scrapId={scrapId} 
              parentId={comment.id} 
              onSuccess={() => setIsReplying(false)}
              autoFocus
              onCreateScrap={onCreateScrap}
            />
          </motion.div>
        )}
        {isEnlarged && enlargedImageUrl && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out"
            onClick={() => setIsEnlarged(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-full max-h-full aspect-video w-full h-full"
            >
              <Image
                src={enlargedImageUrl}
                alt="Enlarged"
                fill
                className="rounded-lg shadow-2xl object-contain"
              />
            </motion.div>
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
              onSelectScrap={onSelectScrap}
              onCreateScrap={onCreateScrap}
              isReply={true}
            />
          ))}
        </div>
      )}
    </motion.article>
  );
}
