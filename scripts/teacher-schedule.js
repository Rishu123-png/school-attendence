import { initTheme, showToast } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin } from "../services/profile-service.js";
import { listTeachers } from "../services/teacher-service.js";
import { listClasses } from "../services/class-service.js";
import { listTeacherScheduleForDate } from "../services/timetable-service.js";

let activeSchoolId = "";
let teacherMap = new Map();
let classMap = new Map();
let currentProfile = null;
let currentRows = [];

const DAY_LABELS = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday"
};

function goLogin() {
  window.location.href = "./index.html";
}

function setDayLabel() {
  const dateStr = document.getElementById("scheduleDateInput").value;
  if (!dateStr) return { key: "", label: "" };
  const d = new Date(`${dateStr}T00:00:00`);
  const keys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const key = keys[d.getDay()] || "";
  const label = DAY_LABELS[key] || "";
  document.getElementById("scheduleDayInput").value = label;
  return { key, label };
}

function fillTeacherSelect(rows) {
  const select = document.getElementById("scheduleTeacherSelect");
  const current = select.value;
  select.innerHTML = '<option value="">-- Select teacher --</option>';
  teacherMap = new Map();
  rows.forEach(row => {
    teacherMap.set(row.teacherId, row);
    const option = document.createElement("option");
    option.value = row.teacherId;
    option.textContent = row.name || row.teacherId;
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function attendanceUrl(row, dateStr) {
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
  if (!card || !btn) return;
  if (!rows.length) {
    card.style.display = "none";
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
  document.getElementById("nextClassLabel").textContent = `Class: ${classLabel}`;
  document.getElementById("nextTimeLabel").textContent = `Time: ${[nextRow.startTime, nextRow.endTime].filter(Boolean).join(" - ") || "—"}`;
  document.getElementById("nextSubjectLabel").textContent = `Subject: ${nextRow.subjectName || nextRow.subjectId || "—"}`;
  document.getElementById("nextRoomLabel").textContent = `Room: ${nextRow.roomNo || "—"}`;
  btn.onclick = () => { window.location.href = attendanceUrl(nextRow, dateStr); };
  card.style.display = "";
}

function renderRows(rows, dateStr) {
  currentRows = rows;
  updateNextCard(rows, dateStr);
  const tbody = document.querySelector("#scheduleTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "No schedule rows found for the selected teacher and date.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    const classLabel = classMap.get(row.classId)?.displayName || row.classId || "—";
    const values = [
      classLabel,
      DAY_LABELS[row.dayKey] || row.dayKey,
      row.label || `Period ${row.periodNo || ""}`,
      [row.startTime, row.endTime].filter(Boolean).join(" - ") || "—",
      row.slotType === "subject" ? "Subject" : "Class",
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
    btn.onclick = () => { window.location.href = attendanceUrl(row, dateStr); };
    actionTd.appendChild(btn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function loadSchedule() {
  const teacherId = document.getElementById("scheduleTeacherSelect").value;
  const dateStr = document.getElementById("scheduleDateInput").value;
  setDayLabel();
  if (!teacherId || !dateStr) {
    renderRows([], dateStr);
    return;
  }
  const rows = await listTeacherScheduleForDate(activeSchoolId, teacherId, dateStr);
  renderRows(rows, dateStr);
}

initTheme();
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logoutCurrentUser();
  goLogin();
});

requireAuth(async (user) => {
  currentProfile = await getUserProfile(user.uid);
  if (!isTeacher(currentProfile) && !isSchoolAdmin(currentProfile)) {
    showToast("Teacher access only", "warn");
    setTimeout(goLogin, 700);
    return;
  }

  activeSchoolId = new URLSearchParams(window.location.search).get("schoolId") || currentProfile.schoolId || "";
  document.getElementById("teacherName").textContent = currentProfile.displayName || "Teacher";
  document.getElementById("teacherMeta").textContent = activeSchoolId ? `School ID: ${activeSchoolId}` : "School not linked";

  const today = new Date();
  document.getElementById("scheduleDateInput").value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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
}, goLogin);