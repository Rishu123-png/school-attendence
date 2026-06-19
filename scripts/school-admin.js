import {
  initTheme, showToast, showLoader, hideLoader,
  initOfflineBanner, startLoaderSafetyNet, clearLoaderSafetyNet
} from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { getSchoolSummary } from "../services/school-service.js";

initTheme(); initOfflineBanner(); showLoader();
startLoaderSafetyNet(10000);

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logoutCurrentUser();
  window.location.href = "./index.html";
});

function setText(id, v) { const el=document.getElementById(id); if(el) el.textContent=String(v??"")}

requireAuth(async user => {
  try {
    const profile = await getUserProfile(user.uid);
    if (!isSchoolAdmin(profile)) {
      showToast("Admin access only", "warn");
      clearLoaderSafetyNet(); hideLoader();
      setTimeout(() => { window.location.href = "./index.html"; }, 700);
      return;
    }
    const schoolId = getSchoolIdFromProfile(profile);
    if (!schoolId) { showToast("No school linked", "error"); clearLoaderSafetyNet(); hideLoader(); return; }

    let summary;
    try {
      summary = await getSchoolSummary(schoolId);
    } catch (err) {
      showToast("Could not load school data: " + (err.message || ""), "error");
      clearLoaderSafetyNet(); hideLoader(); return;
    }
    if (!summary) { showToast("School workspace not found", "error"); clearLoaderSafetyNet(); hideLoader(); return; }

    setText("schoolName",    summary.profile.name    || "School");
    setText("schoolMeta",    `${summary.profile.code || schoolId} · ${summary.profile.city || "City"}`);
    setText("countAdmins",   summary.counts.admins);
    setText("countTeachers", summary.counts.teachers);
    setText("countStudents", summary.counts.students);
    setText("countClasses",  summary.counts.classes);
    setText("countSubjects", summary.counts.subjects);

    const to = f => `${f}?schoolId=${encodeURIComponent(schoolId)}`;
    const links = {
      teachersLink:         to("./teachers-manage.html"),
      classesLink:          to("./classes-manage.html"),
      subjectsLink:         to("./subjects-manage.html"),
      studentsLink:         to("./students-manage.html"),
      assignmentsLink:      to("./teacher-assignments.html"),
      timetableLink:        to("./timetable-manage.html"),
      teacherScheduleLink:  to("./teacher-schedule.html"),
      periodAttendanceLink: to("./period-attendance.html"),
      topBunkersLink:       to("./top-bunkers.html"),
      notificationsLink:    to("./notifications.html"),
      announcementsLink:    to("./announcements.html"),
      holidaysLink:         to("./holidays.html"),
      analyticsLink:        to("./analytics.html"),
      reportLink:           to("./attendance-report.html"),
      leaderboardLink:      to("./leaderboard.html"),
      studentProfileLink:   to("./student-profile.html"),
    };
    Object.entries(links).forEach(([id, href]) => document.getElementById(id)?.setAttribute("href", href));

  } catch (err) {
    console.error(err);
    showToast("Error: " + (err.message || ""), "error");
  } finally {
    clearLoaderSafetyNet();
    hideLoader();
  }
}, () => {
  clearLoaderSafetyNet();
  hideLoader();
  window.location.href = "./index.html";
});
