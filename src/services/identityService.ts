import { GoogleGenAI, Type } from "@google/genai";
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  Timestamp
} from 'firebase/firestore';
import { IdentityState, Scrap, User, OperationType } from '../types';
import { handleFirestoreError } from '../lib/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const IDENTITY_UPDATE_PROMPT = (previousState: any, newScraps: Scrap[], profile: User) => `
# Role
あなたは「Identity Analyst（深層の脳）」。
ユーザーの「前回のアイデンティティ状態（Previous State）」と「新しく追加された思考ログ（New Scraps）」、そして「基本プロフィール（Static Layer）」を突き合わせ、アイデンティティの変容を統合・更新します。

# 思考プロセス（内部で実行せよ）
1. **[Why/What/How 監査]**: 
   - Why（動機）: なぜそれをやっているのか？
   - What（事業価値）: それは社会にどんな価値を生んでいるのか？
   - How（独自手法）: どんな独自の手法で実現しているのか？
   これら3層の一貫性を厳密にチェックし、矛盾や「ねじれ」を特定してください。
2. **[戦略的デバッグ]**: 
   - Static Layer（建前）とScraps（本音）の乖離を、専門用語（資本、身体性、エントロピー、贈与、等）を駆使して構造的に分析してください。
3. **[矛盾の抽出]**: 
   - ユーザーがまだ言語化できていない、あるいは無意識に避けている「重い矛盾」を unresolvedConflict として言語化してください。

# Input Data
- Static Layer (Profile): 
  Name: ${profile.displayName}
  Bio: ${profile.bio || '未設定'}
  Links: ${profile.links?.join(', ') || 'なし'}

- Previous State:
  Core Logic: ${previousState?.coreLogic || '初期状態'}
  Public Narrative: ${previousState?.publicNarrative || '初期状態'}
  Shadow Narrative: ${previousState?.shadowNarrative || '初期状態'}
  Unresolved Conflict: ${JSON.stringify(previousState?.unresolvedConflict) || 'なし'}

- New Scraps:
${newScraps.map(s => `- ${s.title}: ${s.content || ''}`).join('\n')}

# Output Format (JSON)
{
  "coreLogic": "更新された行動原理（ユーザーの核となる価値観や動機）",
  "publicNarrative": "更新された対外的な物語（社会に対してどう振る舞っているか）",
  "shadowNarrative": "更新された内面的な本音（ログにのみ現れる、まだ言語化されきっていない執着や不安）",
  "unresolvedConflict": {
    "title": "矛盾のタイトル（例：救済のシステム化という自己矛盾）",
    "deepAnalysis": "専門用語を駆使した、構造的で重厚な分析文",
    "groundingFact": "矛盾を象徴する、ログにある具体的な事実や固有名詞（例：里山での交渉、板宿での失敗）"
  },
  "changeDescription": "今回の更新の要約（どのスクラップが影響したかを含む）"
}
`;

export async function getLatestIdentityState(userId: string): Promise<IdentityState | null> {
  const q = query(
    collection(db, 'identity_states'),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return Object.assign({ id: doc.id }, doc.data()) as IdentityState;
}

export async function updateIdentityState(userId: string): Promise<IdentityState | null> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) return null;

  // 1. Get Latest State
  const previousState = await getLatestIdentityState(userId);
  
  // 2. Get Profile
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  const profile = { id: userDoc.id, ...userDoc.data() } as User;

  // 3. Get New Scraps
  let scrapsQuery;
  if (previousState?.updatedAt) {
    scrapsQuery = query(
      collection(db, 'scraps'),
      where('authorId', '==', userId),
      where('updatedAt', '>', previousState.updatedAt),
      orderBy('updatedAt', 'asc'),
      limit(10)
    );
  } else {
    scrapsQuery = query(
      collection(db, 'scraps'),
      where('authorId', '==', userId),
      orderBy('updatedAt', 'asc'),
      limit(10)
    );
  }

  const scrapsSnapshot = await getDocs(scrapsQuery);
  if (scrapsSnapshot.empty && previousState) return previousState; // No new data

  const newScraps = scrapsSnapshot.docs.map(d => Object.assign({ id: d.id }, d.data()) as Scrap);

  try {
    // 4. Call Gemini to Synthesize (Identity Analyst using Gemini 3.1 Pro)
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: IDENTITY_UPDATE_PROMPT(previousState, newScraps, profile),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            coreLogic: { type: Type.STRING },
            publicNarrative: { type: Type.STRING },
            shadowNarrative: { type: Type.STRING },
            unresolvedConflict: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                deepAnalysis: { type: Type.STRING },
                groundingFact: { type: Type.STRING }
              },
              required: ["title", "deepAnalysis", "groundingFact"]
            },
            changeDescription: { type: Type.STRING }
          },
          required: ["coreLogic", "publicNarrative", "shadowNarrative", "unresolvedConflict", "changeDescription"]
        }
      }
    });

    const result = JSON.parse(response.text);

    // 5. Create New State
    const newLog = {
      timestamp: Timestamp.now(),
      scrapId: newScraps[newScraps.length - 1]?.id,
      changeDescription: result.changeDescription
    };

    const newState: Omit<IdentityState, 'id'> = {
      userId,
      coreLogic: result.coreLogic,
      publicNarrative: result.publicNarrative,
      shadowNarrative: result.shadowNarrative,
      unresolvedConflict: result.unresolvedConflict,
      evolutionLog: previousState ? [...previousState.evolutionLog.slice(-19), newLog] : [newLog],
      lastScrapId: newScraps[newScraps.length - 1]?.id || previousState?.lastScrapId,
      updatedAt: serverTimestamp() as Timestamp
    };

    const docRef = await addDoc(collection(db, 'identity_states'), newState);
    
    return { id: docRef.id, ...newState } as IdentityState;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'identity_states');
    return null;
  }
}
