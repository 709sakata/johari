import { GoogleGenAI } from "@google/genai";
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  updateDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { IdentityState, IdentityTask, OperationType } from '../types';
import { QA_GENERATOR_PROMPT } from '../prompts/qaPrompts';
import { handleFirestoreError } from '../lib/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Service for handling Q&A (Digital Twin Edit) logic and AI interactions.
 */
export const qaService = {
  /**
   * Generates a new identity task using Gemini based on the current identity state.
   */
  async generateNewTask(userId: string, state: IdentityState): Promise<string> {
    try {
      // 1. Call Gemini to generate the question
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: QA_GENERATOR_PROMPT(state),
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text);

      // 2. Create a Scrap (thread) for this question
      const scrapRef = await addDoc(collection(db, 'scraps'), {
        title: result.question,
        content: "AI Editorによる建設的なツッコミ",
        authorId: userId,
        authorName: "Digital Twin Editor",
        authorPhoto: "https://api.dicebear.com/7.x/bottts/svg?seed=editor",
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        commentCount: 1,
        icon_emoji: '❓'
      });

      // 3. Add the AI's intent as the first comment in the thread
      await addDoc(collection(db, `scraps/${scrapRef.id}/comments`), {
        content: `【現状の見え方】\n${result.observation}\n\n【仕組みとしての不明点】\n${result.gap}`,
        authorId: userId, // Attributed to user to satisfy security rules, but labeled as Editor in UI
        authorName: "Digital Twin Editor",
        authorPhoto: "https://api.dicebear.com/7.x/bottts/svg?seed=editor",
        parentId: scrapRef.id,
        createdAt: serverTimestamp()
      });

      // 4. Create the IdentityTask record
      const taskToAdd = {
        userId,
        type: 'digital-twin-edit',
        question: result.question,
        scrapId: scrapRef.id,
        steps: {
          observation: result.observation,
          gap: result.gap,
          question: result.question
        },
        status: 'pending',
        createdAt: serverTimestamp()
      };

      const taskRef = await addDoc(collection(db, 'identity_tasks'), taskToAdd);
      return taskRef.id;
    } catch (error) {
      console.error("Error in generateNewTask:", error);
      throw error;
    }
  },

  /**
   * Submits an answer to a task, updating the task and the associated thread.
   */
  async answerTask(
    taskId: string, 
    answer: string, 
    scrapId: string | undefined,
    userId: string,
    userName: string,
    userPhoto?: string
  ): Promise<void> {
    try {
      // 1. Update the task status
      await updateDoc(doc(db, 'identity_tasks', taskId), {
        status: 'completed',
        answer: answer,
        completedAt: serverTimestamp()
      });

      // 2. Add the answer as a comment to the associated scrap thread
      if (scrapId) {
        await addDoc(collection(db, `scraps/${scrapId}/comments`), {
          content: answer,
          authorId: userId,
          authorName: userName,
          authorPhoto: userPhoto || null,
          parentId: scrapId,
          createdAt: serverTimestamp()
        });

        // 3. Update the scrap's metadata
        const scrapDoc = await getDoc(doc(db, 'scraps', scrapId));
        if (scrapDoc.exists()) {
          await updateDoc(doc(db, 'scraps', scrapId), {
            commentCount: (scrapDoc.data().commentCount || 0) + 1,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `identity_tasks/${taskId}`);
      throw error;
    }
  },

  /**
   * Clears all pending tasks for a user.
   */
  async clearPendingTasks(userId: string): Promise<void> {
    const pendingQuery = query(
      collection(db, 'identity_tasks'),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(pendingQuery);
    const deletePromises = snapshot.docs.map(d => updateDoc(d.ref, { status: 'cancelled', updatedAt: serverTimestamp() }));
    await Promise.all(deletePromises);
  }
};
