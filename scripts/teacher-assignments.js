/* ============================================================
   TEACHER ASSIGNMENTS — UPGRADED
   Fixes: loader via admin-common, empty state, mobile data-labels,
          schoolId security, badge for status, error handling
   ============================================================ */

import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { listTeachers } from "../services/teacher-service.js";
import { listClasses } from "../services/class-service.js";
import { listSubjects } from "../services/subject-service.js";
import { listAssignments, createAssignment } from "../services/assignment-service.js";

let activeSchoolId = "";
let teacherMap = new Map();
let classMap   = new Map();
let subjectMap = new Map();

function fillSelect(id, rows, getId, getLabel, placeholder) {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = getId(row); opt.textContent = getLabel(row);
    select.appendChild(opt);
  });
}

function renderTable(rows) {
  const tbody = document.querySelector("#assignmentsTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4">
      <div class="empty-state">
        <div class="empty-icon">🔗</div>
        <p>No assignments yet.<br>Connect teachers to class-subject combinations above.</p>
      </div>
    </td></tr>`;
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const fields = [
      { label: "Teacher", value: teacherMap.get(row.teacherId)?.name || row.teacherId || "—" },
      { label: "Class",   value: classMap.get(row.classId)?.displayName || row.classId || "—" },
      { label: "Subject", value: subjectMap.get(row.subjectId)?.name || row.subjectId || "—" },
    ];
    fields.forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = value;
      tr.appendChild(td);
    });
    const statusTd = document.createElement("td");
    statusTd.setAttribute("data-label", "Status");
    const badge = document.createElement("span");
    badge.className = row.status === "active" || !row.status ? "badge badge-success" : "badge badge-warn";
    badge.textContent = row.status || "active";
    statusTd.appendChild(badge);
    tr.appendChild(statusTd);
    tbody.appendChild(tr);
  });
}

async function refresh() {
  const [teachers, classes, subjects, assignments] = await Promise.all([
    listTeachers(activeSchoolId),
    listClasses(activeSchoolId),
    listSubjects(activeSchoolId),
    listAssignments(activeSchoolId)
  ]);
  teacherMap = new Map(teachers.map(i => [i.teacherId, i]));
  classMap   = new Map(classes.map(i  => [i.classId,   i]));
  subjectMap = new Map(subjects.map(i => [i.subjectId, i]));
  fillSelect("assignTeacherSelect", teachers, i => i.teacherId, i => i.name || i.teacherId, "-- Select teacher --");
  fillSelect("assignClassSelect",   classes,  i => i.classId,   i => i.displayName || i.classId, "-- Select class --");
  fillSelect("assignSubjectSelect", subjects, i => i.subjectId, i => i.name || i.subjectId, "-- Select subject --");
  renderTable(assignments);
}

initAdminPage(async (profile, safeSchoolId) => {
  activeSchoolId = safeSchoolId;
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });

  document.getElementById("assignmentForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      teacherId: document.getElementById("assignTeacherSelect").value,
      classId:   document.getElementById("assignClassSelect").value,
      subjectId: document.getElementById("assignSubjectSelect").value
    };
    if (!payload.teacherId) { showToast("Select a teacher", "warn");  return; }
    if (!payload.classId)   { showToast("Select a class", "warn");    return; }
    if (!payload.subjectId) { showToast("Select a subject", "warn");  return; }

    const btn = document.getElementById("assignmentSubmitBtn");
    btn.disabled = true;
    try {
      await createAssignment(activeSchoolId, payload);
      showToast("Assignment created", "success");
      document.getElementById("assignmentForm").reset();
      await refresh();
    } catch (err) {
      showToast(err.message || "Failed to create assignment", "error");
    } finally {
      btn.disabled = false;
    }
  });

  await refresh();
});
