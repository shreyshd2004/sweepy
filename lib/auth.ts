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
    
    // Always use redirect for better compatibility, especially with static exports
    // Redirect works reliably across all browsers and doesn't require popup permissions
    if (isNative) {
      console.log('Using redirect flow for Google sign-in (native platform)');
      await signInWithRedirect(auth, googleProvider);
      return null;
    } else {
      // For web, try popup first (better UX), but fall back to redirect if it fails
      try {
        console.log('Attempting popup flow for Google sign-in');
        const result = await signInWithPopup(auth, googleProvider);
        console.log('Popup sign-in successful');
        return result.user;
      } catch (popupError: any) {
        // If popup fails for any reason, use redirect
        console.log('Popup failed, using redirect flow:', popupError.code, popupError.message);
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/popup-closed-by-user' ||
            popupError.code === 'auth/cancelled-popup-request') {
          console.log('Popup blocked/closed, switching to redirect');
          await signInWithRedirect(auth, googleProvider);
          return null;
        }
        // For other errors, still try redirect as fallback
        console.log('Trying redirect as fallback');
        try {
          await signInWithRedirect(auth, googleProvider);
          return null;
        } catch (redirectError: any) {
          // If redirect also fails, throw the original popup error with better message
          console.error('Both popup and redirect failed:', redirectError);
          throw popupError;
        }
      }
    }
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    // Provide more user-friendly error messages
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this site and try again.');
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in was cancelled. Please try again.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.');
    } else if (error.code === 'auth/unauthorized-domain') {
      const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
      throw new Error(`This domain (${currentDomain}) is not authorized in Firebase. Please add it to Firebase Console → Authentication → Settings → Authorized domains.`);
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('Google sign-in is not enabled. Please contact support.');
    }
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
