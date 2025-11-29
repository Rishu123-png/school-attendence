// auth.js
import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

window.login = async function() {
  const email = (document.getElementById('email')?.value || '').trim();
  const password = (document.getElementById('password')?.value || '');
  if (!email || !password) { alert('Enter email and password'); return; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    // on success redirect to dashboard
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("Login failed", err);
    alert(err.message || "Login failed");
  }
};