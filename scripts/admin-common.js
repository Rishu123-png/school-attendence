/* ============================================================
   ADMIN COMMON — UPGRADED
   Fixes: requireAuth race condition, loader overlay, offline banner
   Uses getSchoolIdFromProfile to never trust URL param for security
   ============================================================ */

import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { initTheme, showToast, showLoader, hideLoader, initOfflineBanner } from "./app-shell.js";

export async function initAdminPage(onReady) {
  initTheme();
  initOfflineBanner();
  showLoader();

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await logoutCurrentUser();
    window.location.href = "./index.html";
  });

  requireAuth(async (user) => {
    try {
      const profile = await getUserProfile(user.uid);
      if (!isSchoolAdmin(profile)) {
        showToast("School admin access only", "warn");
        setTimeout(() => { window.location.href = "./index.html"; }, 700);
        return;
      }
      const safeSchoolId = getSchoolIdFromProfile(profile);
      if (!safeSchoolId) {
        showToast("No school linked to this account.", "error");
        return;
      }
      await onReady(profile, safeSchoolId);
    } catch (err) {
      console.error(err);
      showToast("Failed to load page: " + (err.message || "Unknown error"), "error");
    } finally {
      hideLoader();
    }
  }, () => {
    window.location.href = "./index.html";
  });
}

export function schoolLink(fileName, schoolId) {
  return `${fileName}?schoolId=${encodeURIComponent(schoolId)}`;
}
