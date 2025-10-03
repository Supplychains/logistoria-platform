import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBTt15nGxqXjajIDCksmZZyG86UxBwb6to",
  authDomain: "logistoria-platform.firebaseapp.com",
  projectId: "logistoria-platform",
  storageBucket: "logistoria-platform.firebasestorage.app",
  messagingSenderId: "633024025477",
  appId: "1:633024025477:web:e69ea36addbe4c47d12aec"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);