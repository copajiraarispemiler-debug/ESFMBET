import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAyR9QQN3k226J2YkMecEKti2h3Qp0yP3Y",
  authDomain: "esfmbet.firebaseapp.com",
  projectId: "esfmbet",
  storageBucket: "esfmbet.firebasestorage.app",
  messagingSenderId: "733155585138",
  appId: "1:733155585138:web:a68c14391e09d7c74326eb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });