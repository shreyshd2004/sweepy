import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc, 
  setDoc,
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { MaterialCatalogInput, MaterialCatalogDocument, UserDiscovery, MaterialStats, MaterialMatchResult, MaterialDocument } from './zodSchemas';

const MATERIAL_CATALOG_COLLECTION = 'materialCatalog';
const USER_DISCOVERIES_COLLECTION = 'userDiscoveries';
const MATERIAL_STATS_COLLECTION = 'materialStats';
const MATERIALS_COLLECTION = 'materials';

/**
 * Match a new material to existing catalog entries
 * Uses frequency data and name similarity
 */
export const matchMaterialToCatalog = async (
  materialName: string,
  frequencyData?: Record<string, any>
): Promise<MaterialMatchResult[]> => {
  if (!db) throw new Error('Firebase Firestore not initialized');

  try {
    const allCatalog = await getDocs(collection(db, MATERIAL_CATALOG_COLLECTION));
    const matches: MaterialMatchResult[] = [];

    allCatalog.forEach((doc) => {
      const catalogItem = doc.data();
      let confidence = 0;
      let matchReason: 'frequency' | 'name' | 'both' | 'none' = 'none';

      // Name similarity check (simple Levenshtein-like comparison)
      const nameSimilarity = calculateNameSimilarity(
        materialName.toLowerCase(),
        catalogItem.materialName.toLowerCase()
      );
      
      if (nameSimilarity > 0.7) {
        confidence += nameSimilarity * 0.6;
        matchReason = matchReason === 'none' ? 'name' : 'both';
      }

      // Frequency data matching (if available)
      if (frequencyData && catalogItem.averageFrequencyData) {
        const freqSimilarity = calculateFrequencySimilarity(
          frequencyData,
          catalogItem.averageFrequencyData
        );
        if (freqSimilarity > 0.6) {
          confidence += freqSimilarity * 0.4;
          matchReason = matchReason === 'none' ? 'frequency' : 'both';
        }
      }

      if (confidence > 0.5) {
        matches.push({
          matched: true,
          materialId: doc.id,
          materialName: catalogItem.materialName,
          confidence,
          matchReason,
        });
      }
    });

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);
    return matches.slice(0, 5); // Return top 5 matches
  } catch (error) {
    console.error('Error matching material to catalog:', error);
    throw error;
  }
};

/**
 * Calculate name similarity using simple string comparison
 */
function calculateNameSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.includes(str2) || str2.includes(str1)) return 0.9;
  
  // Simple character overlap
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  const overlap = shorter.split('').filter((char) => longer.includes(char)).length;
  return overlap / longer.length;
}

/**
 * Calculate frequency data similarity
 */
function calculateFrequencySimilarity(
  freq1: Record<string, any>,
  freq2: Record<string, any>
): number {
  try {
    const peaks1 = freq1.topPeaks || [];
    const peaks2 = freq2.topPeaks || [];
    
    if (peaks1.length === 0 || peaks2.length === 0) return 0;

    // Compare peak frequencies
    let matches = 0;
    const tolerance = 50; // Hz tolerance

    for (const peak1 of peaks1) {
      for (const peak2 of peaks2) {
        if (Math.abs(peak1.frequency - peak2.frequency) < tolerance) {
          matches++;
          break;
        }
      }
    }

    return matches / Math.max(peaks1.length, peaks2.length);
  } catch {
    return 0;
  }
}

/**
 * Create a new material catalog entry
 */
export const createCatalogEntry = async (
  data: MaterialCatalogInput,
  userId: string,
  userMaterialId?: string
): Promise<string> => {
  if (!db) throw new Error('Firebase Firestore not initialized');

  try {
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, MATERIAL_CATALOG_COLLECTION), docData);
    
    // Create initial stats
    await setDoc(doc(db, MATERIAL_STATS_COLLECTION, docRef.id), {
      materialId: docRef.id,
      totalDiscoveries: 1,
      totalRecordings: userMaterialId ? 1 : 0,
      firstDiscoveredBy: userId,
      firstDiscoveredAt: serverTimestamp(),
      lastDiscoveredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create user discovery record
    await addDoc(collection(db, USER_DISCOVERIES_COLLECTION), {
      userId,
      materialId: docRef.id,
      discoveredAt: serverTimestamp(),
      discoveryMethod: 'scan',
      userMaterialId: userMaterialId || null,
      isFirstDiscovery: true,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating catalog entry:', error);
    throw error;
  }
};

/**
 * Link user material to existing catalog entry
 */
export const linkMaterialToCatalog = async (
  userId: string,
  materialId: string,
  userMaterialId: string,
  hasRecording: boolean
): Promise<void> => {
  if (!db) throw new Error('Firebase Firestore not initialized');

  try {
    // Check if user already discovered this
    const existingQuery = query(
      collection(db, USER_DISCOVERIES_COLLECTION),
      where('userId', '==', userId),
      where('materialId', '==', materialId),
      limit(1)
    );
    const existing = await getDocs(existingQuery);
    
    if (!existing.empty) {
      console.log('User already discovered this material');
      return;
    }

    // Create user discovery record
    await addDoc(collection(db, USER_DISCOVERIES_COLLECTION), {
      userId,
      materialId,
      discoveredAt: serverTimestamp(),
      discoveryMethod: 'scan',
      userMaterialId,
      isFirstDiscovery: false,
      createdAt: serverTimestamp(),
    });

    // Update material stats
    const statsRef = doc(db, MATERIAL_STATS_COLLECTION, materialId);
    const statsDoc = await getDoc(statsRef);
    
    if (statsDoc.exists()) {
      const currentStats = statsDoc.data();
      await updateDoc(statsRef, {
        totalDiscoveries: (currentStats.totalDiscoveries || 0) + 1,
        totalRecordings: (currentStats.totalRecordings || 0) + (hasRecording ? 1 : 0),
        lastDiscoveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error linking material to catalog:', error);
    throw error;
  }
};

/**
 * Get all materials in catalog
 */
export const getMaterialCatalog = async (): Promise<MaterialCatalogDocument[]> => {
  if (!db) throw new Error('Firebase Firestore not initialized');

  try {
    const snapshot = await getDocs(collection(db, MATERIAL_CATALOG_COLLECTION));
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as MaterialCatalogDocument[];
  } catch (error) {
    console.error('Error getting material catalog:', error);
    throw error;
  }
};

/**
 * Get user's discovered materials
 */
export const getUserDiscoveries = async (userId: string): Promise<UserDiscovery[]> => {
  if (!db) throw new Error('Firebase Firestore not initialized');

  try {
    const q = query(
      collection(db, USER_DISCOVERIES_COLLECTION),
      where('userId', '==', userId),
      orderBy('discoveredAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      discoveredAt: doc.data().discoveredAt?.toDate() || new Date(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as UserDiscovery[];
  } catch (error) {
    console.error('Error getting user discoveries:', error);
    throw error;
  }
};

/**
 * Get material stats
 */
export const getMaterialStats = async (materialId: string): Promise<MaterialStats | null> => {
  if (!db) throw new Error('Firebase Firestore not initialized');

  try {
    const docRef = doc(db, MATERIAL_STATS_COLLECTION, materialId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      ...data,
      firstDiscoveredAt: data.firstDiscoveredAt?.toDate(),
      lastDiscoveredAt: data.lastDiscoveredAt?.toDate(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as MaterialStats;
  } catch (error) {
    console.error('Error getting material stats:', error);
    throw error;
  }
};

/**
 * Get catalog with user discovery status and stats
 */
export const getCatalogWithUserStatus = async (
  userId: string
): Promise<Array<MaterialCatalogDocument & { isDiscovered: boolean; stats: MaterialStats | null; userDiscovery?: UserDiscovery }>> => {
  if (!db) throw new Error('Firebase Firestore not initialized');

  try {
    const [catalog, discoveries] = await Promise.all([
      getMaterialCatalog(),
      getUserDiscoveries(userId),
    ]);

    const discoveryMap = new Map(discoveries.map((d) => [d.materialId, d]));

    const result = await Promise.all(
      catalog.map(async (item) => {
        const userDiscovery = discoveryMap.get(item.id);
        const stats = await getMaterialStats(item.id);
        
        return {
          ...item,
          isDiscovered: !!userDiscovery,
          stats,
          userDiscovery,
        };
      })
    );

    return result;
  } catch (error) {
    console.error('Error getting catalog with user status:', error);
    throw error;
  }
};

/**
 * Get all community recordings for a material
 */
export const getMaterialRecordings = async (materialId: string): Promise<MaterialDocument[]> => {
  if (!db) throw new Error('Firebase Firestore not initialized');

  try {
    // Get all user discoveries for this material that have recordings
    const discoveriesQuery = query(
      collection(db, USER_DISCOVERIES_COLLECTION),
      where('materialId', '==', materialId),
      where('userMaterialId', '!=', null)
    );
    const discoveries = await getDocs(discoveriesQuery);
    
    const materialIds = discoveries.docs
      .map((doc) => doc.data().userMaterialId)
      .filter((id): id is string => !!id);

    if (materialIds.length === 0) {
      return [];
    }

    // Fetch the actual material documents
    const materials: MaterialDocument[] = [];
    for (const materialId of materialIds) {
      try {
        const materialDoc = await getDoc(doc(db, MATERIALS_COLLECTION, materialId));
        if (materialDoc.exists()) {
          const data = materialDoc.data();
          materials.push({
            id: materialDoc.id,
            ownerUid: data.ownerUid,
            materialName: data.materialName,
            howToRecycle: data.howToRecycle,
            discoveredAt: data.discoveredAt?.toDate() || new Date(),
            similarMaterials: data.similarMaterials || [],
            imagePath: data.imagePath,
            audioPath: data.audioPath,
            frequencyData: data.frequencyData,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
        }
      } catch (err) {
        console.error(`Error fetching material ${materialId}:`, err);
      }
    }

    return materials;
  } catch (error) {
    console.error('Error getting material recordings:', error);
    throw error;
  }
};

/**
 * Calculate rarity based on discovery count
 */
export const calculateRarity = (discoveryCount: number): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' => {
  if (discoveryCount >= 100) return 'common';
  if (discoveryCount >= 50) return 'uncommon';
  if (discoveryCount >= 20) return 'rare';
  if (discoveryCount >= 5) return 'epic';
  return 'legendary';
};

/**
 * Update material rarity based on current stats
 */
export const updateMaterialRarity = async (materialId: string): Promise<void> => {
  if (!db) throw new Error('Firebase Firestore not initialized');

  try {
    const stats = await getMaterialStats(materialId);
    if (!stats) return;

    const rarity = calculateRarity(stats.totalDiscoveries);
    const catalogRef = doc(db, MATERIAL_CATALOG_COLLECTION, materialId);
    await updateDoc(catalogRef, {
      rarity,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating material rarity:', error);
    throw error;
  }
};

