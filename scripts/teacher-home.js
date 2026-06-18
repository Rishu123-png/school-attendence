/* ============================================================
   TEACHER HOME — UPGRADED
   Fixes: race condition, loader, not-linked card with UID display,
          bottom nav links, breadcrumb, schoolId from profile only,
          color-coded schedule, mobile data-label attributes
   ============================================================ */

import { initTheme, showToast, showLoader, hideLoader, initOfflineBanner, markActiveNav } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { listTeachers } from "../services/teacher-service.js";
import { listClasses } from "../services/class-service.js";
import { listTeacherScheduleForDate } from "../services/timetable-service.js";

let activeSchoolId = "";
let currentProfile = null;
let currentTeacher = null;
let classMap = new Map();

initTheme();
initOfflineBanner();
showLoader();

/* Network indicator */
function updateNetDot() {
  const dot = document.getElementById("netDot");
  if (dot) dot.classList.toggle("offline", !navigator.onLine);
}
window.addEventListener("online", updateNetDot);
window.addEventListener("offline", updateNetDot);
updateNetDot();

function goLogin() { window.location.href = "./index.html"; }

function formatToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? "");
}

function buildAttendanceUrl(row, dateStr) {
  const url = new URL("./period-attendance.html", window.location.href);
  url.searchParams.set("schoolId", activeSchoolId);
  url.searchParams.set("classId",  row.classId  || "");
  url.searchParams.set("date",     dateStr       || "");
  url.searchParams.set("periodId", row.periodId  || "");
  return url.toString();
}

function updateNextCard(rows, dateStr) {
  const card    = document.getElementById("nextClassCard");
  const btn     = document.getElementById("nextAttendanceBtn");
  const quickBtn= document.getElementById("goAttendanceBtn");
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
  setText("nextClassLabel",  `Class: ${classLabel}`);
  setText("nextTimeLabel",   `Time: ${[nextRow.startTime, nextRow.endTime].filter(Boolean).join(" - ") || "—"}`);
  setText("nextSubjectLabel",`Subject: ${nextRow.subjectName || nextRow.subjectId || "—"}`);
  setText("nextRoomLabel",   `Room: ${nextRow.roomNo || "—"}`);

  const targetUrl = buildAttendanceUrl(nextRow, dateStr);
  btn.onclick = () => { window.location.href = targetUrl; };
  quickBtn.onclick = () => { window.location.href = targetUrl; };
  quickBtn.disabled = false;
  card.style.display = "";
}

function renderSchedule(rows, dateStr) {
  updateNextCard(rows, dateStr);
  setText("todaySlotCount",   rows.length);
  setText("todaySubjectCount",rows.filter(r => r.slotType === "subject").length);
  setText("todayClassCount",  rows.filter(r => r.slotType !== "subject").length);

  const tbody = document.querySelector("#teacherHomeScheduleTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>No periods assigned for today.<br>Ask admin to check the timetable.</p>
        </div>
      </td></tr>`;
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    const classLabel = classMap.get(row.classId)?.displayName || row.classId || "—";
    const timeStr    = [row.startTime, row.endTime].filter(Boolean).join(" - ") || "—";
    const typeLabel  = row.slotType === "subject" ? "Subject" : "Class";
    const subject    = row.subjectName || row.subjectId || "—";
    const periodLbl  = row.label || `Period ${row.periodNo || ""}`;

    const fields = [
      { label: "Class",   value: classLabel },
      { label: "Period",  value: periodLbl },
      { label: "Type",    value: typeLabel },
      { label: "Time",    value: timeStr },
      { label: "Subject", value: subject },
      { label: "Room",    value: row.roomNo || "—" },
    ];

    fields.forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });

    const actionTd = document.createElement("td");
    actionTd.setAttribute("data-label", "Action");
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
  if (!currentTeacher) return;
  const dateStr = formatToday();
  const rows = await listTeacherScheduleForDate(activeSchoolId, currentTeacher.teacherId, dateStr);
  renderSchedule(rows, dateStr);
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logoutCurrentUser();
  goLogin();
});

document.getElementById("refreshHomeScheduleBtn")?.addEventListener("click", loadTeacherHome);

requireAuth(async (user) => {
  try {
    currentProfile = await getUserProfile(user.uid);
    if (!isTeacher(currentProfile) && !isSchoolAdmin(currentProfile)) {
      showToast("Teacher access only", "warn");
      setTimeout(goLogin, 700);
      return;
    }

    // SECURITY: schoolId always from profile, never from URL
    activeSchoolId = getSchoolIdFromProfile(currentProfile);
    if (!activeSchoolId) {
      showToast("No school linked to this account.", "warn");
      hideLoader();
      return;
    }

    const [teachers, classes] = await Promise.all([
      listTeachers(activeSchoolId),
      listClasses(activeSchoolId)
    ]);
    classMap = new Map(classes.map(item => [item.classId, item]));
    currentTeacher = teachers.find(row => String(row.authUid || "") === String(user.uid)) || null;

    // Set bottom nav links with schoolId
    const navLinks = {
      "nav-schedule":   `./teacher-schedule.html?schoolId=${encodeURIComponent(activeSchoolId)}`,
      "nav-attendance": `./period-attendance.html?schoolId=${encodeURIComponent(activeSchoolId)}`,
      "nav-bunkers":    `./top-bunkers.html?schoolId=${encodeURIComponent(activeSchoolId)}`,
      "nav-marks":      `./marks.html?schoolId=${encodeURIComponent(activeSchoolId)}`,
    };
    Object.entries(navLinks).forEach(([id, href]) => {
      document.getElementById(id)?.setAttribute("href", href);
    });

    // Set hero button links
    document.getElementById("goScheduleBtn")?.setAttribute("href", navLinks["nav-schedule"]);
    document.getElementById("goBunkersBtn")?.setAttribute("href",  navLinks["nav-bunkers"]);
    document.getElementById("goMarksBtn")?.setAttribute("href",    navLinks["nav-marks"]);

    markActiveNav();

    // Teacher info
    const name    = currentTeacher?.name || currentProfile.displayName || "Teacher";
    const subject = currentTeacher?.subject || "";
    setText("teacherName",       name);
    setText("teacherMeta",       subject ? `${subject} · School: ${activeSchoolId}` : `School: ${activeSchoolId}`);
    setText("teacherTodayChip",  `📅 Today: ${formatToday()}`);
    setText("teacherSchoolChip", `🏫 ${activeSchoolId}`);
    setText("teacherSubjectChip",`📘 ${subject || "Teacher"}`);

    if (!currentTeacher) {
      // Show helpful not-linked card
      const card = document.getElementById("notLinkedCard");
      if (card) card.style.display = "";
      const uidDisplay = document.getElementById("myAuthUidDisplay");
      if (uidDisplay) uidDisplay.textContent = user.uid;
      setText("teacherWelcomeLine", "Your teacher account is not linked yet. See the card below.");
      setText("todaySlotCount", "—");
      setText("todaySubjectCount", "—");
      setText("todayClassCount", "—");
    } else {
      setText("teacherWelcomeLine",
        "Your schedule is loaded from the timetable. Use the Next Class card to mark attendance quickly.");
      await loadTeacherHome();
    }
  } catch (err) {
    console.error(err);
    showToast("Failed to load teacher home: " + (err.message || "Unknown error"), "error");
  } finally {
    hideLoader();
  }
}, goLogin);
