import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  User 
} from 'firebase/auth';
import { auth } from './firebase';
import { Capacitor } from '@capacitor/core';

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  if (!auth) throw new Error('Firebase auth not initialized');
  
  try {
    const isNative = Capacitor.isNativePlatform();
    if (isNative) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    } else {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  if (!auth) throw new Error('Firebase auth not initialized');
  
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const getCurrentUser = (): User | null => {
  return auth?.currentUser || null;
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  
  return onAuthStateChanged(auth, callback);
};

export const requireAuth = (user: User | null): user is User => {
  return user !== null;
};

export const consumeRedirectResult = async (): Promise<User | null> => {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch {
    return null;
  }
};

export const updateDisplayName = async (user: User, displayName: string): Promise<void> => {
  if (!auth) throw new Error('Firebase auth not initialized');
  const trimmed = displayName.trim();
  if (!trimmed) throw new Error('Display name cannot be empty');
  await updateProfile(user, { displayName: trimmed });
};

export const updatePhotoURL = async (user: User, photoURL: string): Promise<void> => {
  if (!auth) throw new Error('Firebase auth not initialized');
  await updateProfile(user, { photoURL });
};

export const signUpWithEmail = async (email: string, password: string): Promise<User> => {
  if (!auth) throw new Error('Firebase auth not initialized');
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    console.error('Error signing up with email:', error);
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  if (!auth) throw new Error('Firebase auth not initialized');
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    console.error('Error signing in with email:', error);
    throw error;
  }
};
