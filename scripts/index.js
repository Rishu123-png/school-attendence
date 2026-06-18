import { initTheme, bindModal, showToast } from "./app-shell.js";
import { loginWithEmail, observeAuth } from "../services/auth-service.js";
import { getRouteForProfile, getUserProfile } from "../services/profile-service.js";

initTheme();
bindModal("openLoginBtn", "loginModal", "closeLoginBtn");

const form = document.getElementById("loginForm");
const createBtn = document.getElementById("startSchoolSetupBtn");

createBtn?.addEventListener("click", () => {
  localStorage.setItem("postLoginIntent", "school-setup");
  document.getElementById("loginModal")?.classList.add("active");
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email")?.value?.trim() || "";
  const password = document.getElementById("password")?.value || "";
  if (!email || !password) {
    showToast("Enter email and password", "warn");
    return;
  }

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
    showToast(error.message || "Login failed", "error");
  }
});

observeAuth(async (user) => {
  if (!user) return;
  const profile = await getUserProfile(user.uid);
  const intent = localStorage.getItem("postLoginIntent");
  if (intent === "school-setup") return;
  if (profile && window.location.pathname.endsWith("index.html")) {
    window.location.href = getRouteForProfile(profile);
  }
});