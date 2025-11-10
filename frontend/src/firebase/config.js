import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAN4GJStE29vS3QNmCX4q6ARMOS8L7xEzo",
  authDomain: "shef-lms-c8922.firebaseapp.com",
  projectId: "shef-lms-c8922",
  storageBucket: "shef-lms-c8922.firebasestorage.app",
  messagingSenderId: "575098853877",
  appId: "1:575098853877:web:d3817309af1045db50e8bc",
  measurementId: "G-ZNQQ3R6E6M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
