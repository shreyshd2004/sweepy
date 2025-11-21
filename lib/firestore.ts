import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  serverTimestamp,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from './firebase';
import { MaterialInput, MaterialDocument, MaterialCatalogInput, MaterialCatalogDocument, UserDiscovery, MaterialStats, MaterialMatchResult } from './zodSchemas';

const MATERIALS_COLLECTION = 'materials';
const USERS_COLLECTION = 'users';
const MATERIAL_CATALOG_COLLECTION = 'materialCatalog';
const USER_DISCOVERIES_COLLECTION = 'userDiscoveries';
const MATERIAL_STATS_COLLECTION = 'materialStats';

export const createMaterial = async (uid: string, data: MaterialInput): Promise<string> => {
  if (!db) throw new Error('Firebase Firestore not initialized');
  
  try {
    // Ensure imagePath is never undefined - must be a string or null
    if (data.imagePath === undefined) {
      throw new Error('imagePath is required and cannot be undefined');
    }
    
    const docData: any = {
      ownerUid: uid,
      materialName: data.materialName,
      howToRecycle: data.howToRecycle || '',
      discoveredAt: Timestamp.fromDate(data.discoveredAt),
      similarMaterials: data.similarMaterials || [],
      imagePath: data.imagePath || null, // Explicitly null if empty, never undefined
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Add optional fields only if they exist
    if ((data as any).audioPath) {
      docData.audioPath = (data as any).audioPath;
    }
    if ((data as any).frequencyData) {
      // Check if frequencyData is too large and compress if needed
      const freqData = (data as any).frequencyData;
      if (freqData.frequencies && Array.isArray(freqData.frequencies)) {
        // Aggressively downsample if still too large (max 200 entries to avoid index limits)
        if (freqData.frequencies.length > 200) {
          console.warn('Frequency data still large, further downsampling to 200 entries...');
          const step = Math.ceil(freqData.frequencies.length / 200);
          freqData.frequencies = freqData.frequencies.filter((_: any, i: number) => i % step === 0);
          if (freqData.magnitudes && Array.isArray(freqData.magnitudes)) {
            freqData.magnitudes = freqData.magnitudes.filter((_: any, i: number) => i % step === 0);
          }
        }
      }
      docData.frequencyData = freqData;
    }

    console.log('Creating Firestore document with data:', {
      ownerUid: docData.ownerUid,
      materialName: docData.materialName,
      hasImagePath: !!docData.imagePath,
      hasAudioPath: !!docData.audioPath,
      hasFrequencyData: !!docData.frequencyData,
      frequencyDataSize: docData.frequencyData ? JSON.stringify(docData.frequencyData).length : 0
    });

    const docRef = await addDoc(collection(db, MATERIALS_COLLECTION), docData);
    console.log('Material document created:', docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('Error creating material:', {
      error,
      message: error?.message,
      code: error?.code,
      details: error
    });
    throw error;
  }
};

export const listMaterials = async (
  uid: string, 
  opts: { 
    search?: string; 
    limit?: number; 
    cursor?: QueryDocumentSnapshot<DocumentData>;
  } = {}
): Promise<{ materials: MaterialDocument[]; nextCursor?: QueryDocumentSnapshot<DocumentData> }> => {
  if (!db) throw new Error('Firebase Firestore not initialized');
  
  try {
    let q = query(
      collection(db, MATERIALS_COLLECTION),
      where('ownerUid', '==', uid),
      orderBy('discoveredAt', 'desc')
    );

    if (opts.limit) {
      q = query(q, limit(opts.limit));
    }

    if (opts.cursor) {
      q = query(q, startAfter(opts.cursor));
    }

    const snapshot = await getDocs(q);
    const materials: MaterialDocument[] = [];
    let nextCursor: QueryDocumentSnapshot<DocumentData> | undefined;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const material: MaterialDocument = {
        id: doc.id,
        ownerUid: data.ownerUid,
        materialName: data.materialName,
        howToRecycle: data.howToRecycle,
        discoveredAt: data.discoveredAt?.toDate() || new Date(),
        similarMaterials: data.similarMaterials || [],
        imagePath: data.imagePath,
        audioPath: data.audioPath,
        frequencyData: data.frequencyData || undefined,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };

      // Apply client-side search filter
      if (!opts.search || material.materialName.toLowerCase().includes(opts.search.toLowerCase())) {
        materials.push(material);
      }
    });

    // Set cursor for pagination
    if (snapshot.docs.length > 0) {
      nextCursor = snapshot.docs[snapshot.docs.length - 1];
    }

    return { materials, nextCursor };
  } catch (error) {
    console.error('Error listing materials:', error);
    throw error;
  }
};

export const getMaterial = async (uid: string, id: string): Promise<MaterialDocument | null> => {
  if (!db) throw new Error('Firebase Firestore not initialized');
  
  try {
    const docRef = doc(db, MATERIALS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    
    // Verify ownership
    if (data.ownerUid !== uid) {
      throw new Error('Unauthorized access to material');
    }

    return {
      id: docSnap.id,
      ownerUid: data.ownerUid,
      materialName: data.materialName,
      howToRecycle: data.howToRecycle,
      discoveredAt: data.discoveredAt?.toDate() || new Date(),
      similarMaterials: data.similarMaterials || [],
      imagePath: data.imagePath,
      audioPath: data.audioPath,
      frequencyData: data.frequencyData || undefined,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('Error getting material:', error);
    throw error;
  }
};

export const updateMaterial = async (uid: string, id: string, data: Partial<MaterialInput>): Promise<void> => {
  if (!db) throw new Error('Firebase Firestore not initialized');
  
  try {
    const docRef = doc(db, MATERIALS_COLLECTION, id);
    
    // Verify ownership before updating
    const existingDoc = await getDoc(docRef);
    if (!existingDoc.exists() || existingDoc.data().ownerUid !== uid) {
      throw new Error('Unauthorized access to material');
    }

    const updateData: any = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    // Convert discoveredAt to Timestamp if provided
    if (data.discoveredAt) {
      updateData.discoveredAt = Timestamp.fromDate(data.discoveredAt);
    }

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating material:', error);
    throw error;
  }
};

export const deleteMaterial = async (uid: string, id: string): Promise<void> => {
  if (!db) throw new Error('Firebase Firestore not initialized');
  
  try {
    const docRef = doc(db, MATERIALS_COLLECTION, id);
    
    // Verify ownership before deleting
    const existingDoc = await getDoc(docRef);
    if (!existingDoc.exists() || existingDoc.data().ownerUid !== uid) {
      throw new Error('Unauthorized access to material');
    }

    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting material:', error);
    throw error;
  }
};

export type UserStats = {
  totalDiscovered: number;
  discoveredThisWeek: number;
  points: number;
};

export const getUserStats = async (uid: string): Promise<UserStats> => {
  if (!db) throw new Error('Firebase Firestore not initialized');

  try {
    const baseQuery = query(
      collection(db, MATERIALS_COLLECTION),
      where('ownerUid', '==', uid)
    );

    const allSnap = await getDocs(baseQuery);
    const totalDiscovered = allSnap.size;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weekQuery = query(
      collection(db, MATERIALS_COLLECTION),
      where('ownerUid', '==', uid),
      where('discoveredAt', '>=', Timestamp.fromDate(sevenDaysAgo)),
      orderBy('discoveredAt', 'asc')
    );
    const weekSnap = await getDocs(weekQuery);
    const discoveredThisWeek = weekSnap.size;

    // Enhanced scoring: 1 point per discovery + 2 bonus points for weekly discoveries
    const points = totalDiscovered + (discoveredThisWeek * 2);

    return { totalDiscovered, discoveredThisWeek, points };
  } catch (error) {
    console.error('Error computing user stats:', error);
    throw error;
  }
};

export type LeaderboardEntry = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  points: number;
  totalDiscovered: number;
  discoveredThisWeek: number;
  rank: number;
};

export const getLeaderboard = async (currentUserId?: string, limitCount: number = 50): Promise<LeaderboardEntry[]> => {
  if (!db) throw new Error('Firebase Firestore not initialized');

  try {
    // Get all materials to calculate stats per user
    const allMaterials = await getDocs(collection(db, MATERIALS_COLLECTION));
    
    // Group materials by user
    const userMaterials: Record<string, any[]> = {};
    allMaterials.forEach((doc) => {
      const data = doc.data();
      const uid = data.ownerUid;
      if (!userMaterials[uid]) {
        userMaterials[uid] = [];
      }
      userMaterials[uid].push(data);
    });

    // Calculate stats for each user
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgo);

    const userStatsMap: Record<string, { total: number; week: number; points: number }> = {};
    
    Object.entries(userMaterials).forEach(([uid, materials]) => {
      const total = materials.length;
      const week = materials.filter((m) => {
        const discoveredAt = m.discoveredAt;
        return discoveredAt && discoveredAt.toMillis() >= sevenDaysAgoTimestamp.toMillis();
      }).length;
      const points = total + (week * 2); // Same scoring as getUserStats
      
      userStatsMap[uid] = { total, week, points };
    });

    // Convert to leaderboard entries
    const leaderboardEntries: LeaderboardEntry[] = Object.entries(userStatsMap)
      .map(([uid, stats]) => ({
        uid,
        displayName: uid === currentUserId ? 'You' : `User ${uid.slice(0, 6)}`, // Show "You" for current user, otherwise show partial UID
        photoURL: null,
        points: stats.points,
        totalDiscovered: stats.total,
        discoveredThisWeek: stats.week,
        rank: 0, // Will be set after sorting
      }))
      .sort((a, b) => b.points - a.points) // Sort by points descending
      .slice(0, limitCount)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    return leaderboardEntries;
  } catch (error) {
    console.error('Error computing leaderboard:', error);
    throw error;
  }
};

// User Profile Functions
export const createUserProfile = async (uid: string, profileData: {
  username: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  bio?: string;
  photoURL?: string;
}): Promise<void> => {
  if (!db) throw new Error('Firebase Firestore not initialized');
  
  try {
    // Check if profile already exists
    const existingProfile = await getUserProfile(uid);
    if (existingProfile) {
      console.log('User profile already exists:', uid);
      return;
    }

    const docData = {
      uid,
      username: profileData.username,
      email: profileData.email,
      fullName: profileData.fullName,
      phoneNumber: profileData.phoneNumber || null,
      bio: profileData.bio || null,
      photoURL: profileData.photoURL || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Use UID as document ID to ensure uniqueness
    const docRef = doc(db, USERS_COLLECTION, uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Update existing document
      await updateDoc(docRef, docData);
    } else {
      // Create new document with UID as document ID
      await setDoc(docRef, docData);
    }
    console.log('User profile created:', uid);
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

export const getUserProfile = async (uid: string): Promise<any | null> => {
  if (!db) throw new Error('Firebase Firestore not initialized');
  
  try {
    // Try to get by document ID first (more efficient)
    const docRef = doc(db, USERS_COLLECTION, uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    }
    
    // Fallback: query by uid field (for backwards compatibility)
    const q = query(
      collection(db, USERS_COLLECTION),
      where('uid', '==', uid),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const fallbackDoc = snapshot.docs[0];
    const fallbackData = fallbackDoc.data();
    return {
      id: fallbackDoc.id,
      ...fallbackData,
      createdAt: fallbackData.createdAt?.toDate() || new Date(),
      updatedAt: fallbackData.updatedAt?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

export const updateUserProfile = async (uid: string, updates: {
  username?: string;
  fullName?: string;
  phoneNumber?: string;
  bio?: string;
  photoURL?: string;
}): Promise<void> => {
  if (!db) throw new Error('Firebase Firestore not initialized');
  
  try {
    // Use UID as document ID
    const docRef = doc(db, USERS_COLLECTION, uid);
    const profileDoc = await getDoc(docRef);
    
    if (!profileDoc.exists()) {
      throw new Error('User profile not found');
    }
    
    const updateData: any = {
      ...updates,
      updatedAt: serverTimestamp(),
    };
    
    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });
    
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

