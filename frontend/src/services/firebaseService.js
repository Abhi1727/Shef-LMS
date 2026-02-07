import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  COURSES: 'courses',
  MODULES: 'modules',
  LESSONS: 'lessons',
  ACTIVITIES: 'activities',
  PROJECTS: 'projects',
  ASSESSMENTS: 'assessments',
  JOBS: 'jobs',
  MENTORS: 'mentors',
  STATS: 'stats',
  CONTENT: 'content',
  CLASSROOM: 'classroom',
  LIVE_CLASSES: 'liveClasses'
};

// Generic CRUD operations
export const firebaseService = {
  // Create
  async create(collectionName, data) {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { id: docRef.id, success: true };
    } catch (error) {
      // Suppress noisy permission errors in production; they are expected when
      // Firestore rules block client access and backend APIs are the source of truth.
      if (!error?.message?.includes('Missing or insufficient permissions')) {
        console.error(`Error creating document in ${collectionName}:`, error);
      }
      return { success: false, error: error.message };
    }
  },

  // Read single document
  async getById(collectionName, id) {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
      } else {
        return { success: false, error: 'Document not found' };
      }
    } catch (error) {
      if (!error?.message?.includes('Missing or insufficient permissions')) {
        console.error(`Error getting document from ${collectionName}:`, error);
      }
      return { success: false, error: error.message };
    }
  },

  // Read all documents
  async getAll(collectionName, queryConstraints = []) {
    try {
      const collectionRef = collection(db, collectionName);
      const q = queryConstraints.length > 0 
        ? query(collectionRef, ...queryConstraints)
        : collectionRef;
      
      const querySnapshot = await getDocs(q);
      const documents = [];
      
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      
      return { success: true, data: documents };
    } catch (error) {
      if (!error?.message?.includes('Missing or insufficient permissions')) {
        console.error(`Error getting documents from ${collectionName}:`, error);
      }
      return { success: false, error: error.message };
    }
  },

  // Update
  async update(collectionName, id, data) {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      if (!error?.message?.includes('Missing or insufficient permissions')) {
        console.error(`Error updating document in ${collectionName}:`, error);
      }
      return { success: false, error: error.message };
    }
  },

  // Delete
  async delete(collectionName, id) {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      return { success: true };
    } catch (error) {
      if (!error?.message?.includes('Missing or insufficient permissions')) {
        console.error(`Error deleting document from ${collectionName}:`, error);
      }
      return { success: false, error: error.message };
    }
  },

  // Query with conditions
  async query(collectionName, conditions = []) {
    try {
      const collectionRef = collection(db, collectionName);
      const q = query(collectionRef, ...conditions);
      const querySnapshot = await getDocs(q);
      const documents = [];
      
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });
      
      return { success: true, data: documents };
    } catch (error) {
      if (!error?.message?.includes('Missing or insufficient permissions')) {
        console.error(`Error querying ${collectionName}:`, error);
      }
      return { success: false, error: error.message };
    }
  }
};
