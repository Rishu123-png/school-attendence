/* ============================================================
   PERIOD ATTENDANCE — UPGRADED
   Fixes: loader, color-coded rows, live stats counter,
          mark-all buttons, mobile data-labels, schoolId security,
          offline check before save, empty state
   ============================================================ */

import { initTheme, showToast, showLoader, hideLoader, initOfflineBanner, markActiveNav } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { listClasses } from "../services/class-service.js";
import { listTimetableForDay } from "../services/timetable-service.js";
import { listStudentsForAttendanceScope, getAttendanceRecords, savePeriodAttendance } from "../services/attendance-service.js";
import { listTeachers } from "../services/teacher-service.js";

let activeSchoolId = "";
let classMap = new Map();
let slots = [];
let visibleStudents = [];
let currentProfile = null;

const DAY_LABELS = {
  monday:"Monday", tuesday:"Tuesday", wednesday:"Wednesday",
  thursday:"Thursday", friday:"Friday", saturday:"Saturday", sunday:"Sunday"
};

const STATUS_COLORS = {
  present: "present", absent: "absent", late: "late",
  leave: "leave", medical: "medical", halfDay: "halfDay"
};

initTheme();
initOfflineBanner();
showLoader();

function goLogin() { window.location.href = "./index.html"; }
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
  const keys = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const key = keys[d.getDay()] || "";
  document.getElementById("attendanceDayInput").value = DAY_LABELS[key] || "";
  return { key, label: DAY_LABELS[key] || "" };
}

function fillClassSelect(rows) {
  const select = document.getElementById("attendanceClassSelect");
  const current = select.value;
  select.innerHTML = '<option value="">-- Select class --</option>';
  classMap = new Map();
  rows.forEach(row => {
    classMap.set(row.classId, row);
    const opt = document.createElement("option");
    opt.value = row.classId;
    opt.textContent = row.displayName || row.classId;
    select.appendChild(opt);
  });
  if (current) select.value = current;
}

function fillPeriodSelect(rows) {
  const select = document.getElementById("attendancePeriodSelect");
  const current = select.value;
  select.innerHTML = '<option value="">-- Select period --</option>';
  slots = rows;
  rows.forEach(row => {
    const opt = document.createElement("option");
    const t = [row.startTime, row.endTime].filter(Boolean).join(" - ");
    opt.value = row.periodId;
    opt.textContent = `${row.label || `Period ${row.periodNo || ""}`} · ${row.subjectName || row.subjectId || "Subject"}${t ? ` · ${t}` : ""}`;
    select.appendChild(opt);
  });
  if (current && rows.some(r => r.periodId === current)) select.value = current;
}

function updateSummary(slot, classId) {
  const card = document.getElementById("attendanceSummaryCard");
  if (!card || !slot || !classId) { if (card) card.style.display = "none"; return; }
  document.getElementById("summaryClass").textContent   = `Class: ${classMap.get(classId)?.displayName || classId}`;
  document.getElementById("summaryType").textContent    = `Type: ${slot.slotType === "subject" ? "Subject" : "Class"}`;
  document.getElementById("summarySubject").textContent = `Subject: ${slot.subjectName || slot.subjectId || "—"}`;
  document.getElementById("summaryTeacher").textContent = `Teacher: ${slot.teacherName || slot.teacherId || "—"}`;
  document.getElementById("summaryTime").textContent    = `Time: ${[slot.startTime, slot.endTime].filter(Boolean).join(" - ") || "—"}`;
  card.style.display = "";
}

function updateStats() {
  const selects = document.querySelectorAll('#attendanceTable tbody select[data-student-id]');
  const stats = { present: 0, absent: 0, late: 0, other: 0 };
  selects.forEach(s => {
    const v = s.value;
    if (v === "present") stats.present++;
    else if (v === "absent") stats.absent++;
    else if (v === "late") stats.late++;
    else stats.other++;
  });
  document.getElementById("statPresent").textContent = stats.present;
  document.getElementById("statAbsent").textContent  = stats.absent;
  document.getElementById("statLate").textContent    = stats.late;
  document.getElementById("statOther").textContent   = stats.other;

  /* Color-code rows */
  selects.forEach(s => {
    const tr = s.closest("tr");
    if (!tr) return;
    tr.className = "status-" + (STATUS_COLORS[s.value] || "");
    s.className = "att-select att-" + (STATUS_COLORS[s.value] || "");
  });
}

function renderRoster(records = {}) {
  const tbody = document.querySelector("#attendanceTable tbody");
  const statsGrid = document.getElementById("attStatsGrid");
  tbody.innerHTML = "";

  if (!visibleStudents.length) {
    statsGrid && (statsGrid.style.display = "none");
    tbody.innerHTML = `<tr><td colspan="4">
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <p>No students found for this slot.<br>Check class enrollment and subject assignment.</p>
      </div>
    </td></tr>`;
    return;
  }

  statsGrid && (statsGrid.style.display = "");
  const statuses = [
    ["present","Present"],["absent","Absent"],["late","Late"],
    ["leave","Leave"],["medical","Medical"],["halfDay","Half Day"]
  ];

  visibleStudents.forEach(student => {
    const tr = document.createElement("tr");
    const currentStatus = records[student.studentId]?.status || "present";
    tr.className = "status-" + (STATUS_COLORS[currentStatus] || "present");

    const fields = [
      { label: "Student", value: student.fullName || "—" },
      { label: "Class",   value: classMap.get(student.classId)?.displayName || student.classId || "—" },
      { label: "Roll No", value: student.rollNo || "—" },
    ];
    fields.forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });

    const statusTd = document.createElement("td");
    statusTd.setAttribute("data-label", "Status");
    const select = document.createElement("select");
    select.className = `att-select att-${currentStatus}`;
    select.dataset.studentId   = student.studentId;
    select.dataset.studentName = student.fullName || "";
    statuses.forEach(([value, label]) => {
      const opt = document.createElement("option");
      opt.value = value; opt.textContent = label;
      select.appendChild(opt);
    });
    select.value = currentStatus;
    select.addEventListener("change", () => {
      tr.className = "status-" + (STATUS_COLORS[select.value] || "");
      select.className = "att-select att-" + (STATUS_COLORS[select.value] || "");
      updateStats();
    });
    statusTd.appendChild(select);
    tr.appendChild(statusTd);
    tbody.appendChild(tr);
  });
  updateStats();
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
  if (!navigator.onLine) {
    showToast("You are offline. Cannot save attendance.", "error");
    return;
  }

  const classId  = document.getElementById("attendanceClassSelect").value;
  const dateStr  = document.getElementById("attendanceDateInput").value;
  const periodId = document.getElementById("attendancePeriodSelect").value;
  const slot     = slots.find(item => item.periodId === periodId) || null;

  if (!classId || !dateStr || !periodId || !slot) {
    showToast("Select class, date and period first", "warn");
    return;
  }

  const rows = Array.from(document.querySelectorAll('#attendanceTable tbody select[data-student-id]')).map(sel => ({
    studentId:   sel.dataset.studentId,
    studentName: sel.dataset.studentName,
    status:      sel.value
  }));
  if (!rows.length) {
    showToast("No students found for this slot", "warn");
    return;
  }

  const saveBtn = document.getElementById("attendanceSaveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    const teacherName = currentProfile?.displayName || slot.teacherName || "Teacher";
    await savePeriodAttendance(activeSchoolId, {
      classId, date: dateStr, periodId,
      slotType:    slot.slotType    || "class",
      subjectId:   slot.subjectId   || "",
      subjectName: slot.subjectName || "",
      teacherId:   slot.teacherId   || currentProfile?.teacherId || "",
      teacherName,
      rows
    });
    showToast("✅ Attendance saved successfully!", "success");
  } catch (err) {
    console.error(err);
    showToast("Failed to save: " + (err.message || "Unknown error"), "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 Save Attendance";
  }
}

/* Mark all buttons */
document.getElementById("markAllPresentBtn")?.addEventListener("click", () => {
  document.querySelectorAll('#attendanceTable tbody select[data-student-id]').forEach(s => {
    s.value = "present";
    s.dispatchEvent(new Event("change"));
  });
});
document.getElementById("markAllAbsentBtn")?.addEventListener("click", () => {
  document.querySelectorAll('#attendanceTable tbody select[data-student-id]').forEach(s => {
    s.value = "absent";
    s.dispatchEvent(new Event("change"));
  });
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => { await logoutCurrentUser(); goLogin(); });
document.getElementById("backBtn")?.addEventListener("click", goBack);
document.getElementById("attendanceLoadBtn")?.addEventListener("click", () => loadRoster({ preloadAttendance: true }));
document.getElementById("attendanceSaveBtn")?.addEventListener("click", saveRoster);
document.getElementById("attendanceClassSelect")?.addEventListener("change", () => loadRoster({ preloadAttendance: false }));
document.getElementById("attendanceDateInput")?.addEventListener("change", () => loadRoster({ preloadAttendance: false }));
document.getElementById("attendancePeriodSelect")?.addEventListener("change", () => loadRoster({ preloadAttendance: true }));

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
      hideLoader();
      return;
    }

    document.getElementById("teacherMeta").textContent = `School: ${activeSchoolId}`;

    // Set nav links
    const s = encodeURIComponent(activeSchoolId);
    document.getElementById("nav-home")?.setAttribute("href",       `./teacher-home.html?schoolId=${s}`);
    document.getElementById("nav-schedule")?.setAttribute("href",   `./teacher-schedule.html?schoolId=${s}`);
    document.getElementById("nav-bunkers")?.setAttribute("href",    `./top-bunkers.html?schoolId=${s}`);
    document.getElementById("nav-marks")?.setAttribute("href",      `./marks.html?schoolId=${s}`);
    markActiveNav();

    // Set breadcrumb back link
    document.querySelector("#breadcrumb a")?.setAttribute("href", `./teacher-home.html?schoolId=${s}`);

    const today = new Date();
    document.getElementById("attendanceDateInput").value =
      `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    setDayLabel();

    // Pre-fill from URL params if coming from teacher-home
    const params = new URLSearchParams(window.location.search);
    const urlClassId  = params.get("classId")  || "";
    const urlPeriodId = params.get("periodId") || "";
    const urlDate     = params.get("date")      || "";

    const classes = await listClasses(activeSchoolId);
    fillClassSelect(classes.sort((a,b) => String(a.displayName||"").localeCompare(String(b.displayName||""))));

    if (urlDate) {
      document.getElementById("attendanceDateInput").value = urlDate;
      setDayLabel();
    }
    if (urlClassId) {
      document.getElementById("attendanceClassSelect").value = urlClassId;
      await loadRoster({ preloadAttendance: false });
      if (urlPeriodId) {
        document.getElementById("attendancePeriodSelect").value = urlPeriodId;
        await loadRoster({ preloadAttendance: true });
      }
    }
  } catch (err) {
    console.error(err);
    showToast("Failed to load attendance page: " + (err.message || "Unknown error"), "error");
  } finally {
    hideLoader();
  }
}, goLogin);
