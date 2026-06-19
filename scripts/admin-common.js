
/* ============================================================
   ADMIN COMMON — v3.1 FIXED
   Fixes: loader never hangs, safety net, error messages shown
   ============================================================ */
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import {
  initTheme, showToast, showLoader, hideLoader,
  initOfflineBanner, startLoaderSafetyNet, clearLoaderSafetyNet
} from "./app-shell.js";

export async function initAdminPage(onReady) {
  initTheme();
  initOfflineBanner();
  showLoader();
  startLoaderSafetyNet(10000); /* Force-hide after 10s */

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await logoutCurrentUser();
    window.location.href = "./index.html";
  });

  requireAuth(async (user) => {
    let profile;
    try {
      profile = await getUserProfile(user.uid);
    } catch (err) {
      console.error("Profile read failed:", err);
      showToast("Cannot read profile. Check Firebase rules.", "error");
      clearLoaderSafetyNet();
      hideLoader();
      return;
    }

    if (!isSchoolAdmin(profile)) {
      showToast("School admin access only", "warn");
      clearLoaderSafetyNet();
      hideLoader();
      setTimeout(() => { window.location.href = "./index.html"; }, 700);
      return;
    }

    const safeSchoolId = getSchoolIdFromProfile(profile);
    if (!safeSchoolId) {
      showToast("No school linked to this account.", "error");
      clearLoaderSafetyNet();
      hideLoader();
      return;
    }

    try {
      await onReady(profile, safeSchoolId);
    } catch (err) {
      console.error("Admin page error:", err);
      showToast("Page error: " + (err.message || "Unknown"), "error");
    } finally {
      clearLoaderSafetyNet();
      hideLoader();
    }
  }, () => {
    clearLoaderSafetyNet();
    hideLoader();
    window.location.href = "./index.html";
  });
}

export function schoolLink(fileName, schoolId) {
  return `${fileName}?schoolId=${encodeURIComponent(schoolId)}`;
}