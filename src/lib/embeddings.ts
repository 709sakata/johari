import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });

/**
 * Generates an embedding for the given text using Gemini.
 * @param text The text to embed.
 * @returns A promise that resolves to an array of numbers (the embedding).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  try {
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: [text],
    });

    if (result.embeddings && result.embeddings.length > 0) {
      return result.embeddings[0].values;
    }
    
    throw new Error('No embeddings returned from Gemini API');
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Combines multiple pieces of information into a single context string for embedding.
 * @param parts An array of strings to combine.
 * @returns A combined string.
 */
export function combineContext(parts: (string | undefined | null)[]): string {
  return parts.filter(p => !!p && p.trim().length > 0).join('\n---\n');
}

/**
 * Calculates the cosine similarity between two vectors.
 * @param v1 First vector.
 * @param v2 Second vector.
 * @returns The cosine similarity (0 to 1).
 */
export function cosineSimilarity(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length || v1.length === 0) return 0;
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    mag1 += v1[i] * v1[i];
    mag2 += v2[i] * v2[i];
  }
  
  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

/**
 * Generates an embedding for a user profile, including content from external links.
 */
export async function generateProfileEmbedding(
  displayName: string,
  bio: string,
  links: string[]
): Promise<number[]> {
  const linkContents: string[] = [];
  
  // Scrape links (limit to first 3 for performance)
  const linksToScrape = links.slice(0, 3);
  for (const url of linksToScrape) {
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (response.ok) {
        const data = await response.json();
        linkContents.push(`[Link: ${url}]\nTitle: ${data.title}\nContent: ${data.content.substring(0, 1000)}`);
      }
    } catch (err) {
      console.error(`Failed to scrape ${url}:`, err);
    }
  }

  const context = combineContext([
    displayName,
    bio,
    ...linkContents
  ]);

  return generateEmbedding(context);
}
