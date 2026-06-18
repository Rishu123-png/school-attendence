import { auth } from "./firebase.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getUserProfile, getRouteForProfile } from "./profile-service.js";

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(credential.user.uid);
  return { user: credential.user, profile };
}

export async function logoutCurrentUser() {
  await signOut(auth);
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function requireAuth(onReady, onMissing) {
  if (auth.currentUser) {
    onReady(auth.currentUser);
    return () => {};
  }
  return observeAuth(user => {
    if (user) onReady(user);
    else if (onMissing) onMissing();
  });
}

export async function routeCurrentUser() {
  const user = auth.currentUser;
  if (!user) {
    window.location.href = "./index.html";
    return;
  }
  const profile = await getUserProfile(user.uid);
  window.location.href = getRouteForProfile(profile);
}