import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyA40kX5BGyREbDYljO-zyLdLLknsO11hBA",
    authDomain: "sweepy-863bf.firebaseapp.com",
    projectId: "sweepy-863bf",
    storageBucket: "sweepy-863bf.firebasestorage.app",
    messagingSenderId: "903661426001",
    appId: "1:903661426001:web:ae9472189347d235f26f70",
    measurementId: "G-JHPLVM7FTL"
  };

// Initialize Firebase only if not already initialized and config is available
const app = getApps().length === 0 && firebaseConfig.apiKey 
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// Initialize Firebase services only if app exists
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

export default app;
