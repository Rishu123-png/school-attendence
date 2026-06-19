/* ============================================================
   INDEX.JS — v4 CLEAN FIX
   Key fix: hideLoader() is called ONCE when observeAuth fires.
   The loader overlay is IN the HTML, not created by JS.
   Auto-redirect happens smoothly without double-loader issue.
   ============================================================ */
import {
  initTheme, bindModal, showToast, hideLoader,
  initOfflineBanner, startLoaderSafetyNet, clearLoaderSafetyNet
} from "./app-shell.js";
import { loginWithEmail, observeAuth, sendPasswordReset } from "../services/auth-service.js";
import { getRouteForProfile, getUserProfile } from "../services/profile-service.js";

/* Init — overlay already in HTML, just start the safety net */
initTheme();
initOfflineBanner();
startLoaderSafetyNet(5000); /* If Firebase takes too long, hide spinner after 5s */

/* Bind modal */
bindModal("openLoginBtn", "loginModal", "closeLoginBtn");
document.getElementById("openLoginBtn2")?.addEventListener("click", () => {
  document.getElementById("loginModal")?.classList.add("active");
});

/* School setup */
document.getElementById("startSchoolSetupBtn")?.addEventListener("click", () => {
  localStorage.setItem("postLoginIntent", "school-setup");
  document.getElementById("loginModal")?.classList.add("active");
});

/* Show/hide password */
document.getElementById("togglePwd")?.addEventListener("click", () => {
  const pwd = document.getElementById("loginPassword");
  const isHidden = pwd.type === "password";
  pwd.type = isHidden ? "text" : "password";
  document.getElementById("togglePwd").textContent = isHidden ? "🙈" : "👁️";
});

/* Forgot password */
document.getElementById("forgotPwdBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail")?.value?.trim();
  if (!email) { showToast("Enter your email above first", "warn"); return; }
  try {
    await sendPasswordReset(email);
    showToast("Password reset email sent! Check your inbox.", "success");
  } catch (err) {
    showToast(err.message || "Failed to send reset email", "error");
  }
});

/* Login form */
document.getElementById("loginForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  document.getElementById("emailError").textContent    = "";
  document.getElementById("passwordError").textContent = "";

  const email    = document.getElementById("loginEmail")?.value?.trim()    || "";
  const password = document.getElementById("loginPassword")?.value || "";

  if (!email)    { document.getElementById("emailError").textContent    = "Email is required";    return; }
  if (!password) { document.getElementById("passwordError").textContent = "Password is required"; return; }

  const btn = document.getElementById("loginSubmitBtn");
  btn.disabled = true;
  btn.textContent = "Signing in…";

  try {
    const { user, profile } = await loginWithEmail(email, password);
    const intent = localStorage.getItem("postLoginIntent");
    localStorage.removeItem("postLoginIntent");
    if (intent === "school-setup") {
      window.location.href = "./school-setup.html";
      return;
    }
    const route = getRouteForProfile(profile || await getUserProfile(user.uid));
    window.location.href = route;
  } catch (err) {
    const code = err.code || "";
    const msg =
      code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
        ? "Invalid email or password."
        : code === "auth/too-many-requests"
        ? "Too many attempts. Try again later or reset your password."
        : err.message || "Login failed. Try again.";
    showToast(msg, "error");
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
});

/*
  observeAuth fires once when Firebase confirms auth state.
  - If user NOT logged in  → just hide the loader, show the page
  - If user IS logged in   → redirect to their dashboard
  This is the ONLY place hideLoader() is called on index.html.
*/
observeAuth(async user => {
  clearLoaderSafetyNet();
  hideLoader(); /* Always hide loader when auth state is known */

  if (!user) return; /* Not logged in — page is ready */

  /* Logged in → redirect */
  const intent = localStorage.getItem("postLoginIntent");
  if (intent === "school-setup") return; /* Let them finish setup */

  try {
    const profile = await getUserProfile(user.uid);
    if (profile) {
      window.location.href = getRouteForProfile(profile);
    }
  } catch (err) {
    /* Firebase read failed — just stay on login page */
    console.error("Auto-redirect failed:", err);
    showToast("Could not load profile. Check your connection.", "warn");
  }
});
