import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc, 
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
import { MaterialInput, MaterialDocument } from './zodSchemas';

const MATERIALS_COLLECTION = 'materials';

export const createMaterial = async (uid: string, data: MaterialInput): Promise<string> => {
  if (!db) throw new Error('Firebase Firestore not initialized');
  
  try {
    const docRef = await addDoc(collection(db, MATERIALS_COLLECTION), {
      ownerUid: uid,
      materialName: data.materialName,
      howToRecycle: data.howToRecycle,
      discoveredAt: data.discoveredAt,
      similarMaterials: data.similarMaterials,
      imagePath: data.imagePath,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating material:', error);
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
      updateData.discoveredAt = data.discoveredAt;
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
