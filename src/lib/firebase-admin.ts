import { getApps, initializeApp, cert, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

// Firebase configuration from applet config
import firebaseConfig from '../../firebase-applet-config.json';

let app: App;

if (getApps().length === 0) {
  // In AI Studio environment, we often use the project ID from the config
  // For a full production environment, you would use a service account JSON
  // Here we fallback to default credentials if no service account is provided
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
    : undefined;

  const options: any = {
    projectId: firebaseConfig.projectId,
  };

  if (serviceAccount) {
    options.credential = cert(serviceAccount);
  } else {
    // Explicitly use application default credentials if available
    try {
      options.credential = applicationDefault();
    } catch (e) {
      console.warn('Failed to load application default credentials, falling back to project ID only:', e);
    }
  }

  app = initializeApp(options);
} else {
  app = getApps()[0];
}

export const adminDb: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const adminAuth: Auth = getAuth(app);
export { app as adminApp };
