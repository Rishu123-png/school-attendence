import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { listClasses } from "../services/class-service.js";
import { listSubjects } from "../services/subject-service.js";
import { listStudents, createStudent, updateStudent, deleteStudent } from "../services/student-service.js";

let activeSchoolId = "";
let editingStudentId = "";
let classMap = new Map();

function fillClassSelect(rows) {
  const select = document.getElementById("studentClassSelect");
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

function fillSubjects(rows) {
  const select = document.getElementById("studentSubjectsSelect");
  select.innerHTML = "";
  rows.forEach(row => {
    const option = document.createElement("option");
    option.value = row.subjectId;
    option.textContent = `${row.name || row.subjectId}${row.code ? ` (${row.code})` : ""}`;
    select.appendChild(option);
  });
}

function setSelectedSubjectIds(ids = []) {
  const set = new Set(ids);
  const select = document.getElementById("studentSubjectsSelect");
  Array.from(select.options).forEach(option => {
    option.selected = set.has(option.value);
  });
}

function getSelectedSubjectIds() {
  return Array.from(document.getElementById("studentSubjectsSelect").selectedOptions).map(option => option.value);
}

function resetForm() {
  editingStudentId = "";
  document.getElementById("studentForm")?.reset();
  document.getElementById("studentSubmitBtn").textContent = "Save Student";
  setSelectedSubjectIds([]);
}

function startEdit(row) {
  editingStudentId = row.studentId;
  document.getElementById("studentNameInput").value = row.fullName || "";
  document.getElementById("studentClassSelect").value = row.classId || "";
  document.getElementById("studentSectionInput").value = row.section || "";
  document.getElementById("studentStreamInput").value = row.stream || "";
  document.getElementById("studentRollInput").value = row.rollNo || "";
  document.getElementById("studentAdmissionInput").value = row.admissionNo || "";
  setSelectedSubjectIds(row.selectedSubjectIds || []);
  document.getElementById("studentSubmitBtn").textContent = "Update Student";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTable(rows) {
  const tbody = document.querySelector("#studentsTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = "No students found yet.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    const classLabel = classMap.get(row.classId)?.displayName || row.classId || "—";
    const subjects = Array.isArray(row.selectedSubjectIds) ? row.selectedSubjectIds.join(", ") : "—";
    [row.fullName, classLabel, row.section || "—", row.stream || "—", row.rollNo || "—", row.admissionNo || "—", subjects].forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });
    const actionTd = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "btn-ghost";
    editBtn.textContent = "Edit";
    editBtn.onclick = () => startEdit(row);
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-ghost";
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = async () => {
      await deleteStudent(activeSchoolId, row.studentId);
      showToast("Student deleted", "success");
      await refresh();
    };
    actionTd.append(editBtn, deleteBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function refresh() {
  const students = await listStudents(activeSchoolId);
  renderTable(students.sort((a,b) => String(a.fullName||"").localeCompare(String(b.fullName||""))));
}

initAdminPage(async (profile) => {
  activeSchoolId = new URLSearchParams(window.location.search).get("schoolId") || profile.schoolId || "";
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });
  document.getElementById("studentCancelBtn").addEventListener("click", resetForm);

  const [classes, subjects] = await Promise.all([
    listClasses(activeSchoolId),
    listSubjects(activeSchoolId)
  ]);
  fillClassSelect(classes.sort((a,b) => String(a.displayName||"").localeCompare(String(b.displayName||""))));
  fillSubjects(subjects.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""))));

  document.getElementById("studentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      fullName: document.getElementById("studentNameInput").value,
      classId: document.getElementById("studentClassSelect").value,
      section: document.getElementById("studentSectionInput").value,
      stream: document.getElementById("studentStreamInput").value,
      rollNo: document.getElementById("studentRollInput").value,
      admissionNo: document.getElementById("studentAdmissionInput").value,
      selectedSubjectIds: getSelectedSubjectIds()
    };
    if (!payload.fullName || !payload.classId) {
      showToast("Student name and class are required", "warn");
      return;
    }
    if (!payload.selectedSubjectIds.length) {
      showToast("Select at least one subject", "warn");
      return;
    }
    if (editingStudentId) {
      await updateStudent(activeSchoolId, editingStudentId, payload);
      showToast("Student updated", "success");
    } else {
      await createStudent(activeSchoolId, payload);
      showToast("Student created", "success");
    }
    resetForm();
    await refresh();
  });

  await refresh();
});