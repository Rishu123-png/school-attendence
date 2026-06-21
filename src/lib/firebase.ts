import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBSWzs19870cWmGxd9-kJsKOOs755jyuU0",
  authDomain: "school-attendence-system-9090.firebaseapp.com",
  databaseURL: "https://school-attendence-system-9090-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "school-attendence-system-9090",
  storageBucket: "school-attendence-system-9090.firebasestorage.app",
  messagingSenderId: "728832169882",
  appId: "1:728832169882:web:b335869779e73ab8c20c23",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
