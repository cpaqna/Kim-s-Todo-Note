// Firebase configuration
// Replace with your own Firebase config from Firebase Console
import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD8NlsQryshdEduVhbWu59LnlUjmInB_SI",
  authDomain: "kim-s-to-do-note.firebaseapp.com",
  projectId: "kim-s-to-do-note",
  storageBucket: "kim-s-to-do-note.firebasestorage.app",
  messagingSenderId: "692761041961",
  appId: "1:692761041961:web:5e7c33a67a51853cb09038",
  measurementId: "G-MSW4179D0X"
};

// Check if Firebase is configured
export const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export const googleProvider = new GoogleAuthProvider();

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  _auth = getAuth(app);
  _db = getFirestore(app);

  // Enable offline persistence
  enableIndexedDbPersistence(_db).catch((err: any) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistence failed: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistence not available in this browser');
    }
  });
} else {
  console.warn('⚠️ Firebase is not configured. Running in local demo mode.');
  console.warn('To enable real-time sync, update firebase config in src/firebase.ts');
}

export const auth = _auth;
export const db = _db;
