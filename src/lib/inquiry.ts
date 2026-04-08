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

    console.log('Gemini response for inquiry:', response.text);
    const result = JSON.parse(response.text || '{}');
    return result as InquiryResult;
  } catch (error) {
    console.error('Error generating inquiry:', error);
    return null;
  }
}
