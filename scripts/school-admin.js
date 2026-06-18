import { initTheme, showToast } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isSchoolAdmin } from "../services/profile-service.js";
import { getSchoolSummary } from "../services/school-service.js";

initTheme();

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logoutCurrentUser();
  window.location.href = "./index.html";
});

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? "");
}

requireAuth(async (user) => {
  const profile = await getUserProfile(user.uid);
  if (!isSchoolAdmin(profile)) {
    showToast("School admin access only", "warn");
    setTimeout(() => { window.location.href = "./index.html"; }, 700);
    return;
  }

  const schoolId = new URLSearchParams(window.location.search).get("schoolId") || profile.schoolId;
  const summary = await getSchoolSummary(schoolId);
  if (!summary) {
    showToast("School workspace not found", "error");
    return;
  }

  setText("schoolName", summary.profile.name || "School");
  setText("schoolMeta", `${summary.profile.code || schoolId} · ${summary.profile.city || "City"}`);
  setText("countAdmins", summary.counts.admins);
  setText("countTeachers", summary.counts.teachers);
  setText("countStudents", summary.counts.students);
  setText("countClasses", summary.counts.classes);
  setText("countSubjects", summary.counts.subjects);
  setText("countTimetables", summary.counts.timetables);
}, () => {
  window.location.href = "./index.html";
});