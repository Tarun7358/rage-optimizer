import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mock-auth-domain.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "rage-optimizer-mock",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "rage-optimizer-mock.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:000000000000",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://rage-optimizer-mock-default-rtdb.firebaseio.com"
};

let app;
let auth;
let db;
let rtdb;
let isMock = false;

try {
  // If no env is configured, flag it as mock
  if (!import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY === 'YOUR_FIREBASE_API_KEY') {
    isMock = true;
  }
  
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  rtdb = getDatabase(app);
  console.log('[Firebase Client] Initialized successfully. Mock mode:', isMock);
} catch (error) {
  console.warn('[Firebase Client Warning] Initialization failed, running in full Mock mode:', error.message);
  isMock = true;
}

export { app, auth, db, rtdb, isMock };
