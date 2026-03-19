import { Timestamp } from 'firebase/firestore';

export interface Scrap {
  id: string;
  title: string;
  status: 'open' | 'closed';
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  commentCount?: number;
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
