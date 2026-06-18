/* ============================================================
   STUDENTS MANAGE — UPGRADED
   Fixes: schoolId from profile, empty states, mobile data-labels,
          delete confirmation, loader, error handling
   ============================================================ */

import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast, confirmAction } from "./app-shell.js";
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
    const opt = document.createElement("option");
    opt.value = row.classId;
    opt.textContent = row.displayName || row.classId;
    select.appendChild(opt);
  });
  if (current) select.value = current;
}

function fillSubjects(rows) {
  const select = document.getElementById("studentSubjectsSelect");
  select.innerHTML = "";
  rows.forEach(row => {
    const opt = document.createElement("option");
    opt.value = row.subjectId;
    opt.textContent = `${row.name || row.subjectId}${row.code ? ` (${row.code})` : ""}`;
    select.appendChild(opt);
  });
}

function setSelectedSubjectIds(ids = []) {
  const set = new Set(ids);
  Array.from(document.getElementById("studentSubjectsSelect").options)
    .forEach(opt => { opt.selected = set.has(opt.value); });
}

function getSelectedSubjectIds() {
  return Array.from(document.getElementById("studentSubjectsSelect").selectedOptions).map(opt => opt.value);
}

function resetForm() {
  editingStudentId = "";
  document.getElementById("studentForm")?.reset();
  const btn = document.getElementById("studentSubmitBtn");
  if (btn) btn.textContent = "💾 Save Student";
  setSelectedSubjectIds([]);
  document.getElementById("studentCancelBtn").style.display = "none";
}

function startEdit(row) {
  editingStudentId = row.studentId;
  document.getElementById("studentNameInput").value      = row.fullName    || "";
  document.getElementById("studentClassSelect").value    = row.classId     || "";
  document.getElementById("studentSectionInput").value   = row.section     || "";
  document.getElementById("studentStreamInput").value    = row.stream      || "";
  document.getElementById("studentRollInput").value      = row.rollNo      || "";
  document.getElementById("studentAdmissionInput").value = row.admissionNo || "";
  setSelectedSubjectIds(row.selectedSubjectIds || []);
  document.getElementById("studentSubmitBtn").textContent = "✏️ Update Student";
  document.getElementById("studentCancelBtn").style.display = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTable(rows) {
  const tbody = document.querySelector("#studentsTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="empty-icon">🎓</div>
        <p>No students added yet.<br>Use the form above to add the first student.</p>
      </div>
    </td></tr>`;
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    const classLabel = classMap.get(row.classId)?.displayName || row.classId || "—";
    const subjects = Array.isArray(row.selectedSubjectIds) && row.selectedSubjectIds.length
      ? row.selectedSubjectIds.join(", ")
      : "—";
    const fields = [
      { label: "Name",      value: row.fullName     || "—" },
      { label: "Class",     value: classLabel },
      { label: "Section",   value: row.section      || "—" },
      { label: "Stream",    value: row.stream       || "—" },
      { label: "Roll No",   value: row.rollNo       || "—" },
      { label: "Adm. No",  value: row.admissionNo  || "—" },
      { label: "Subjects",  value: subjects },
    ];
    fields.forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = String(value);
      tr.appendChild(td);
    });
    const actionTd = document.createElement("td");
    actionTd.setAttribute("data-label", "Actions");
    const editBtn = document.createElement("button");
    editBtn.className = "btn-ghost"; editBtn.textContent = "✏️ Edit";
    editBtn.onclick = () => startEdit(row);
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-danger"; deleteBtn.textContent = "🗑️ Delete";
    deleteBtn.onclick = async () => {
      const ok = await confirmAction(`Delete student "${row.fullName}"? This cannot be undone.`);
      if (!ok) return;
      await deleteStudent(activeSchoolId, row.studentId);
      showToast("Student deleted", "success");
      await refresh();
    };
    actionTd.append(editBtn, " ", deleteBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function refresh() {
  const students = await listStudents(activeSchoolId);
  renderTable(students.sort((a,b) => String(a.fullName||"").localeCompare(String(b.fullName||""))));
}

initAdminPage(async (profile, safeSchoolId) => {
  activeSchoolId = safeSchoolId;
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });
  document.getElementById("studentCancelBtn")?.addEventListener("click", resetForm);
  document.getElementById("studentCancelBtn").style.display = "none";

  const [classes, subjects] = await Promise.all([
    listClasses(activeSchoolId),
    listSubjects(activeSchoolId)
  ]);
  fillClassSelect(classes.sort((a,b) => String(a.displayName||"").localeCompare(String(b.displayName||""))));
  fillSubjects(subjects.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""))));

  document.getElementById("studentForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      fullName:          document.getElementById("studentNameInput").value.trim(),
      classId:           document.getElementById("studentClassSelect").value,
      section:           document.getElementById("studentSectionInput").value.trim(),
      stream:            document.getElementById("studentStreamInput").value.trim(),
      rollNo:            document.getElementById("studentRollInput").value.trim(),
      admissionNo:       document.getElementById("studentAdmissionInput").value.trim(),
      selectedSubjectIds: getSelectedSubjectIds()
    };
    if (!payload.fullName) { showToast("Student name is required", "warn"); return; }
    if (!payload.classId)  { showToast("Please select a class", "warn"); return; }
    if (!payload.selectedSubjectIds.length) { showToast("Select at least one subject", "warn"); return; }

    const btn = document.getElementById("studentSubmitBtn");
    btn.disabled = true;
    try {
      if (editingStudentId) {
        await updateStudent(activeSchoolId, editingStudentId, payload);
        showToast("Student updated", "success");
      } else {
        await createStudent(activeSchoolId, payload);
        showToast("Student added", "success");
      }
      resetForm();
      await refresh();
    } catch (err) {
      showToast(err.message || "Failed to save student", "error");
    } finally {
      btn.disabled = false;
    }
  });

  await refresh();
});
