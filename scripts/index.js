/* ============================================================
   INDEX.JS — UPGRADED
   Fixes: openLoginBtn2 hack removed, forgot password added,
          form validation, show/hide password, loading state
   ============================================================ */

import { initTheme, bindModal, showToast, hideLoader, initOfflineBanner } from "./app-shell.js";
import { loginWithEmail, observeAuth, sendPasswordReset } from "../services/auth-service.js";
import { getRouteForProfile, getUserProfile } from "../services/profile-service.js";

initTheme();
initOfflineBanner();

bindModal("openLoginBtn", "loginModal", "closeLoginBtn");

/* Both login buttons open the same modal — no hack needed */
document.getElementById("openLoginBtn2")?.addEventListener("click", () => {
  document.getElementById("loginModal")?.classList.add("active");
});

/* School setup button */
document.getElementById("startSchoolSetupBtn")?.addEventListener("click", () => {
  localStorage.setItem("postLoginIntent", "school-setup");
  document.getElementById("loginModal")?.classList.add("active");
});

/* Show / hide password toggle */
const pwdInput = document.getElementById("password");
document.getElementById("togglePwd")?.addEventListener("click", () => {
  const isHidden = pwdInput.type === "password";
  pwdInput.type = isHidden ? "text" : "password";
  document.getElementById("togglePwd").textContent = isHidden ? "🙈" : "👁️";
});

/* Forgot password */
document.getElementById("forgotPwdBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("email")?.value?.trim();
  if (!email) {
    showToast("Enter your email address above first", "warn");
    document.getElementById("emailError").textContent = "Enter your email above";
    return;
  }
  try {
    await sendPasswordReset(email);
    showToast("Password reset email sent! Check your inbox.", "success");
  } catch (err) {
    showToast(err.message || "Failed to send reset email", "error");
  }
});

/* Form validation helpers */
function clearErrors() {
  document.getElementById("emailError").textContent = "";
  document.getElementById("passwordError").textContent = "";
  document.getElementById("email")?.classList.remove("input-error");
  document.getElementById("password")?.classList.remove("input-error");
}

/* Login form submit */
const form = document.getElementById("loginForm");
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();

  const email    = document.getElementById("email")?.value?.trim() || "";
  const password = document.getElementById("password")?.value || "";
  let valid = true;

  if (!email) {
    document.getElementById("emailError").textContent = "Email is required";
    document.getElementById("email").classList.add("input-error");
    valid = false;
  }
  if (!password) {
    document.getElementById("passwordError").textContent = "Password is required";
    document.getElementById("password").classList.add("input-error");
    valid = false;
  }
  if (!valid) return;

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
    window.location.href = getRouteForProfile(profile || await getUserProfile(user.uid));
  } catch (error) {
    console.error(error);
    const msg = error.code === "auth/invalid-credential" || error.code === "auth/wrong-password"
      ? "Invalid email or password."
      : error.code === "auth/too-many-requests"
      ? "Too many attempts. Try again later or reset your password."
      : error.message || "Login failed";
    showToast(msg, "error");
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
});

/* Auto-redirect if already logged in */
observeAuth(async (user) => {
  if (!user) {
    hideLoader();
    return;
  }
  const intent = localStorage.getItem("postLoginIntent");
  if (intent === "school-setup") {
    hideLoader();
    return;
  }
  const profile = await getUserProfile(user.uid);
  if (profile && (window.location.pathname.endsWith("index.html") || window.location.pathname === "/")) {
    window.location.href = getRouteForProfile(profile);
  } else {
    hideLoader();
  }
});
