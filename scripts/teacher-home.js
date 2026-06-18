import { initTheme, showToast } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher } from "../services/profile-service.js";

initTheme();

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logoutCurrentUser();
  window.location.href = "./index.html";
});

requireAuth(async (user) => {
  const profile = await getUserProfile(user.uid);
  if (!isTeacher(profile) && profile?.role !== "schoolAdmin") {
    showToast("Teacher access only", "warn");
    setTimeout(() => { window.location.href = "./index.html"; }, 700);
    return;
  }

  document.getElementById("teacherName").textContent = profile?.displayName || "Teacher";
  document.getElementById("teacherMeta").textContent = profile?.schoolId ? `School: ${profile.schoolId}` : "School not linked";
}, () => {
  window.location.href = "./index.html";
});