import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isSchoolAdmin } from "../services/profile-service.js";
import { initTheme, showToast } from "./app-shell.js";

export async function initAdminPage(onReady) {
  initTheme();
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await logoutCurrentUser();
    window.location.href = "./index.html";
  });

  requireAuth(async (user) => {
    const profile = await getUserProfile(user.uid);
    if (!isSchoolAdmin(profile)) {
      showToast("School admin access only", "warn");
      setTimeout(() => { window.location.href = "./index.html"; }, 700);
      return;
    }
    await onReady(profile);
  }, () => {
    window.location.href = "./index.html";
  });
}

export function schoolLink(fileName, schoolId) {
  return `${fileName}?schoolId=${encodeURIComponent(schoolId)}`;
}