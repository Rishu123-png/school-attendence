import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { listTeachers } from "../services/teacher-service.js";
import { listClasses } from "../services/class-service.js";
import { listSubjects } from "../services/subject-service.js";
import { listAssignments, createAssignment } from "../services/assignment-service.js";

let activeSchoolId = "";
let teacherMap = new Map();
let classMap = new Map();
let subjectMap = new Map();

function fillSelect(id, rows, getId, getLabel, placeholder) {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach(row => {
    const option = document.createElement("option");
    option.value = getId(row);
    option.textContent = getLabel(row);
    select.appendChild(option);
  });
}

function renderTable(rows) {
  const tbody = document.querySelector("#assignmentsTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No assignments found yet.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    [teacherMap.get(row.teacherId)?.name || row.teacherId, classMap.get(row.classId)?.displayName || row.classId, subjectMap.get(row.subjectId)?.name || row.subjectId, row.status || "active"].forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });
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
  teacherMap = new Map(teachers.map(item => [item.teacherId, item]));
  classMap = new Map(classes.map(item => [item.classId, item]));
  subjectMap = new Map(subjects.map(item => [item.subjectId, item]));
  fillSelect('assignTeacherSelect', teachers, i => i.teacherId, i => i.name || i.teacherId, '-- Select teacher --');
  fillSelect('assignClassSelect', classes, i => i.classId, i => i.displayName || i.classId, '-- Select class --');
  fillSelect('assignSubjectSelect', subjects, i => i.subjectId, i => i.name || i.subjectId, '-- Select subject --');
  renderTable(assignments);
}

initAdminPage(async (profile) => {
  activeSchoolId = new URLSearchParams(window.location.search).get("schoolId") || profile.schoolId || "";
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });

  document.getElementById("assignmentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      teacherId: document.getElementById("assignTeacherSelect").value,
      classId: document.getElementById("assignClassSelect").value,
      subjectId: document.getElementById("assignSubjectSelect").value
    };
    if (!payload.teacherId || !payload.classId || !payload.subjectId) {
      showToast("Teacher, class and subject are required", "warn");
      return;
    }
    await createAssignment(activeSchoolId, payload);
    showToast("Assignment created", "success");
    document.getElementById("assignmentForm").reset();
    await refresh();
  });

  await refresh();
});