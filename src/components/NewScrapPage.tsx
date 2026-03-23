import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { db, auth, collection, addDoc, serverTimestamp } from '../firebase';
import { OperationType } from '../types';
import { handleFirestoreError } from '../lib/firestore';
import { Plus, Loader2, ArrowLeft, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { DIVERSE_EMOJIS } from '../constants/emojis';

interface NewScrapPageProps {
  onClose: () => void;
  onSuccess: (scrapId: string) => void;
}

import { logActivity, ActivityType } from '../lib/analytics';

export function NewScrapPage({ onClose, onSuccess }: NewScrapPageProps) {
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !auth.currentUser) return;

    setIsSubmitting(true);
    const path = 'scraps';
    
    // Pick a random emoji
    const randomEmoji = DIVERSE_EMOJIS[Math.floor(Math.random() * DIVERSE_EMOJIS.length)];

    // Parse tags
    const tags = tagsInput
      .split(/[,\s]+/)
      .map(tag => tag.trim().replace(/^#/, ''))
      .filter(tag => tag.length > 0);

    try {
      const docRef = await addDoc(collection(db, path), {
        title: title.trim(),
        status: 'open',
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonymous',
        authorPhoto: auth.currentUser.photoURL || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        commentCount: 0,
        icon_emoji: randomEmoji,
        tags: tags,
      });
      setTitle('');
      setTagsInput('');
      logActivity(ActivityType.ACTION, undefined, 'create_scrap', { title: title.trim(), scrapId: docRef.id, tags });
      toast.success('スレッドを作成しました');
      onSuccess(docRef.id);
    } catch (error) {
      toast.error('スレッドの作成に失敗しました');
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Helmet>
        <title>新規スレッド | じょはり</title>
      </Helmet>
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-gray-400 hover:text-gray-900 mb-8 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium text-xs">戻る</span>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 sm:p-10"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shadow-sm">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">新規スレッド</h2>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">新しい思考の窓を開く</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="title" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
              タイトル
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
              placeholder=""
              className="w-full px-5 py-4 text-lg rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all placeholder:text-gray-300"
              autoFocus
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="tags" className="block text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
              タグ
            </label>
            <input
              id="tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="#思考 #アイデア #メモ"
              className="w-full px-5 py-3 text-sm rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all placeholder:text-gray-300"
            />
            <p className="text-[9px] text-gray-400 ml-1">スペースかカンマで区切って入力してください</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all active:scale-95"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-100 active:scale-95 text-sm"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              スレッドを作成
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
