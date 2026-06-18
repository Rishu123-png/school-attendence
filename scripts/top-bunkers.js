/* ============================================================
   TOP BUNKERS — UPGRADED
   Fixes: loader, schoolId security, bottom nav, breadcrumb,
          stats cards, mobile data-labels, empty state, error handling
   ============================================================ */

import { initTheme, showToast, showLoader, hideLoader, initOfflineBanner, markActiveNav } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { listClasses } from "../services/class-service.js";
import { listSubjects } from "../services/subject-service.js";
import { listStudents } from "../services/student-service.js";
import { listBunkEvents, summarizeBunkEvents } from "../services/bunk-service.js";
import { listTeachers } from "../services/teacher-service.js";

let activeSchoolId = "";
let currentProfile = null;
let currentTeacher = null;
let classMap = new Map();
let subjectMap = new Map();
let studentMap = new Map();
let currentRows = [];

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

function fillSelect(id, rows, getValue, getLabel, placeholder) {
  const select = document.getElementById(id);
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = getValue(row);
    opt.textContent = getLabel(row);
    select.appendChild(opt);
  });
  if (current) select.value = current;
}

function updateStats(rows) {
  const total   = rows.reduce((acc, r) => acc + r.bunkCount, 0);
  const unique  = new Set(rows.map(r => r.studentId)).size;
  const topCount = rows.length ? rows[0].bunkCount : 0;
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText("statTotalBunks",    total);
  setText("statUniqueStudents", unique);
  setText("statTopBunker",     topCount || "—");
}

function renderRows(rows) {
  const tbody = document.querySelector("#bunkersTable tbody");
  tbody.innerHTML = "";

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="empty-icon">🎉</div>
        <p>No bunk events found for the selected filters.<br>Either no absences are recorded yet or all students are present!</p>
      </div>
    </td></tr>`;
    updateStats([]);
    return;
  }

  updateStats(rows);

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    /* Color code high bunkers */
    if (row.bunkCount >= 5) tr.style.borderLeft = "3px solid var(--danger)";
    else if (row.bunkCount >= 3) tr.style.borderLeft = "3px solid var(--warn)";

    const fields = [
      { label: "#",          value: index + 1 },
      { label: "Student",    value: row.studentName },
      { label: "Class",      value: row.classLabel },
      { label: "Section",    value: row.section || "—" },
      { label: "Subject",    value: row.subjectLabel },
      { label: "Bunk Count", value: row.bunkCount },
      { label: "Last Date",  value: row.lastDate  || "—" },
      { label: "Last Period",value: row.lastPeriod || "—" },
    ];
    fields.forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      if (label === "Bunk Count") {
        const badge = document.createElement("span");
        badge.className = row.bunkCount >= 5 ? "badge badge-danger" : row.bunkCount >= 3 ? "badge badge-warn" : "badge badge-info";
        badge.textContent = value;
        td.appendChild(badge);
      } else {
        td.textContent = String(value || "—");
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function applyFilters() {
  const classId   = document.getElementById("bunkerClassFilter")?.value;
  const section   = document.getElementById("bunkerSectionFilter")?.value;
  const subjectId = document.getElementById("bunkerSubjectFilter")?.value;

  let rows = currentRows.filter(row => {
    if (classId   && String(row.classId   || "") !== String(classId))   return false;
    if (section   && String(row.section   || "") !== String(section))   return false;
    if (subjectId && String(row.subjectId || "") !== String(subjectId)) return false;
    return true;
  });

  if (isTeacher(currentProfile) && currentTeacher) {
    rows = rows.filter(row => String(row.teacherName || "") === String(currentTeacher.name || ""));
  }

  renderRows(rows);
  return rows;
}

function exportCsv(rows) {
  const header = ["Rank","Student","Class","Section","Subject","BunkCount","LastDate","LastPeriod"];
  const body = rows.map((row, i) => [
    i+1, row.studentName, row.classLabel, row.section||"",
    row.subjectLabel, row.bunkCount, row.lastDate||"", row.lastPeriod||""
  ]);
  const csv = [header.join(",")]
    .concat(body.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "top_bunkers.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function refresh() {
  const [classes, subjects, students, bunkEvents, teachers] = await Promise.all([
    listClasses(activeSchoolId),
    listSubjects(activeSchoolId),
    listStudents(activeSchoolId),
    listBunkEvents(activeSchoolId),
    listTeachers(activeSchoolId)
  ]);

  classMap   = new Map(classes.map(item  => [item.classId,   item]));
  subjectMap = new Map(subjects.map(item => [item.subjectId, item]));
  studentMap = new Map(students.map(item => [item.studentId, item]));

  if (isTeacher(currentProfile)) {
    currentTeacher = teachers.find(row => String(row.authUid || "") === String(currentProfile.teacherId || ""))
      || teachers.find(row => String(row.authUid || "") === String(currentProfile.uid || ""))
      || currentTeacher;
  }

  fillSelect("bunkerClassFilter",   classes,  i => i.classId,   i => i.displayName || i.classId,   "-- All classes --");
  fillSelect("bunkerSubjectFilter", subjects, i => i.subjectId, i => i.name || i.subjectId,         "-- All subjects --");
  const sections = Array.from(new Set(students.map(i => i.section).filter(Boolean))).sort();
  fillSelect("bunkerSectionFilter", sections.map(s => ({ section: s })), i => i.section, i => i.section, "-- All sections --");

  currentRows = summarizeBunkEvents(bunkEvents, classMap, subjectMap, studentMap);
  applyFilters();
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => { await logoutCurrentUser(); goLogin(); });
document.getElementById("backBtn")?.addEventListener("click", goBack);
document.getElementById("bunkersRefreshBtn")?.addEventListener("click", refresh);
document.getElementById("bunkerClassFilter")?.addEventListener("change", applyFilters);
document.getElementById("bunkerSectionFilter")?.addEventListener("change", applyFilters);
document.getElementById("bunkerSubjectFilter")?.addEventListener("change", applyFilters);
document.getElementById("bunkersExportBtn")?.addEventListener("click", () => exportCsv(applyFilters()));

requireAuth(async (user) => {
  try {
    currentProfile = await getUserProfile(user.uid);
    if (!isTeacher(currentProfile) && !isSchoolAdmin(currentProfile)) {
      showToast("Teacher or admin access only", "warn");
      setTimeout(goLogin, 700);
      return;
    }

    activeSchoolId = getSchoolIdFromProfile(currentProfile);
    if (!activeSchoolId) {
      showToast("No school linked to this account.", "warn");
      return;
    }

    const s = encodeURIComponent(activeSchoolId);
    document.getElementById("schoolMeta").textContent = `School: ${activeSchoolId}`;
    document.getElementById("nav-home")?.setAttribute("href",       `./teacher-home.html?schoolId=${s}`);
    document.getElementById("nav-schedule")?.setAttribute("href",   `./teacher-schedule.html?schoolId=${s}`);
    document.getElementById("nav-attendance")?.setAttribute("href", `./period-attendance.html?schoolId=${s}`);
    document.getElementById("nav-marks")?.setAttribute("href",      `./marks.html?schoolId=${s}`);
    document.querySelector("#breadcrumb a")?.setAttribute("href",
      isSchoolAdmin(currentProfile)
        ? `./school-admin.html?schoolId=${s}`
        : `./teacher-home.html?schoolId=${s}`
    );
    markActiveNav();

    await refresh();
  } catch (err) {
    console.error(err);
    showToast("Failed to load bunkers: " + (err.message || ""), "error");
  } finally {
    hideLoader();
  }
}, goLogin);
