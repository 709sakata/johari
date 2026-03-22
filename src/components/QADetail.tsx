import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, HelpCircle, CheckCircle2, MessageSquare, Send, Loader2, ShieldCheck, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';
import { handleFirestoreError } from '../lib/firestore';
import { OperationType } from '../types';

interface QAComment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  createdAt: any;
}

interface QATask {
  id: string;
  type: 'fact-check' | 'meta-cognition' | 'audit';
  question: string;
  steps?: {
    observation: string;
    logicGap: string;
    distortion: string;
    syncTask: string;
  };
  status: 'pending' | 'completed';
  answer?: string;
  createdAt: any;
  updatedAt?: any;
  userId: string;
}

interface QADetailProps {
  taskId: string;
  onBack: () => void;
}

export function QADetail({ taskId, onBack }: QADetailProps) {
  const [task, setTask] = useState<QATask | null>(null);
  const [comments, setComments] = useState<QAComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const docRef = doc(db, 'identity_tasks', taskId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTask({ id: docSnap.id, ...docSnap.data() } as QATask);
        } else {
          toast.error('Q&Aが見つかりませんでした');
          onBack();
        }
      } catch (error) {
        console.error('Error fetching Q&A:', error);
        toast.error('読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;

    const q = query(
      collection(db, 'identity_tasks', taskId, 'qa_comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as QAComment[];
      setComments(fetchedComments);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `identity_tasks/${taskId}/qa_comments`);
    });

    return () => unsubscribe();
  }, [taskId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const path = `identity_tasks/${taskId}/qa_comments`;
    try {
      await addDoc(collection(db, path), {
        content: newComment.trim(),
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        authorPhoto: user.photoURL || '',
        createdAt: serverTimestamp()
      });
      setNewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    console.log("Attempting to delete task from detail:", taskId);
    try {
      await deleteDoc(doc(db, 'identity_tasks', taskId));
      console.log("Task deleted successfully from detail");
      toast.success('Q&Aを削除しました');
      onBack();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error('削除に失敗しました');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-gray-400 font-black uppercase tracking-widest">思考を読み込んでいます...</p>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">一覧に戻る</span>
        </button>

        {user?.uid === task.userId && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors group"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest">削除する</span>
          </button>
        )}
      </div>

      {/* Main Question Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-indigo-500/5 overflow-hidden">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                task.type === 'fact-check' ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
              )}>
                {task.type === 'fact-check' ? <AlertCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                  task.type === 'fact-check' ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                )}>
                  {task.type === 'fact-check' ? 'Fact-Check' : 'Meta Reflection'}
                </span>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                  {task.createdAt ? new Date(task.createdAt.seconds * 1000).toLocaleString() : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active Thread</span>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight font-mono">
              {task.question}
            </h2>
            
            {task.steps && (
              <div className="bg-slate-50 rounded-2xl p-5 border border-gray-100 space-y-4">
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Observation</p>
                  <p className="text-xs text-gray-600 leading-relaxed italic">"{task.steps.observation}"</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Audit Logic</p>
                  <p className="text-sm text-gray-800 font-bold leading-tight">{task.steps.logicGap}</p>
                </div>
              </div>
            )}
          </div>

          {task.answer && (
            <div className="pt-6 border-t border-gray-50">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Initial Answer</p>
                  <div className="prose prose-sm max-w-none text-gray-800 font-medium bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50">
                    {task.answer}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conversation Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">対話の履歴</h3>
          <div className="h-px flex-1 bg-gray-100" />
        </div>

        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {comments.map((comment, index) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center gap-2">
                  <img 
                    src={comment.authorPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.authorName)}`} 
                    alt={comment.authorName}
                    className="w-8 h-8 rounded-full border border-gray-100 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                  {index < comments.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 rounded-full" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-gray-900">{comment.authorName}</span>
                    <span className="text-[8px] text-gray-400 font-bold">
                      {comment.createdAt ? new Date(comment.createdAt.seconds * 1000).toLocaleString() : ''}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm prose prose-sm max-w-none text-gray-700">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {comments.length === 0 && (
            <div className="text-center py-12 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
              <p className="text-xs text-gray-400 font-bold">まだ返信はありません。思考を深めましょう。</p>
            </div>
          )}
        </div>
      </div>

      {/* Reply Input */}
      {user && (
        <div className="fixed bottom-20 left-4 right-4 md:bottom-8 md:left-auto md:right-auto md:w-[768px] z-30">
          <form 
            onSubmit={handleSubmitComment}
            className="bg-white/80 backdrop-blur-xl p-3 rounded-2xl border border-gray-200 shadow-2xl flex items-end gap-3"
          >
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="さらに思考を深める..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-1 min-h-[44px] max-h-32 resize-none"
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:grayscale active:scale-95"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
