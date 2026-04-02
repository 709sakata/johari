import { useState } from 'react';
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
  initialTitle?: string;
}

import { logActivity, ActivityType } from '../lib/analytics';

export function NewScrapPage({ onClose, onSuccess, initialTitle = '' }: NewScrapPageProps) {
  const [title, setTitle] = useState(initialTitle);
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
        className="glass rounded-[2.5rem] border border-white/40 shadow-2xl shadow-blue-500/10 overflow-hidden p-8 sm:p-12"
      >
        <div className="flex items-center gap-5 mb-10">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 transition-transform hover:scale-110">
            <MessageSquare className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-gray-900 tracking-tight">新規スレッド</h2>
            <p className="text-gray-400 text-[11px] font-black uppercase tracking-[0.2em]">新しい思考の窓を開く</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3">
            <label htmlFor="title" className="block text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2">
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
              placeholder="何について考えますか？"
              className="w-full px-6 py-5 text-xl font-display font-bold rounded-[1.5rem] border border-gray-100 bg-white/50 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all placeholder:text-gray-300 shadow-sm"
              autoFocus
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="tags" className="block text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2">
              タグ
            </label>
            <input
              id="tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="#思考 #アイデア #メモ"
              className="w-full px-6 py-4 text-sm font-medium rounded-2xl border border-gray-100 bg-white/50 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all placeholder:text-gray-300 shadow-sm"
            />
            <p className="text-[10px] text-gray-400 ml-2 font-bold">スペースかカンマで区切って入力してください</p>
          </div>

          <div className="flex items-center justify-end gap-6 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-gray-600 transition-all active:scale-95"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center justify-center gap-3 px-8 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-600/20 active:scale-95 text-sm"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              <span className="font-black uppercase tracking-widest">スレッドを作成</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
