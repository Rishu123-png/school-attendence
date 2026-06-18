import { initTheme, showToast } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isSchoolAdmin } from "../services/profile-service.js";
import { createSchoolWorkspace } from "../services/school-service.js";

initTheme();

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logoutCurrentUser();
  window.location.href = "./index.html";
});

requireAuth(async (user) => {
  const profile = await getUserProfile(user.uid);
  if (isSchoolAdmin(profile)) {
    showToast("School already linked. Redirecting…", "info");
    setTimeout(() => {
      window.location.href = `./school-admin.html?schoolId=${encodeURIComponent(profile.schoolId || "")}`;
    }, 600);
  }
}, () => {
  window.location.href = "./index.html";
});

const form = document.getElementById("schoolSetupForm");
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    schoolName: document.getElementById("schoolName")?.value || "",
    schoolCode: document.getElementById("schoolCode")?.value || "",
    adminName: document.getElementById("adminName")?.value || "",
    adminEmail: document.getElementById("adminEmail")?.value || "",
    phone: document.getElementById("phone")?.value || "",
    city: document.getElementById("city")?.value || "",
    state: document.getElementById("state")?.value || "",
    website: document.getElementById("website")?.value || ""
  };

  try {
    const { schoolId } = await createSchoolWorkspace(payload);
    showToast("School workspace created", "success");
    setTimeout(() => {
      window.location.href = `./school-admin.html?schoolId=${encodeURIComponent(schoolId)}`;
    }, 500);
  } catch (error) {
    console.error(error);
    showToast(error.message || "School setup failed", "error");
  }
});