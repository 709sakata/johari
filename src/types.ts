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
  tags?: string[];
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
  linkedTitles?: string[]; // Added for Scrapbox-like links
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
