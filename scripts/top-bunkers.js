import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { listClasses } from "../services/class-service.js";
import { listSubjects } from "../services/subject-service.js";
import { listStudents } from "../services/student-service.js";
import { listBunkEvents, summarizeBunkEvents } from "../services/bunk-service.js";

let activeSchoolId = "";
let classMap = new Map();
let subjectMap = new Map();
let studentMap = new Map();
let currentRows = [];

function fillSelect(id, rows, getValue, getLabel, placeholder) {
  const select = document.getElementById(id);
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach(row => {
    const option = document.createElement("option");
    option.value = getValue(row);
    option.textContent = getLabel(row);
    select.appendChild(option);
  });
  if (current) select.value = current;
}

function renderRows(rows) {
  const tbody = document.querySelector("#bunkersTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "No bunk events found for the selected filters.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    [index + 1, row.studentName, row.classLabel, row.section || "—", row.subjectLabel, row.bunkCount, row.lastDate || "—", row.lastPeriod || "—"].forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function applyFilters() {
  const classId = document.getElementById("bunkerClassFilter").value;
  const section = document.getElementById("bunkerSectionFilter").value;
  const subjectId = document.getElementById("bunkerSubjectFilter").value;
  const rows = currentRows.filter(row => {
    if (classId && String(row.classId || "") !== String(classId)) return false;
    if (section && String(row.section || "") !== String(section)) return false;
    if (subjectId && String(row.subjectId || "") !== String(subjectId)) return false;
    return true;
  });
  renderRows(rows);
  return rows;
}

function exportCsv(rows) {
  const header = ['Rank','Student','Class','Section','Subject','BunkCount','LastDate','LastPeriod'];
  const body = rows.map((row, index) => [index + 1, row.studentName, row.classLabel, row.section || '', row.subjectLabel, row.bunkCount, row.lastDate || '', row.lastPeriod || '']);
  const csv = [header.join(',')].concat(body.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'top_bunkers.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function refresh() {
  const [classes, subjects, students, bunkEvents] = await Promise.all([
    listClasses(activeSchoolId),
    listSubjects(activeSchoolId),
    listStudents(activeSchoolId),
    listBunkEvents(activeSchoolId)
  ]);

  classMap = new Map(classes.map(item => [item.classId, item]));
  subjectMap = new Map(subjects.map(item => [item.subjectId, item]));
  studentMap = new Map(students.map(item => [item.studentId, item]));

  fillSelect('bunkerClassFilter', classes, item => item.classId, item => item.displayName || item.classId, '-- All classes --');
  fillSelect('bunkerSubjectFilter', subjects, item => item.subjectId, item => item.name || item.subjectId, '-- All subjects --');
  const sections = Array.from(new Set(students.map(item => item.section).filter(Boolean))).sort();
  fillSelect('bunkerSectionFilter', sections.map(section => ({ section })), item => item.section, item => item.section, '-- All sections --');

  currentRows = summarizeBunkEvents(bunkEvents, classMap, subjectMap, studentMap);
  applyFilters();
}

initAdminPage(async (profile) => {
  activeSchoolId = new URLSearchParams(window.location.search).get("schoolId") || profile.schoolId || "";
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });
  document.getElementById("bunkersRefreshBtn").addEventListener("click", refresh);
  document.getElementById("bunkerClassFilter").addEventListener("change", applyFilters);
  document.getElementById("bunkerSectionFilter").addEventListener("change", applyFilters);
  document.getElementById("bunkerSubjectFilter").addEventListener("change", applyFilters);
  document.getElementById("bunkersExportBtn").addEventListener("click", () => exportCsv(applyFilters()));

  await refresh();
});