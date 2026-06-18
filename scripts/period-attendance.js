import { initTheme, showToast } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin } from "../services/profile-service.js";
import { listClasses } from "../services/class-service.js";
import { listTimetableForDay } from "../services/timetable-service.js";
import { listStudentsForAttendanceScope, getAttendanceRecords, savePeriodAttendance } from "../services/attendance-service.js";
import { listTeachers } from "../services/teacher-service.js";

let activeSchoolId = "";
let classMap = new Map();
let teacherMap = new Map();
let slots = [];
let visibleStudents = [];
let currentProfile = null;

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

function goBack() {
  if (isSchoolAdmin(currentProfile)) {
    window.location.href = `./school-admin.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
  } else {
    window.location.href = `./teacher-home.html?schoolId=${encodeURIComponent(activeSchoolId)}`;
  }
}

function setDayLabel() {
  const dateStr = document.getElementById("attendanceDateInput").value;
  if (!dateStr) return { key: "", label: "" };
  const d = new Date(`${dateStr}T00:00:00`);
  const keys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const key = keys[d.getDay()] || "";
  const label = DAY_LABELS[key] || "";
  document.getElementById("attendanceDayInput").value = label;
  return { key, label };
}

function fillClassSelect(rows) {
  const select = document.getElementById("attendanceClassSelect");
  const current = select.value;
  select.innerHTML = '<option value="">-- Select class --</option>';
  classMap = new Map();
  rows.forEach(row => {
    classMap.set(row.classId, row);
    const option = document.createElement("option");
    option.value = row.classId;
    option.textContent = row.displayName || row.classId;
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function fillPeriodSelect(rows) {
  const select = document.getElementById("attendancePeriodSelect");
  const current = select.value;
  select.innerHTML = '<option value="">-- Select period --</option>';
  slots = rows;
  rows.forEach(row => {
    const option = document.createElement("option");
    const timeLabel = [row.startTime, row.endTime].filter(Boolean).join(" - ");
    option.value = row.periodId;
    option.textContent = `${row.label || `Period ${row.periodNo || ""}`} · ${row.subjectName || row.subjectId || "Subject"}${timeLabel ? ` · ${timeLabel}` : ""}`;
    select.appendChild(option);
  });
  if (current && rows.some(r => r.periodId === current)) select.value = current;
}

function updateSummary(slot, classId) {
  const card = document.getElementById("attendanceSummaryCard");
  if (!slot || !classId) {
    card.style.display = "none";
    return;
  }
  const classLabel = classMap.get(classId)?.displayName || classId;
  document.getElementById("summaryClass").textContent = `Class: ${classLabel}`;
  document.getElementById("summaryType").textContent = `Type: ${slot.slotType === "subject" ? "Subject" : "Class"}`;
  document.getElementById("summarySubject").textContent = `Subject: ${slot.subjectName || slot.subjectId || "—"}`;
  document.getElementById("summaryTeacher").textContent = `Teacher: ${slot.teacherName || slot.teacherId || "—"}`;
  document.getElementById("summaryTime").textContent = `Time: ${[slot.startTime, slot.endTime].filter(Boolean).join(" - ") || "—"}`;
  card.style.display = "";
}

function renderRoster(records = {}) {
  const tbody = document.querySelector("#attendanceTable tbody");
  tbody.innerHTML = "";
  if (!visibleStudents.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No students available for this slot.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  const statuses = [
    ["present", "Present"],
    ["absent", "Absent"],
    ["late", "Late"],
    ["leave", "Leave"],
    ["medical", "Medical"],
    ["halfDay", "Half Day"]
  ];

  visibleStudents.forEach(student => {
    const tr = document.createElement("tr");
    [student.fullName, classMap.get(student.classId)?.displayName || student.classId || "—", student.rollNo || "—"].forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });
    const statusTd = document.createElement("td");
    const select = document.createElement("select");
    select.dataset.studentId = student.studentId;
    select.dataset.studentName = student.fullName || "";
    statuses.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = records[student.studentId]?.status || "present";
    statusTd.appendChild(select);
    tr.appendChild(statusTd);
    tbody.appendChild(tr);
  });
}

async function loadRoster({ preloadAttendance = true } = {}) {
  const classId = document.getElementById("attendanceClassSelect").value;
  const dateStr = document.getElementById("attendanceDateInput").value;
  const dayInfo = setDayLabel();
  if (!classId || !dateStr) {
    fillPeriodSelect([]);
    visibleStudents = [];
    renderRoster({});
    updateSummary(null, classId);
    return;
  }

  const timetableRows = await listTimetableForDay(activeSchoolId, classId, dayInfo.key);
  fillPeriodSelect(timetableRows);
  const periodId = document.getElementById("attendancePeriodSelect").value;
  const slot = timetableRows.find(item => item.periodId === periodId) || null;
  visibleStudents = slot
    ? await listStudentsForAttendanceScope(activeSchoolId, classId, slot.slotType || "class", slot.subjectId || "")
    : [];

  let records = {};
  if (preloadAttendance && slot && periodId) {
    records = await getAttendanceRecords(activeSchoolId, classId, dateStr, periodId);
  }
  renderRoster(records);
  updateSummary(slot, classId);
}

async function saveRoster() {
  const classId = document.getElementById("attendanceClassSelect").value;
  const dateStr = document.getElementById("attendanceDateInput").value;
  const periodId = document.getElementById("attendancePeriodSelect").value;
  const slot = slots.find(item => item.periodId === periodId) || null;
  if (!classId || !dateStr || !periodId || !slot) {
    showToast("Select class, date and period first", "warn");
    return;
  }

  const rows = Array.from(document.querySelectorAll('#attendanceTable tbody select[data-student-id]')).map(select => ({
    studentId: select.dataset.studentId,
    studentName: select.dataset.studentName,
    status: select.value
  }));
  if (!rows.length) {
    showToast("No students found for this slot", "warn");
    return;
  }

  const authUser = currentProfile;
  const teacherName = authUser?.displayName || slot.teacherName || "Teacher";
  await savePeriodAttendance(activeSchoolId, {
    classId,
    date: dateStr,
    periodId,
    slotType: slot.slotType || "class",
    subjectId: slot.subjectId || "",
    subjectName: slot.subjectName || "",
    teacherId: slot.teacherId || authUser?.teacherId || "",
    teacherName,
    rows
  });
  showToast("Period attendance saved", "success");
}

initTheme();
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logoutCurrentUser();
  goLogin();
});

document.getElementById("backBtn")?.addEventListener("click", goBack);
document.getElementById("attendanceLoadBtn")?.addEventListener("click", () => loadRoster({ preloadAttendance: true }));
document.getElementById("attendanceSaveBtn")?.addEventListener("click", saveRoster);

document.getElementById("attendanceClassSelect")?.addEventListener("change", () => loadRoster({ preloadAttendance: false }));
document.getElementById("attendanceDateInput")?.addEventListener("change", () => loadRoster({ preloadAttendance: false }));
document.getElementById("attendancePeriodSelect")?.addEventListener("change", async () => {
  const classId = document.getElementById("attendanceClassSelect").value;
  const dateStr = document.getElementById("attendanceDateInput").value;
  const periodId = document.getElementById("attendancePeriodSelect").value;
  const slot = slots.find(item => item.periodId === periodId) || null;
  visibleStudents = slot ? await listStudentsForAttendanceScope(activeSchoolId, classId, slot.slotType || "class", slot.subjectId || "") : [];
  const records = periodId ? await getAttendanceRecords(activeSchoolId, classId, dateStr, periodId) : {};
  renderRoster(records);
  updateSummary(slot, classId);
});

requireAuth(async (user) => {
  currentProfile = await getUserProfile(user.uid);
  if (!isTeacher(currentProfile) && !isSchoolAdmin(currentProfile)) {
    showToast("Teacher access only", "warn");
    setTimeout(goLogin, 700);
    return;
  }

  activeSchoolId = new URLSearchParams(window.location.search).get("schoolId") || currentProfile.schoolId || "";
  const classIdFromQuery = new URLSearchParams(window.location.search).get("classId") || "";
  const dateFromQuery = new URLSearchParams(window.location.search).get("date") || "";
  const periodIdFromQuery = new URLSearchParams(window.location.search).get("periodId") || "";
  document.getElementById("attendanceMeta").textContent = activeSchoolId ? `School ID: ${activeSchoolId}` : "School not linked";

  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  document.getElementById("attendanceDateInput").value = dateFromQuery || defaultDate;
  setDayLabel();

  const [classes, teachers] = await Promise.all([listClasses(activeSchoolId), listTeachers(activeSchoolId)]);
  classMap = new Map(classes.map(item => [item.classId, item]));
  teacherMap = new Map(teachers.map(item => [item.teacherId, item]));

  const classSelect = document.getElementById("attendanceClassSelect");
  classSelect.innerHTML = '<option value="">-- Select class --</option>';
  classes.sort((a,b) => String(a.displayName||"").localeCompare(String(b.displayName||""))).forEach(item => {
    const option = document.createElement("option");
    option.value = item.classId;
    option.textContent = item.displayName || item.classId;
    classSelect.appendChild(option);
  });
  if (classIdFromQuery) classSelect.value = classIdFromQuery;

  await loadRoster({ preloadAttendance: false });
  if (periodIdFromQuery) {
    document.getElementById("attendancePeriodSelect").value = periodIdFromQuery;
    const slot = slots.find(item => item.periodId === periodIdFromQuery) || null;
    visibleStudents = slot ? await listStudentsForAttendanceScope(activeSchoolId, classIdFromQuery, slot.slotType || "class", slot.subjectId || "") : [];
    const records = await getAttendanceRecords(activeSchoolId, classIdFromQuery, document.getElementById("attendanceDateInput").value, periodIdFromQuery);
    renderRoster(records);
    updateSummary(slot, classIdFromQuery);
  }
}, goLogin);