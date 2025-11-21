import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { storage } from './firebase';

export const uploadMaterialImage = async (uid: string, file: File): Promise<string> => {
  if (!storage) throw new Error('Firebase Storage not initialized');
  
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${uid}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, `materials/${filename}`);
    
    // Upload file
    await uploadBytes(storageRef, file);
    
    // Return the path for storage in Firestore
    return `materials/${filename}`;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

export const uploadMaterialAudio = async (uid: string, blob: Blob): Promise<string> => {
  if (!storage) throw new Error('Firebase Storage not initialized');
  try {
    const timestamp = Date.now();
    const filename = `${uid}/${timestamp}.webm`;
    const storageRef = ref(storage, `materials-audio/${filename}`);
    await uploadBytes(storageRef, blob, { contentType: 'audio/webm' });
    return `materials-audio/${filename}`;
  } catch (error) {
    console.error('Error uploading audio:', error);
    throw error;
  }
};

export const getImageDownloadURL = async (imagePath: string): Promise<string> => {
  if (!storage) throw new Error('Firebase Storage not initialized');
  
  try {
    const storageRef = ref(storage, imagePath);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting download URL:', error);
    throw error;
  }
};

export const getAudioDownloadURL = async (audioPath: string): Promise<string> => {
  if (!storage) throw new Error('Firebase Storage not initialized');
  
  try {
    const storageRef = ref(storage, audioPath);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting audio download URL:', error);
    throw error;
  }
};

export const deleteMaterialImage = async (imagePath: string): Promise<void> => {
  if (!storage) throw new Error('Firebase Storage not initialized');
  
  try {
    const storageRef = ref(storage, imagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};

export const uploadUserProfileImage = async (uid: string, file: File): Promise<string> => {
  if (!storage) throw new Error('Firebase Storage not initialized');
  
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filename = `${uid}/profile_${timestamp}.${fileExtension}`;
    const storageRef = ref(storage, `user-profiles/${filename}`);
    
    // Upload file
    await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile image:', error);
    throw error;
  }
};
