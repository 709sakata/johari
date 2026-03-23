import { db, auth, collection, addDoc, serverTimestamp } from '../firebase';

export enum ActivityType {
  PAGE_VIEW = 'page_view',
  ACTION = 'action',
}

export interface ActivityMetadata {
  [key: string]: any;
}

export async function logActivity(
  type: ActivityType,
  path?: string,
  action?: string,
  metadata?: ActivityMetadata
) {
  try {
    const logData: any = {
      type,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
    };

    if (auth.currentUser) {
      logData.userId = auth.currentUser.uid;
    }

    if (path) logData.path = path;
    if (action) logData.action = action;
    if (metadata) logData.metadata = metadata;

    await addDoc(collection(db, 'activity_logs'), logData);
  } catch (error) {
    // Fail silently for analytics to not disturb user flow
    console.warn('Analytics log failed:', error);
  }
}
