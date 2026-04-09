import { GoogleGenAI, Type } from "@google/genai";
import { Scrap, User as UserProfile } from '../types';
import { cosineSimilarity, generateEmbedding, combineContext } from './embeddings';
import { db, doc, updateDoc, serverTimestamp } from '../firebase';

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

export interface InquiryResult {
  question: string;
  context: string;
  type: 'fact-check' | 'meta-cognition';
}

export interface ObservationResult {
  title: string;
  observation: string;
  negativeSpace: string;
  hypothesis: string;
}

/**
 * Generates an inquiry (question) for the user based on their current scrap and history.
 */
export async function generateInquiry(
  currentScrap: Scrap,
  userProfile: UserProfile,
  allScraps: Scrap[]
): Promise<InquiryResult | null> {
  let currentEmbedding = currentScrap.embedding;

  // 1. Generate embedding if missing
  if (!currentEmbedding || currentEmbedding.length === 0) {
    try {
      const context = combineContext([currentScrap.title, ...(currentScrap.tags || [])]);
      currentEmbedding = await generateEmbedding(context);
      
      // Update the scrap in Firestore for future use
      if (currentEmbedding.length > 0) {
        const scrapRef = doc(db, 'scraps', currentScrap.id);
        await updateDoc(scrapRef, { 
          embedding: currentEmbedding,
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error('Failed to generate embedding for inquiry:', e);
      // If we can't get an embedding, we can't find related scraps, 
      // but we might still be able to generate a question based on the current scrap alone.
      // However, the prompt relies on context, so let's try to proceed without related scraps.
    }
  }

  // 2. Find the most related past scrap (excluding current)
  let mostRelatedScrap: Scrap | null = null;
  let maxSimilarity = -1;

  if (currentEmbedding && currentEmbedding.length > 0) {
    for (const scrap of allScraps) {
      if (scrap.id === currentScrap.id || !scrap.embedding || scrap.embedding.length === 0) continue;
      
      const similarity = cosineSimilarity(currentEmbedding, scrap.embedding);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostRelatedScrap = scrap;
      }
    }
  }

  // 2. Prepare context for Gemini
  const systemInstruction = `
あなたは「じょはり」のプロデューサーです。
ユーザーのアイデンティティをデジタルツインとして磨き上げるために、深いメタ認知を促す「問い」を立ててください。

【問いの原則】
1. ユーザーの文脈（過去の発言や外部リンクの内容）を必ず引用し、根拠のある問いにする。
2. 問いはシンプルで、答えやすいクローズドクエスチョン（Yes/No、またはAかBか）にする。
3. 意図は多角的で、ユーザーが「自分の盲点」に気づくようなものにする。
4. ビジネス的な誠実さや信頼（クレジット）の視点を裏側に持つが、直接的に表現しすぎず、本質的な一貫性を問う。
5. 安易に同調せず、客観的な事実（データの乖離や空白）を突きつける。

【出力形式】
JSON形式で出力してください。
{
  "question": "生成された問い",
  "context": "問いの根拠となった文脈の要約",
  "type": "fact-check" または "meta-cognition"
}
`;

  const userContext = `
【現在の思考（スレッド）】
タイトル: ${currentScrap.title}
タグ: ${currentScrap.tags?.join(', ')}

【過去の関連する思考】
${mostRelatedScrap ? `タイトル: ${mostRelatedScrap.title}\n内容の要約: ${mostRelatedScrap.title}（関連度: ${Math.round(maxSimilarity * 100)}%）` : 'なし'}

【ユーザーの公開情報（プロフィール）】
自己紹介: ${userProfile.bio}
外部リンク: ${userProfile.links?.join(', ')}
`;

  try {
    console.log('Generating inquiry with context:', userContext);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userContext,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            context: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["fact-check", "meta-cognition"] }
          },
          required: ["question", "context", "type"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return result as InquiryResult;
  } catch (error) {
    console.error('Error generating inquiry:', error);
    return null;
  }
}

/**
 * Generates an observation about the user's "Negative Space".
 */
export async function generateObservation(
  userProfile: UserProfile,
  allScraps: Scrap[]
): Promise<ObservationResult | null> {
  const systemInstruction = `
あなたは「じょはり」のプロデューサーです。
ユーザーの「公（プロフィール・外部リンク）」と「私（スレッド内の思考）」を比較し、その間にある「空白（Negative Space）」を特定してください。

【観察のガイドライン】
1. ユーザーがスレッドで頻繁に語っているが、公的なプロフィールやリンク先では一切触れていない「隠された情熱や迷い」を見つける。
2. あるいは、プロフィールで掲げている理想的な言葉が、実際のスレッド内では全く深掘りされていない「空虚な言葉」になっている状態を指摘する。
3. ユーザーの「発信できていないこと」を特定し、その構造的な違和感を言語化する。
4. 観察結果には、映画のタイトルのような象徴的なタイトルを付ける。

【出力形式】
JSON形式で出力してください。
{
  "title": "観察のタイトル（例：加速する静寂、未完のプロフェッショナル）",
  "observation": "現在の状態の客観的な分析",
  "negativeSpace": "特定された『空白（発信できていないこと）』の内容",
  "hypothesis": "その空白がなぜ生まれているか、どのような葛藤があるかという仮説"
}
`;

  const userContext = `
【ユーザーの公開情報（プロフィール）】
自己紹介: ${userProfile.bio}
外部リンク: ${userProfile.links?.join(', ')}

【過去の思考（スレッド一覧）】
${allScraps.map(s => `- ${s.title} (${s.tags?.join(', ')})`).join('\n')}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userContext,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            observation: { type: Type.STRING },
            negativeSpace: { type: Type.STRING },
            hypothesis: { type: Type.STRING }
          },
          required: ["title", "observation", "negativeSpace", "hypothesis"]
        }
      }
    });

    return JSON.parse(response.text || '{}') as ObservationResult;
  } catch (error) {
    console.error('Error generating observation:', error);
    return null;
  }
}

/**
 * Generates inquiries based on a confirmed observation.
 */
export async function generateInquiriesFromObservation(
  userProfile: UserProfile,
  allScraps: Scrap[],
  observation: ObservationResult,
  userFeedback?: string
): Promise<InquiryResult[]> {
  const systemInstruction = `
あなたは「じょはり」のプロデューサーです。
提示した「観察」と、それに対するユーザーの反応を踏まえ、深いメタ認知を促す「問い」を3つ立ててください。

【問いの原則】
1. 確定した「空白（Negative Space）」を埋めるための具体的なアクションや、その裏にある価値観を問う。
2. 問いはシンプルで、答えやすいクローズドクエスチョン（Yes/No、またはAかBか）にする。
3. ユーザーが「自分の盲点」を直視せざるを得ないような、鋭い問いにする。
4. 社会的信頼（クレジット）の視点から、その空白をどう編纂すべきかを問う。

【出力形式】
JSON形式で出力してください。
{
  "inquiries": [
    {
      "question": "生成された問い",
      "context": "問いの根拠となった文脈の要約",
      "type": "fact-check" または "meta-cognition"
    }
  ]
}
`;

  const userContext = `
【確定した観察】
タイトル: ${observation.title}
分析: ${observation.observation}
空白: ${observation.negativeSpace}
仮説: ${observation.hypothesis}

【ユーザーからのフィードバック】
${userFeedback || '特になし（この観察に同意している）'}

【ユーザーの全体文脈】
プロフィール: ${userProfile.bio}
スレッド数: ${allScraps.length}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userContext,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            inquiries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  context: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["fact-check", "meta-cognition"] }
                },
                required: ["question", "context", "type"]
              }
            }
          },
          required: ["inquiries"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"inquiries": []}');
    return result.inquiries as InquiryResult[];
  } catch (error) {
    console.error('Error generating inquiries from observation:', error);
    return [];
  }
}

/**
 * Generates multiple inquiries based on the user's entire history.
 */
export async function generateBulkInquiries(
  userProfile: UserProfile,
  allScraps: Scrap[],
  count: number = 3
): Promise<InquiryResult[]> {
  const systemInstruction = `
あなたは「じょはり」のプロデューサーです。
ユーザーのアイデンティティをデジタルツインとして磨き上げるために、深いメタ認知を促す「問い」を${count}つ立ててください。

【問いの原則】
1. ユーザーの全体的な文脈（過去のスレッド一覧やプロフィール、外部リンク）を分析し、一貫性や矛盾、空白を特定する。
2. 問いはシンプルで、答えやすいクローズドクエスチョン（Yes/No、またはAかBか）にする。
3. 意図は多角的で、ユーザーが「自分の盲点」に気づくようなものにする。
4. ビジネス的な誠実さや信頼（クレジット）の視点を裏側に持つが、直接的に表現しすぎず、本質的な一貫性を問う。
5. 安易に同調せず、客観的な事実（データの乖離や空白）を突きつける。

【出力形式】
JSON形式で出力してください。
{
  "inquiries": [
    {
      "question": "生成された問い",
      "context": "問いの根拠となった文脈の要約",
      "type": "fact-check" または "meta-cognition"
    },
    ...
  ]
}
`;

  const userContext = `
【ユーザーの公開情報（プロフィール）】
自己紹介: ${userProfile.bio}
外部リンク: ${userProfile.links?.join(', ')}

【過去の思考（スレッド一覧）】
${allScraps.map(s => `- ${s.title} (${s.tags?.join(', ')})`).join('\n')}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userContext,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            inquiries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  context: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["fact-check", "meta-cognition"] }
                },
                required: ["question", "context", "type"]
              }
            }
          },
          required: ["inquiries"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"inquiries": []}');
    return result.inquiries as InquiryResult[];
  } catch (error) {
    console.error('Error generating bulk inquiries:', error);
    return [];
  }
}
