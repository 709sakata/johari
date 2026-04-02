import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { getFirestore, collection, collectionGroup, doc, getDoc, getDocs, addDoc, updateDoc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp, increment, getCountFromServer, limit, where, writeBatch } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Singleton pattern for Firebase initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged, collection, collectionGroup, doc, getDoc, getDocs, addDoc, updateDoc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp, increment, getCountFromServer, limit, where, writeBatch, updateProfile };
export type { User };
