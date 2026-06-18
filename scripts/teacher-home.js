import { initTheme, showToast } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin } from "../services/profile-service.js";
import { listTeachers } from "../services/teacher-service.js";
import { listClasses } from "../services/class-service.js";
import { listTeacherScheduleForDate } from "../services/timetable-service.js";

let activeSchoolId = "";
let currentProfile = null;
let currentTeacher = null;
let classMap = new Map();

function goLogin() {
  window.location.href = "./index.html";
}

function formatToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? "");
}

function buildAttendanceUrl(row, dateStr) {
  const url = new URL("./period-attendance.html", window.location.href);
  url.searchParams.set("schoolId", activeSchoolId);
  url.searchParams.set("classId", row.classId || "");
  url.searchParams.set("date", dateStr || "");
  url.searchParams.set("periodId", row.periodId || "");
  return url.toString();
}

function updateNextCard(rows, dateStr) {
  const card = document.getElementById("nextClassCard");
  const btn = document.getElementById("nextAttendanceBtn");
  const quickBtn = document.getElementById("goAttendanceBtn");
  if (!card || !btn || !quickBtn) return;

  if (!rows.length) {
    card.style.display = "none";
    quickBtn.disabled = true;
    return;
  }

  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const nextRow = rows.find(row => {
    if (!String(row.startTime || "").includes(":")) return false;
    const [hh, mm] = row.startTime.split(":").map(Number);
    return hh * 60 + mm >= minutesNow;
  }) || rows[0];

  const classLabel = classMap.get(nextRow.classId)?.displayName || nextRow.classId || "—";
  setText("nextClassLabel", `Class: ${classLabel}`);
  setText("nextTimeLabel", `Time: ${[nextRow.startTime, nextRow.endTime].filter(Boolean).join(" - ") || "—"}`);
  setText("nextSubjectLabel", `Subject: ${nextRow.subjectName || nextRow.subjectId || "—"}`);
  setText("nextRoomLabel", `Room: ${nextRow.roomNo || "—"}`);

  const targetUrl = buildAttendanceUrl(nextRow, dateStr);
  btn.onclick = () => { window.location.href = targetUrl; };
  quickBtn.onclick = () => { window.location.href = targetUrl; };
  quickBtn.disabled = false;
  card.style.display = "";
}

function renderSchedule(rows, dateStr) {
  updateNextCard(rows, dateStr);

  setText("todaySlotCount", rows.length);
  setText("todaySubjectCount", rows.filter(row => row.slotType === "subject").length);
  setText("todayClassCount", rows.filter(row => row.slotType !== "subject").length);

  const tbody = document.querySelector("#teacherHomeScheduleTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = "No periods assigned for today.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    const classLabel = classMap.get(row.classId)?.displayName || row.classId || "—";
    const values = [
      classLabel,
      row.label || `Period ${row.periodNo || ""}`,
      row.slotType === "subject" ? "Subject" : "Class",
      [row.startTime, row.endTime].filter(Boolean).join(" - ") || "—",
      row.subjectName || row.subjectId || "—",
      row.roomNo || "—"
    ];
    values.forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });
    const actionTd = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "btn-cta";
    btn.textContent = "Mark Attendance";
    btn.onclick = () => { window.location.href = buildAttendanceUrl(row, dateStr); };
    actionTd.appendChild(btn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function loadTeacherHome() {
  if (!currentTeacher) {
    showToast("Teacher record not linked yet. Ask admin to link your Auth UID.", "warn");
    return;
  }
  const dateStr = formatToday();
  const rows = await listTeacherScheduleForDate(activeSchoolId, currentTeacher.teacherId, dateStr);
  renderSchedule(rows, dateStr);
}

initTheme();

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logoutCurrentUser();
  goLogin();
});

document.getElementById("goScheduleBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = `./teacher-schedule.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
});

document.getElementById("goBunkersBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  window.location.href = `./top-bunkers.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
});

document.getElementById("goMarksBtn")?.addEventListener("click", () => {
  showToast("Marks module will be rebuilt next in the clean structure.", "info");
});

document.getElementById("refreshHomeScheduleBtn")?.addEventListener("click", loadTeacherHome);

requireAuth(async (user) => {
  currentProfile = await getUserProfile(user.uid);
  if (!isTeacher(currentProfile) && !isSchoolAdmin(currentProfile)) {
    showToast("Teacher access only", "warn");
    setTimeout(goLogin, 700);
    return;
  }

  activeSchoolId = currentProfile.schoolId || new URLSearchParams(window.location.search).get("schoolId") || "";
  if (!activeSchoolId) {
    showToast("No school linked to this account.", "warn");
    return;
  }

  const [teachers, classes] = await Promise.all([
    listTeachers(activeSchoolId),
    listClasses(activeSchoolId)
  ]);
  classMap = new Map(classes.map(item => [item.classId, item]));
  currentTeacher = teachers.find(row => String(row.authUid || "") === String(user.uid)) || null;

  setText("teacherName", currentTeacher?.name || currentProfile.displayName || "Teacher");
  setText("teacherMeta", currentTeacher?.subject ? `${currentTeacher.subject} · School: ${activeSchoolId}` : `School: ${activeSchoolId}`);
  setText("teacherTodayChip", `Today: ${formatToday()}`);
  setText("teacherSchoolChip", `School: ${activeSchoolId}`);
  setText("teacherSubjectChip", `Subject: ${currentTeacher?.subject || "Teacher"}`);
  setText("teacherWelcomeLine", currentTeacher
    ? "Your schedule is loaded from the timetable. Use the next/current class card or the schedule table to mark attendance quickly."
    : "Your teacher account is not linked yet. Ask the admin to add your Auth UID in teacher management.");

  await loadTeacherHome();
}, goLogin);