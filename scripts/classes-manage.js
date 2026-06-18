import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { listClasses, createClass, updateClass, deleteClass } from "../services/class-service.js";
import { listTeachers } from "../services/teacher-service.js";

let activeSchoolId = "";
let editingClassId = "";
let teacherMap = new Map();

function fillTeachers(rows) {
  const select = document.getElementById("classTeacherSelect");
  const current = select.value;
  select.innerHTML = '<option value="">-- Optional class teacher --</option>';
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

function resetForm() {
  editingClassId = "";
  document.getElementById("classForm")?.reset();
  document.getElementById("classSubmitBtn").textContent = "Save Class";
}

function startEdit(row) {
  editingClassId = row.classId;
  document.getElementById("classNameInput").value = row.name || "";
  document.getElementById("classSectionInput").value = row.section || "";
  document.getElementById("classStreamInput").value = row.stream || "";
  document.getElementById("classRoomInput").value = row.roomNo || "";
  document.getElementById("classTeacherSelect").value = row.classTeacherId || "";
  document.getElementById("classSubmitBtn").textContent = "Update Class";
}

function renderTable(rows) {
  const tbody = document.querySelector("#classesTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "No classes found yet.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const teacher = teacherMap.get(row.classTeacherId)?.name || "—";
    [row.displayName || row.classId, row.name || "—", row.section || "—", row.stream || "—", teacher].forEach(value => {
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
      await deleteClass(activeSchoolId, row.classId);
      showToast("Class deleted", "success");
      await refresh();
    };
    actionTd.append(editBtn, deleteBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function refresh() {
  const [teachers, classes] = await Promise.all([listTeachers(activeSchoolId), listClasses(activeSchoolId)]);
  fillTeachers(teachers.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""))));
  renderTable(classes.sort((a,b) => String(a.displayName||"").localeCompare(String(b.displayName||""))));
}

initAdminPage(async (profile) => {
  activeSchoolId = new URLSearchParams(window.location.search).get("schoolId") || profile.schoolId || "";
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });
  document.getElementById("classCancelBtn").addEventListener("click", resetForm);

  document.getElementById("classForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("classNameInput").value,
      section: document.getElementById("classSectionInput").value,
      stream: document.getElementById("classStreamInput").value,
      roomNo: document.getElementById("classRoomInput").value,
      classTeacherId: document.getElementById("classTeacherSelect").value
    };
    if (!payload.name || !payload.section) {
      showToast("Class name and section are required", "warn");
      return;
    }
    if (editingClassId) {
      await updateClass(activeSchoolId, editingClassId, payload);
      showToast("Class updated", "success");
    } else {
      await createClass(activeSchoolId, payload);
      showToast("Class created", "success");
    }
    resetForm();
    await refresh();
  });

  await refresh();
});