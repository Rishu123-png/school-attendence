/* ============================================================
   SCHOOL ADMIN — UPGRADED
   Fixes: loader, breadcrumb, schoolId from profile only,
          error handling, clean link setup
   ============================================================ */

import { initTheme, showToast, showLoader, hideLoader, initOfflineBanner } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { getSchoolSummary } from "../services/school-service.js";

initTheme();
initOfflineBanner();
showLoader();

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logoutCurrentUser();
  window.location.href = "./index.html";
});

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? "");
}

requireAuth(async (user) => {
  try {
    const profile = await getUserProfile(user.uid);
    if (!isSchoolAdmin(profile)) {
      showToast("School admin access only", "warn");
      setTimeout(() => { window.location.href = "./index.html"; }, 700);
      return;
    }

    // SECURITY: schoolId from profile only
    const schoolId = getSchoolIdFromProfile(profile);
    if (!schoolId) {
      showToast("No school linked to this account.", "error");
      return;
    }

    const summary = await getSchoolSummary(schoolId);
    if (!summary) {
      showToast("School workspace not found", "error");
      return;
    }

    setText("schoolName",     summary.profile.name || "School");
    setText("schoolMeta",     `${summary.profile.code || schoolId} · ${summary.profile.city || "City"}`);
    setText("countAdmins",    summary.counts.admins);
    setText("countTeachers",  summary.counts.teachers);
    setText("countStudents",  summary.counts.students);
    setText("countClasses",   summary.counts.classes);
    setText("countSubjects",  summary.counts.subjects);

    const to = (file) => `${file}?schoolId=${encodeURIComponent(schoolId)}`;
    document.getElementById("teachersLink")?.setAttribute("href",         to("./teachers-manage.html"));
    document.getElementById("studentsLink")?.setAttribute("href",         to("./students-manage.html"));
    document.getElementById("classesLink")?.setAttribute("href",          to("./classes-manage.html"));
    document.getElementById("subjectsLink")?.setAttribute("href",         to("./subjects-manage.html"));
    document.getElementById("assignmentsLink")?.setAttribute("href",      to("./teacher-assignments.html"));
    document.getElementById("timetableLink")?.setAttribute("href",        to("./timetable-manage.html"));
    document.getElementById("teacherScheduleLink")?.setAttribute("href",  to("./teacher-schedule.html"));
    document.getElementById("periodAttendanceLink")?.setAttribute("href", to("./period-attendance.html"));
    document.getElementById("topBunkersLink")?.setAttribute("href",       to("./top-bunkers.html"));
    document.getElementById("notificationsLink")?.setAttribute("href",    to("./notifications.html"));

  } catch (err) {
    console.error(err);
    showToast("Failed to load admin panel: " + (err.message || ""), "error");
  } finally {
    hideLoader();
  }
}, () => {
  window.location.href = "./index.html";
});
