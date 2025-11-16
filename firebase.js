// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhAgQutvqEVE8hGPG360MD72sGmSHrmTw",
  authDomain: "school-attendace-d87e4.firebaseapp.com",
  databaseURL: "https://school-attendace-d87e4-default-rtdb.firebaseio.com",
  projectId: "school-attendace-d87e4",
  storageBucket: "school-attendace-d87e4.appspot.com",
  messagingSenderId: "969792838746",
  appId: "1:969792838746:web:bc7d770fc4d9b951d8b06e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db };