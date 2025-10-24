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
