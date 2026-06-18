/* ============================================================
   TEACHER SCHEDULE — UPGRADED
   Fixes: loader, mobile data-labels, bottom nav, breadcrumb,
          schoolId from profile, error handling
   ============================================================ */

import { initTheme, showToast, showLoader, hideLoader, initOfflineBanner, markActiveNav } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { listTeachers } from "../services/teacher-service.js";
import { listClasses } from "../services/class-service.js";
import { listTeacherScheduleForDate } from "../services/timetable-service.js";

let activeSchoolId = "";
let classMap = new Map();
let currentProfile = null;

const DAY_LABELS = {
  monday:"Monday", tuesday:"Tuesday", wednesday:"Wednesday",
  thursday:"Thursday", friday:"Friday", saturday:"Saturday", sunday:"Sunday"
};

initTheme();
initOfflineBanner();
showLoader();

function goLogin() { window.location.href = "./index.html"; }

function setDayLabel() {
  const dateStr = document.getElementById("scheduleDateInput")?.value;
  if (!dateStr) return { key: "", label: "" };
  const d = new Date(`${dateStr}T00:00:00`);
  const keys = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const key = keys[d.getDay()] || "";
  const inp = document.getElementById("scheduleDayInput");
  if (inp) inp.value = DAY_LABELS[key] || "";
  return { key, label: DAY_LABELS[key] || "" };
}

function fillTeacherSelect(rows) {
  const select = document.getElementById("scheduleTeacherSelect");
  const current = select.value;
  select.innerHTML = '<option value="">-- Select teacher --</option>';
  rows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = row.teacherId;
    opt.textContent = row.name || row.teacherId;
    select.appendChild(opt);
  });
  if (current) select.value = current;
}

function attendanceUrl(row, dateStr) {
  const url = new URL("./period-attendance.html", window.location.href);
  url.searchParams.set("schoolId", activeSchoolId);
  url.searchParams.set("classId",  row.classId  || "");
  url.searchParams.set("date",     dateStr       || "");
  url.searchParams.set("periodId", row.periodId  || "");
  return url.toString();
}

function renderRows(rows, dateStr) {
  const card  = document.getElementById("nextClassCard");
  const tbody = document.querySelector("#scheduleTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Next class card
  if (rows.length && card) {
    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const nextRow = rows.find(row => {
      if (!String(row.startTime || "").includes(":")) return false;
      const [hh, mm] = row.startTime.split(":").map(Number);
      return hh * 60 + mm >= minutesNow;
    }) || rows[0];

    const classLabel = classMap.get(nextRow.classId)?.displayName || nextRow.classId || "—";
    document.getElementById("nextClassLabel").textContent  = `Class: ${classLabel}`;
    document.getElementById("nextTimeLabel").textContent   = `Time: ${[nextRow.startTime, nextRow.endTime].filter(Boolean).join(" - ") || "—"}`;
    document.getElementById("nextSubjectLabel").textContent= `Subject: ${nextRow.subjectName || nextRow.subjectId || "—"}`;
    document.getElementById("nextRoomLabel").textContent   = `Room: ${nextRow.roomNo || "—"}`;
    document.getElementById("nextAttendanceBtn").onclick   = () => { window.location.href = attendanceUrl(nextRow, dateStr); };
    card.style.display = "";
  } else if (card) {
    card.style.display = "none";
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No schedule found for the selected teacher and date.<br>Check timetable assignments.</p>
      </div>
    </td></tr>`;
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    const classLabel = classMap.get(row.classId)?.displayName || row.classId || "—";
    const fields = [
      { label: "Class",   value: classLabel },
      { label: "Day",     value: DAY_LABELS[row.dayKey] || row.dayKey },
      { label: "Period",  value: row.label || `Period ${row.periodNo || ""}` },
      { label: "Time",    value: [row.startTime, row.endTime].filter(Boolean).join(" - ") || "—" },
      { label: "Type",    value: row.slotType === "subject" ? "Subject" : "Class" },
      { label: "Subject", value: row.subjectName || row.subjectId || "—" },
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
    btn.onclick = () => { window.location.href = attendanceUrl(row, dateStr); };
    actionTd.appendChild(btn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function loadSchedule() {
  const teacherId = document.getElementById("scheduleTeacherSelect")?.value;
  const dateStr   = document.getElementById("scheduleDateInput")?.value;
  setDayLabel();
  if (!teacherId || !dateStr) { renderRows([], dateStr); return; }
  const rows = await listTeacherScheduleForDate(activeSchoolId, teacherId, dateStr);
  renderRows(rows, dateStr);
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => { await logoutCurrentUser(); goLogin(); });

requireAuth(async (user) => {
  try {
    currentProfile = await getUserProfile(user.uid);
    if (!isTeacher(currentProfile) && !isSchoolAdmin(currentProfile)) {
      showToast("Teacher access only", "warn");
      setTimeout(goLogin, 700);
      return;
    }

    activeSchoolId = getSchoolIdFromProfile(currentProfile);
    if (!activeSchoolId) {
      showToast("No school linked to this account.", "warn");
      return;
    }

    const s = encodeURIComponent(activeSchoolId);
    document.getElementById("nav-home")?.setAttribute("href",       `./teacher-home.html?schoolId=${s}`);
    document.getElementById("nav-attendance")?.setAttribute("href", `./period-attendance.html?schoolId=${s}`);
    document.getElementById("nav-bunkers")?.setAttribute("href",    `./top-bunkers.html?schoolId=${s}`);
    document.getElementById("nav-marks")?.setAttribute("href",      `./marks.html?schoolId=${s}`);
    document.querySelector("#breadcrumb a")?.setAttribute("href",   `./teacher-home.html?schoolId=${s}`);
    markActiveNav();

    document.getElementById("teacherName").textContent = currentProfile.displayName || "Teacher";
    document.getElementById("teacherMeta").textContent = `School: ${activeSchoolId}`;

    const today = new Date();
    document.getElementById("scheduleDateInput").value =
      `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    setDayLabel();

    const [teachers, classes] = await Promise.all([listTeachers(activeSchoolId), listClasses(activeSchoolId)]);
    fillTeacherSelect(teachers.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""))));
    classMap = new Map(classes.map(item => [item.classId, item]));

    if (isTeacher(currentProfile)) {
      const teacher = teachers.find(row => String(row.authUid || "") === String(user.uid));
      if (teacher) {
        const select = document.getElementById("scheduleTeacherSelect");
        select.value = teacher.teacherId;
        select.disabled = true;
      }
    }

    document.getElementById("scheduleRefreshBtn")?.addEventListener("click", loadSchedule);
    document.getElementById("scheduleDateInput")?.addEventListener("change", loadSchedule);
    document.getElementById("scheduleTeacherSelect")?.addEventListener("change", loadSchedule);

    await loadSchedule();
  } catch (err) {
    console.error(err);
    showToast("Failed to load schedule: " + (err.message || ""), "error");
  } finally {
    hideLoader();
  }
}, goLogin);
