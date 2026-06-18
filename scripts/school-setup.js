/* ============================================================
   SCHOOL SETUP — UPGRADED
   Fixes: loader, validation, error handling
   ============================================================ */

import { initTheme, showToast, showLoader, hideLoader, initOfflineBanner } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { createSchoolWorkspace } from "../services/school-service.js";

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
    if (isSchoolAdmin(profile)) {
      showToast("School already linked. Redirecting…", "info");
      const schoolId = getSchoolIdFromProfile(profile);
      setTimeout(() => {
        window.location.href = `./school-admin.html?schoolId=${encodeURIComponent(schoolId)}`;
      }, 600);
      return;
    }
  } catch { /* not yet admin — show setup form */ }
  hideLoader();
}, () => {
  window.location.href = "./index.html";
});

const form = document.getElementById("schoolSetupForm");
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const schoolName = document.getElementById("schoolName")?.value?.trim() || "";
  const schoolCode = document.getElementById("schoolCode")?.value?.trim() || "";
  const adminName  = document.getElementById("adminName")?.value?.trim()  || "";
  const adminEmail = document.getElementById("adminEmail")?.value?.trim() || "";

  if (!schoolName) { showToast("School name is required", "warn"); return; }
  if (!adminName)  { showToast("Admin name is required", "warn");  return; }
  if (!adminEmail) { showToast("Admin email is required", "warn"); return; }

  const btn = document.getElementById("schoolSetupSubmitBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }
  showLoader();

  try {
    const payload = {
      schoolName, schoolCode, adminName, adminEmail,
      phone:   document.getElementById("phone")?.value   || "",
      city:    document.getElementById("city")?.value    || "",
      state:   document.getElementById("state")?.value   || "",
      website: document.getElementById("website")?.value || ""
    };
    const { schoolId } = await createSchoolWorkspace(payload);
    showToast("🎉 School workspace created!", "success");
    setTimeout(() => {
      window.location.href = `./school-admin.html?schoolId=${encodeURIComponent(schoolId)}`;
    }, 800);
  } catch (error) {
    console.error(error);
    showToast(error.message || "School setup failed", "error");
    hideLoader();
    if (btn) { btn.disabled = false; btn.textContent = "Create School Workspace"; }
  }
});
