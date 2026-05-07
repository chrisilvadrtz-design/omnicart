// src/services/firebase.js
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export function initFirebase() {
  if (getApps().length === 0) {
    const firebaseConfig = {
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
      authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
      storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.REACT_APP_FIREBASE_APP_ID,
    };

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.warn('Firebase client config is not fully set in env variables. Set REACT_APP_FIREBASE_* variables to enable auth features.');
    }

    try {
      initializeApp(firebaseConfig);
    } catch (e) {
      console.warn('Firebase initializeApp error', e.message || e);
    }
  }
}

export function getFirebaseAuth() {
  return getAuth();
}
