import { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp, onSnapshot, Timestamp, deleteDoc, doc as firestoreDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, CheckCircle2, Loader2, RefreshCw, HelpCircle, ShieldCheck, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface IdentityTask {
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
}

interface QASectionProps {
  userId?: string;
  onSelectTask?: (taskId: string) => void;
}

export function QASection({ userId: propUserId, onSelectTask }: QASectionProps) {
  const [tasks, setTasks] = useState<IdentityTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [answeringTaskId, setAnsweringTaskId] = useState<string | null>(null);
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const currentUser = auth.currentUser;
  const targetUserId = propUserId || currentUser?.uid;
  const isOwner = currentUser?.uid === targetUserId;

  useEffect(() => {
    if (!targetUserId) return;

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
      // 0. Clear existing pending tasks to ensure a "fundamental" refresh
      const { deleteDoc, doc: firestoreDoc } = await import('firebase/firestore');
      const pendingQuery = query(
        collection(db, 'identity_tasks'),
        where('userId', '==', currentUser.uid),
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      const deletePromises = pendingSnapshot.docs.map(d => deleteDoc(firestoreDoc(db, 'identity_tasks', d.id)));
      await Promise.all(deletePromises);

      // 1. Gather context (Profile + Scraps)
      const scrapsQuery = query(
        collection(db, 'scraps'),
        where('authorId', '==', currentUser.uid),
        orderBy('updatedAt', 'desc'),
        limit(5)
      );
      const scrapsSnapshot = await getDocs(scrapsQuery);
      const scrapsText = scrapsSnapshot.docs.length > 0 
        ? scrapsSnapshot.docs.map(doc => doc.data().title).join('\n')
        : "（思考ログはまだ記録されていません）";

      const { getDoc, doc: fireDoc } = await import('firebase/firestore');
      const userDoc = await getDoc(fireDoc(db, 'users', currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      
      const profileText = [
        `Name: ${userData?.displayName || currentUser.displayName || 'Anonymous'}`,
        `Bio: ${userData?.bio || '（自己紹介未設定）'}`,
        `Links: ${userData?.links?.length ? userData.links.join(', ') : '（リンクなし）'}`
      ].join('\n');

      // 2. Call Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          # Role
          あなたは「Q&A 監査官」。
          ユーザーの公開情報（Persona）と内面ログ（Scraps）を冷徹に突き合わせ、その「矛盾の構造」を解体し、ユーザーが直視せざるを得ない「問い（Q&A）」を提示します。

          # 実行命令（直列思考プロセス）
          あなたは以下のSTEPを順番に、脳内で実行してから最終回答を生成してください。

          STEP 1 【データ・スキャン】:
            - 外部プロフィールから「社会向けの顔（建前）」を特定する。
            - スレッドから「無意識の願望/恐怖（本音）」を特定する。
          STEP 2 【乖離の同定】:
            - STEP 1で見つけた「建前」と「本音」が最も激しく衝突しているポイントを1点だけ選ぶ。
          STEP 3 【監査モードの選択】:
            - その衝突が「対外的な誤解」を生んでいるなら [Fact-Check] モード。
            - その衝突が「自己欺瞞（自分への嘘）」であるなら [Meta] モードを選択。
          STEP 4 【言語化の鋭化】:
            - 選択したモードに基づき、あえて「痛い」言葉（隠蔽、腐心等）を選定し、ロジカルに構成する。

          # Analysis Logic
          1. **[Persona vs Shadow]**: プロフィールが主張する「理想像」と、ログに漏れ出ている「執着・不安・矛盾」を特定せよ。
          2. **[Paradox Extraction]**: 「〇〇を追求することで、実は△△から逃避している」といった、ユーザー自身も無自覚な自己欺瞞（セルフ・デセプション）を抽出せよ。
          3. **[Logical Closing]**: 逃げ場のない論理で、その矛盾を言語化せよ。

          # Output Format (日本語のみ)
          以下の2つのスタイルのうち、より「刺さる」方を1つ選択して出力せよ。

          ## Style A: Meta (内面監査)
          【思考のバグ】
          （ユーザーの思考のデッドロックや、無意識の回避パターンを鋭い比喩を用いて指摘せよ）
          
          【問い】
          （ユーザーの価値観の根底を揺さぶる、パラドキシカルな問いを提示せよ）

          ## Style B: Fact-Check (外部監査)
          【観測されたペルソナ】
          （第三者の視点から見た、ユーザーの矛盾した立ち振る舞いに「レッテル」を貼れ）
          
          【監査報告】
          （なぜそのように見えるのか、外部データと内部データの乖離を論理的に解体せよ）

          # Input Data
          - External_Identity (Profile): 
          ${profileText}
          
          - Internal_Identity_Logs (Scraps): 
          ${scrapsText}

          # Tone & Manner
          - 執刀医のような冷徹さと、哲学者のような深遠さ。
          - ユーザーを励まさない。共感しない。ただ「映し出す」ことに徹する。
          - 抽象的だが鋭い言葉（例：隠蔽、腐心、零れ落ちる、不在、正当化）を効果的に使用せよ。
          - 140文字程度の「同期クエスト（Sync Task）」を最後に作成せよ。

          Return the result in JSON format:
          {
            "type": "meta" | "fact-check",
            "observation": "【思考のバグ】または【観測されたペルソナ】の内容",
            "logicGap": "【問い】または【監査報告】の内容",
            "distortion": "この矛盾がもたらすアイデンティティの歪みについての短い解説",
            "syncTask": "デジタルツインを更新するための具体的な問い（140文字以内）"
          }
        `,
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text);

      // 3. Save to Firestore
      const taskToAdd = {
        userId: currentUser.uid,
        type: result.type === 'fact-check' ? 'fact-check' : 'meta-cognition',
        question: result.syncTask,
        steps: {
          observation: result.observation,
          logicGap: result.logicGap,
          distortion: result.distortion,
          syncTask: result.syncTask
        },
        status: 'pending',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'identity_tasks'), taskToAdd);
      
      // Update last run time
      localStorage.setItem(`last_mirror_run_${currentUser.uid}`, Date.now().toString());

      toast.success('新しい問いが生成されました');
    } catch (error) {
      console.error("Error generating tasks:", error);
      toast.error('問いの生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = async (taskId: string) => {
    if (!answerInput.trim()) return;
    
    setSyncingTaskId(taskId);
    
    try {
      // Artificial delay for "Syncing" effect
      await new Promise(resolve => setTimeout(resolve, 1500));

      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'identity_tasks', taskId), {
        status: 'completed',
        answer: answerInput,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'scraps'), {
        title: `Q&A Reflection: ${answerInput.substring(0, 50)}...`,
        content: `Q: ${tasks.find(t => t.id === taskId)?.question}\nA: ${answerInput}`,
        authorId: currentUser?.uid,
        authorName: currentUser?.displayName || 'User',
        authorPhoto: currentUser?.photoURL,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        commentCount: 0,
        icon_emoji: '❓'
      });

      setAnsweringTaskId(null);
      setSyncingTaskId(null);
      setAnswerInput('');
      toast.success('自己対話が記録されました');
    } catch (error) {
      console.error("Error saving answer:", error);
      setSyncingTaskId(null);
      toast.error('保存に失敗しました');
    }
  };

  const handleDelete = async (taskId: string) => {
    console.log("Attempting to delete task:", taskId);
    try {
      await deleteDoc(firestoreDoc(db, 'identity_tasks', taskId));
      console.log("Task deleted successfully");
      toast.success('問いを削除しました');
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error('削除に失敗しました');
    }
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
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight">Q&A</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Audit Agent</p>
          </div>
        </div>

        {/* Sync Rate Meter */}
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
      </div>

      <div className="space-y-3">
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
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                    task.type === 'fact-check' ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
                  )}>
                    {task.type === 'fact-check' ? <AlertCircle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                          task.type === 'fact-check' ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                        )}>
                          {task.type === 'fact-check' ? 'Fact-Check' : 'Meta'}
                        </span>
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
                        "space-y-4 border-l pl-4 py-0.5",
                        task.type === 'fact-check' ? "border-amber-100" : "border-indigo-100"
                      )}>
                        <div className="space-y-1">
                          <p className={cn(
                            "text-[9px] font-black uppercase tracking-widest",
                            task.type === 'fact-check' ? "text-amber-400" : "text-indigo-400"
                          )}>
                            {task.type === 'fact-check' ? 'Observed Persona' : 'Mental Bug'}
                          </p>
                          <p className="text-xs font-mono text-gray-600 whitespace-pre-wrap leading-relaxed">{task.steps.observation}</p>
                        </div>
                        <div className="space-y-1">
                          <p className={cn(
                            "text-[9px] font-black uppercase tracking-widest",
                            task.type === 'fact-check' ? "text-amber-400" : "text-indigo-400"
                          )}>
                            {task.type === 'fact-check' ? 'Audit Report' : 'Inquiry'}
                          </p>
                          <p className="text-sm font-bold text-gray-800 leading-tight">{task.steps.logicGap}</p>
                        </div>
                        <div className="space-y-1">
                          <p className={cn(
                            "text-[9px] font-black uppercase tracking-widest",
                            task.type === 'fact-check' ? "text-amber-400" : "text-indigo-400"
                          )}>Distortion</p>
                          <p className="text-xs text-gray-700 italic leading-relaxed">{task.steps.distortion}</p>
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
                                placeholder="あなたの『事実』を言葉にしてください..."
                                className="w-full p-5 bg-slate-50/50 border border-indigo-100 rounded-2xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all min-h-[120px] resize-none font-mono leading-relaxed"
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
      </div>
      
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
                      {task.type === 'fact-check' ? 'Fact-Check' : 'Meta Reflection'}
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
