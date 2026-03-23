import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, limit, serverTimestamp, onSnapshot, Timestamp, deleteDoc, doc as firestoreDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, Loader2, RefreshCw, HelpCircle, ShieldCheck, AlertCircle, Edit2, Trash2, Fingerprint, History, Zap, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { updateIdentityState, getLatestIdentityState } from '../services/identityService';
import { qaService } from '../services/qaService';
import { IdentityState, OperationType, IdentityTask } from '../types';
import { handleFirestoreError } from '../lib/firestore';

interface QASectionProps {
  userId?: string;
  onSelectTask?: (taskId: string) => void;
  onSelectScrap?: (scrapId: string) => void;
}

export function QASection({ userId: propUserId, onSelectTask, onSelectScrap }: QASectionProps) {
  const [tasks, setTasks] = useState<IdentityTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [answeringTaskId, setAnsweringTaskId] = useState<string | null>(null);
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [identityState, setIdentityState] = useState<IdentityState | null>(null);
  const [showTwin, setShowTwin] = useState(false);
  const currentUser = auth.currentUser;
  const targetUserId = propUserId || currentUser?.uid;
  const isOwner = currentUser?.uid === targetUserId;

  useEffect(() => {
    if (!targetUserId) return;

    // Fetch Identity State
    const fetchState = async () => {
      const state = await getLatestIdentityState(targetUserId);
      setIdentityState(state);
    };
    fetchState();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const q = query(
      collection(db, 'identity_tasks'),
      where('userId', '==', targetUserId),
      where('createdAt', '>=', Timestamp.fromDate(sevenDaysAgo)),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IdentityTask[];
      setTasks(fetchedTasks);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching identity tasks:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [targetUserId]);

  const handleAnswerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey)) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAnswer(answeringTaskId!);
      } else if (e.key === 'b') {
        e.preventDefault();
        insertMarkdownIntoAnswer('**', '**', e.currentTarget);
      } else if (e.key === 'i') {
        e.preventDefault();
        insertMarkdownIntoAnswer('*', '*', e.currentTarget);
      } else if (e.key === 'k') {
        e.preventDefault();
        insertMarkdownIntoAnswer('[', '](url)', e.currentTarget);
      }
    }
  };

  const insertMarkdownIntoAnswer = (prefix: string, suffix: string, textarea: HTMLTextAreaElement) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = answerInput.substring(start, end);
    const newText = answerInput.substring(0, start) + prefix + selectedText + suffix + answerInput.substring(end);
    
    setAnswerInput(newText);

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

  const generateTasks = async () => {
    if (!currentUser || !isOwner) return;

    // Strict Rate Limit: 7 days cooldown (Bypass for admin)
    const isAdmin = currentUser.email === 'naoki.sakata@hopin.co.jp';
    const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
    const lastRun = localStorage.getItem(`last_mirror_run_${currentUser.uid}`);
    
    if (lastRun && !isAdmin) {
      const timeSinceLastRun = Date.now() - parseInt(lastRun);
      if (timeSinceLastRun < COOLDOWN_MS) {
        const remainingDays = Math.ceil((COOLDOWN_MS - timeSinceLastRun) / (24 * 60 * 60 * 1000));
        toast.error(`再観測は7日間に1回のみ可能です。あと${remainingDays}日お待ちください。`);
        return;
      }
    }

    setIsGenerating(true);

    try {
      // 1. Update Identity State (Incremental Loop)
      const newState = await updateIdentityState(currentUser.uid);
      if (!newState) throw new Error("Failed to update identity state");
      setIdentityState(newState);

      // 2. Clear existing pending tasks
      await qaService.clearPendingTasks(currentUser.uid);

      // 3. Generate new task via AI Service
      await qaService.generateNewTask(currentUser.uid, newState);
      
      // Update last run time
      localStorage.setItem(`last_mirror_run_${currentUser.uid}`, Date.now().toString());

      toast.success('デジタルツインが更新され、新しい問いが生成されました');
    } catch (error) {
      console.error("Error generating tasks:", error);
      toast.error('問いの生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = async (taskId: string) => {
    if (!answerInput.trim() || !currentUser) return;
    
    setSyncingTaskId(taskId);
    const task = tasks.find(t => t.id === taskId);
    
    try {
      // Artificial delay for "Syncing" effect
      await new Promise(resolve => setTimeout(resolve, 1500));

      await qaService.answerTask(
        taskId,
        answerInput,
        task?.scrapId,
        currentUser.uid,
        currentUser.displayName || 'User',
        currentUser.photoURL || undefined
      );

      setAnsweringTaskId(null);
      setSyncingTaskId(null);
      setAnswerInput('');
      toast.success('回答がスレッドに記録されました');
    } catch (error) {
      console.error("Error answering task:", error);
      setSyncingTaskId(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    console.log("Attempting to delete task:", taskId);
    try {
      await deleteDoc(firestoreDoc(db, 'identity_tasks', taskId));
      console.log("Task deleted successfully");
      toast.success('問いを削除しました');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `identity_tasks/${taskId}`);
    }
  };

  const handleExport = () => {
    if (!identityState) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(identityState, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `jowhari_identity_twin_${currentUser?.uid}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success('デジタルツインをエクスポートしました');
  };

  if (isLoading) return null;

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;
  const syncRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowTwin(false)}
            className={cn(
              "flex items-center gap-2.5 transition-all",
              !showTwin ? "opacity-100" : "opacity-40 hover:opacity-100"
            )}
          >
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-black text-gray-900 tracking-tight">Q&A</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Audit Agent</p>
            </div>
          </button>

          <div className="w-px h-8 bg-gray-100 hidden sm:block" />

          <button 
            onClick={() => setShowTwin(true)}
            className={cn(
              "flex items-center gap-2.5 transition-all",
              showTwin ? "opacity-100" : "opacity-40 hover:opacity-100"
            )}
          >
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-black text-gray-900 tracking-tight">Digital Twin</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Living State</p>
            </div>
          </button>
        </div>

        {/* Sync Rate Meter */}
        {!showTwin ? (
          <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="text-right">
              <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none mb-0.5">Sync Rate</p>
              <p className={cn(
                "text-lg font-black tabular-nums leading-none",
                syncRate > 80 ? "text-emerald-600" : syncRate > 40 ? "text-indigo-600" : "text-amber-600"
              )}>
                {syncRate}<span className="text-xs ml-0.5">%</span>
              </p>
            </div>
            <div className="w-8 h-8 relative">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  className="text-gray-100"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray={81.68}
                  strokeDashoffset={81.68 - (81.68 * syncRate) / 100}
                  strokeLinecap="round"
                  className={cn(
                    "transition-all duration-1000 ease-out",
                    syncRate > 80 ? "text-emerald-500" : syncRate > 40 ? "text-indigo-500" : "text-amber-500"
                  )}
                />
              </svg>
            </div>
            {isOwner && (
              <button
                onClick={generateTasks}
                disabled={isGenerating}
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all disabled:opacity-50"
                title="再観測する"
              >
                <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isOwner && identityState && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
              >
                <Zap className="w-3.5 h-3.5" />
                Export Twin
              </button>
            )}
            {isOwner && (
              <button
                onClick={generateTasks}
                disabled={isGenerating}
                className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
                title="状態を更新する"
              >
                <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!showTwin ? (
          <motion.div
            key="audit"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-3"
          >
            {pendingTasks.length === 0 ? (
              isOwner && (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 mx-2">
                  <HelpCircle className="w-6 h-6 text-indigo-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-medium">
                    まだ問いはありません。
                  </p>
                  <button
                    onClick={generateTasks}
                    className="mt-3 px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                  >
                    問いを生成
                  </button>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pendingTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative bg-white p-5 rounded-2xl transition-all border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100"
                  >
                    <div className="flex flex-col md:flex-row items-start gap-5">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-indigo-50 text-indigo-600"
                      )}>
                        <Fingerprint className="w-5 h-5" />
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700"
                            )}>
                              Digital Twin Edit
                            </span>
                            {task.scrapId && onSelectScrap && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectScrap(task.scrapId!);
                                }}
                                className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                              >
                                <MessageSquare className="w-3 h-3" />
                                スレッドを表示
                              </button>
                            )}
                          </div>
                          {isOwner && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(task.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="削除する"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {task.steps && (
                          <div className={cn(
                            "space-y-4 border-l pl-4 py-0.5 border-indigo-100"
                          )}>
                            <div className="space-y-1">
                              <p className={cn(
                                "text-[9px] font-black uppercase tracking-widest text-indigo-400"
                              )}>
                                Observation
                              </p>
                              <p className="text-xs font-mono text-gray-600 whitespace-pre-wrap leading-relaxed">{task.steps.observation}</p>
                            </div>
                            <div className="space-y-1">
                              <p className={cn(
                                "text-[9px] font-black uppercase tracking-widest text-indigo-400"
                              )}>
                                Missing Link (Gap)
                              </p>
                              <p className="text-sm font-bold text-gray-800 leading-tight">{task.steps.gap}</p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">Question</p>
                          <p className="text-base font-bold text-gray-900 leading-tight whitespace-pre-wrap font-mono">
                            {task.question}
                          </p>
                        </div>
                        
                        {answeringTaskId === task.id ? (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-4 pt-4 border-t border-gray-50"
                          >
                            {syncingTaskId === task.id ? (
                              <div className="py-8 flex flex-col items-center justify-center gap-4">
                                <div className="relative w-16 h-16">
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full"
                                  />
                                  <motion.div
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-2 border-2 border-indigo-200 border-b-transparent rounded-full"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <RefreshCw className="w-5 h-5 text-indigo-600 animate-pulse" />
                                  </div>
                                </div>
                                <div className="text-center">
                                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 animate-pulse">Syncing Answer...</p>
                                  <p className="text-[8px] text-gray-400 font-bold mt-1">答えを鏡の中に刻んでいます</p>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="relative">
                                  <textarea
                                    value={answerInput}
                                    onChange={(e) => setAnswerInput(e.target.value)}
                                    onKeyDown={handleAnswerKeyDown}
                                    placeholder="あなたの『事実』を言葉にしてください..."
                                    className="w-full p-5 bg-slate-50/50 border border-indigo-100 rounded-2xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all min-h-[120px] resize-none font-mono leading-relaxed"
                                    maxLength={50000}
                                  />
                                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-100 shadow-sm">
                                    <span className={cn(
                                      "text-[9px] font-black tabular-nums",
                                      answerInput.length > 0 ? "text-indigo-600" : "text-gray-300"
                                    )}>
                                      {answerInput.length}
                                    </span>
                                    <div className="w-px h-2 bg-gray-200" />
                                    <Edit2 className="w-2.5 h-2.5 text-gray-400" />
                                  </div>
                                </div>
                                <div className="flex justify-end items-center gap-4">
                                  <button
                                    onClick={() => setAnsweringTaskId(null)}
                                    className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleAnswer(task.id)}
                                    disabled={!answerInput.trim()}
                                    className="px-6 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.15em] rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50 disabled:grayscale"
                                  >
                                    同期を開始する
                                  </button>
                                </div>
                              </>
                            )}
                          </motion.div>
                        ) : (
                          isOwner && (
                            <button
                              onClick={() => setAnsweringTaskId(task.id)}
                              className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 text-[10px] font-black uppercase tracking-widest group/btn pt-1"
                            >
                              答えを出す
                              <Sparkles className="w-3 h-3 group-hover:scale-125 transition-transform" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="twin"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {!identityState ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                <Fingerprint className="w-10 h-10 text-gray-200 mx-auto mb-4" />
                <p className="text-sm text-gray-400 font-bold">デジタルツインはまだ生成されていません</p>
                <button
                  onClick={generateTasks}
                  className="mt-6 px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  生成を開始
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Core Logic */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Core Logic</h3>
                  </div>
                  <p className="text-sm font-medium text-gray-700 leading-relaxed font-mono">
                    {identityState.coreLogic}
                  </p>
                </div>

                {/* Unresolved Conflict */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Unresolved Conflict</h3>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-black text-gray-900 leading-tight">
                      {identityState.unresolvedConflict.title}
                    </p>
                    <p className="text-xs font-medium text-gray-600 leading-relaxed font-mono bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {identityState.unresolvedConflict.deepAnalysis}
                    </p>
                    <div className="flex items-start gap-2 pt-1">
                      <div className="w-1 h-4 bg-indigo-500 rounded-full mt-0.5" />
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                        Grounding Fact: {identityState.unresolvedConflict.groundingFact}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Public Narrative */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Public Narrative</h3>
                  </div>
                  <p className="text-sm font-medium text-gray-700 leading-relaxed font-mono">
                    {identityState.publicNarrative}
                  </p>
                </div>

                {/* Shadow Narrative */}
                <div className="bg-slate-900 p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
                  <div className="flex items-center gap-2 relative z-10">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                      <Fingerprint className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-white">Shadow Narrative</h3>
                  </div>
                  <p className="text-sm font-medium text-indigo-100/90 leading-relaxed font-mono relative z-10">
                    {identityState.shadowNarrative}
                  </p>
                </div>

                {/* Evolution Log */}
                <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <History className="w-4 h-4 text-emerald-600" />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Evolution Log</h3>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold">Latest Update: {identityState.updatedAt ? new Date((identityState.updatedAt as any).seconds * 1000).toLocaleString() : ''}</p>
                  </div>
                  
                  <div className="space-y-4">
                    {identityState.evolutionLog.slice().reverse().map((log, i) => (
                      <div key={i} className="flex gap-4 group">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                          {i !== identityState.evolutionLog.length - 1 && (
                            <div className="w-px flex-1 bg-gray-100 my-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-[10px] text-gray-400 font-bold mb-1">
                            {log.timestamp ? new Date((log.timestamp as any).seconds * 1000).toLocaleString() : ''}
                          </p>
                          <p className="text-xs text-gray-600 font-medium leading-relaxed group-hover:text-gray-900 transition-colors">
                            {log.changeDescription}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {tasks.some(t => t.status === 'completed') && (
        <div className="px-2 pt-10 border-t border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">回答済みの問い</p>
            <div className="h-px flex-1 bg-gradient-to-r from-gray-100 to-transparent ml-4" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tasks.filter(t => t.status === 'completed').slice(0, 10).map(task => (
              <motion.div 
                key={task.id} 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => onSelectTask?.(task.id)}
                className="group relative flex flex-col gap-3 p-4 bg-white rounded-2xl border border-gray-50 shadow-sm hover:shadow-md hover:border-indigo-100/50 transition-all overflow-hidden cursor-pointer"
              >
                {/* Glass reflection effect */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-indigo-50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-emerald-50 rounded-md flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    </div>
                    <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                      {task.type === 'digital-twin-edit' ? 'Digital Twin Edit' : 'Reflection'}
                    </span>
                  </div>
                  {isOwner && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(task.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all z-10"
                      title="削除する"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-900 font-bold leading-tight line-clamp-2">
                    {task.question}
                  </p>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-500 italic line-clamp-2 leading-relaxed">
                      "{task.answer}"
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[8px] text-gray-300 font-bold">
                    {task.updatedAt ? new Date(task.updatedAt.seconds * 1000).toLocaleDateString() : ''}
                  </span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-indigo-200" />
                    <div className="w-1 h-1 rounded-full bg-indigo-100" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
