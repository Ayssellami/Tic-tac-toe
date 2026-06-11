// Import the functions you need from the SDKs you need
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore }
  from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCjQ2MMYPe31PohMSim75zBU59fZN3vs-E",
  authDomain: "tic-tac-toe-2c101.firebaseapp.com",
  projectId: "tic-tac-toe-2c101",
  storageBucket: "tic-tac-toe-2c101.firebasestorage.app",
  messagingSenderId: "692169897193",
  appId: "1:692169897193:web:e19f77e571d9154fbdac78"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);   // used in Milestone 2
export const db = getFirestore(app); // used from Milestone 3 on