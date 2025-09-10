// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDXZxQzJ3ldiySsoGCKiZ_nmFSalr9nxPI",
  authDomain: "online-workspace-1c2a4.firebaseapp.com",
  projectId: "online-workspace-1c2a4",
  storageBucket: "online-workspace-1c2a4.firebasestorage.app",
  messagingSenderId: "245907207992",
  appId: "1:245907207992:web:d973906089f0d03380b3cd",
  measurementId: "G-X1YW2WDF5L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

console.log("hello firebase")

// Firestoreを使えるようにexport
export const db = getFirestore(app);
