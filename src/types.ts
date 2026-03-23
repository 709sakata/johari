import { Timestamp } from 'firebase/firestore';

export interface UserLink {
  title: string;
  url: string;
  platform?: string;
}

export interface User {
  id: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  links?: string[];
  updatedAt: Timestamp;
}

export interface Scrap {
  id: string;
  title: string;
  content?: string; // Added
  status: 'open' | 'closed';
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  commentCount?: number;
  icon_emoji?: string;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  parentId?: string;
  images?: Record<string, string>;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export interface EvolutionLog {
  timestamp: Timestamp;
  scrapId?: string;
  changeDescription: string;
}

export interface UnresolvedConflict {
  title: string;
  deepAnalysis: string;
  groundingFact: string;
}

export interface IdentityTask {
  id: string;
  userId: string;
  type: 'digital-twin-edit';
  question: string;
  scrapId?: string;
  steps?: {
    observation: string;
    gap: string;
    question: string;
  };
  status: 'pending' | 'completed' | 'cancelled';
  answer?: string;
  createdAt: any;
  updatedAt?: any;
  completedAt?: any;
}

export interface IdentityState {
  id: string;
  userId: string;
  coreLogic: string;
  publicNarrative: string;
  shadowNarrative: string;
  unresolvedConflict: UnresolvedConflict;
  evolutionLog: EvolutionLog[];
  lastScrapId?: string; // To track where we left off in the incremental loop
  updatedAt: Timestamp;
}
