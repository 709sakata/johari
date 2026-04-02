import { auth } from '../firebase';
import { OperationType, FirestoreErrorInfo } from '../types';

export function safeStringify(obj: any, space?: string | number): string {
  try {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        // Handle Error objects
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        }
        // Handle React elements
        if (value.$$typeof) {
          return '[React Element]';
        }
        // Handle DOM nodes
        if (typeof window !== 'undefined' && value instanceof Node) {
          return `[DOM Node: ${value.nodeName}]`;
        }
        // Handle circular references
        if (cache.has(value)) {
          return '[Circular]';
        }
        cache.add(value);
      }
      return value;
    }, space);
  } catch (err) {
    return `[Serialization Error: ${err instanceof Error ? err.message : String(err)}]`;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  const serialized = safeStringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}
