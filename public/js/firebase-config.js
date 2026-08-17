// Import the functions you need from the SDKs you need (CDN URLs — no bundler in this project)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBFdvq-8aq29nnMEPHvqpaPsgSCnGndlao",
  authDomain: "lyroweb-academy.firebaseapp.com",
  projectId: "lyroweb-academy",
  storageBucket: "lyroweb-academy.firebasestorage.app",
  messagingSenderId: "677264464206",
  appId: "1:677264464206:web:cfbccc3f3338491e96661f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Point this at your backend (see README) — localhost for dev, deployed URL for prod
export const API_BASE = "http://localhost:4000";
