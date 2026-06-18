/* ============================================================
   AUTH SERVICE — UPGRADED
   Fixes: requireAuth race condition (always use onAuthStateChanged),
          password reset added, no direct currentUser check
   ============================================================ */

import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getUserProfile, getRouteForProfile } from "./profile-service.js";

/* Login with email + password */
export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(credential.user.uid);
  return { user: credential.user, profile };
}

/* Logout */
export async function logoutCurrentUser() {
  await signOut(auth);
}

/* Send password reset email */
export async function sendPasswordReset(email) {
  if (!email) throw new Error("Email is required");
  await sendPasswordResetEmail(auth, email);
}

/* Observe auth state changes */
export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/* ─── FIXED: requireAuth — always uses onAuthStateChanged ─────
   The old version checked auth.currentUser directly which is
   null for 1-2 seconds on page load (race condition).
   This version always waits for Firebase to confirm auth state. */
export function requireAuth(onReady, onMissing) {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      onReady(user);
    } else {
      if (onMissing) onMissing();
    }
  });
}

/* Route after login */
export async function routeCurrentUser(user) {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }
  const profile = await getUserProfile(user.uid);
  window.location.href = getRouteForProfile(profile);
}
