import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { listTeachers, createTeacher, updateTeacher, deleteTeacher } from "../services/teacher-service.js";

let activeSchoolId = "";
let editingTeacherId = "";
let teachersCache = [];

function resetForm() {
  editingTeacherId = "";
  document.getElementById("teacherForm")?.reset();
  document.getElementById("teacherSubmitBtn").textContent = "Save Teacher";
}

function startEdit(row) {
  editingTeacherId = row.teacherId;
  document.getElementById("teacherNameInput").value = row.name || "";
  document.getElementById("teacherEmailInput").value = row.email || "";
  document.getElementById("teacherAuthUidInput").value = row.authUid || "";
  document.getElementById("teacherSubjectInput").value = row.subject || "";
  document.getElementById("teacherStatusInput").value = row.status || "active";
  document.getElementById("teacherSubmitBtn").textContent = "Update Teacher";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTable(rows) {
  const tbody = document.querySelector("#teachersTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "No teachers found yet.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    [row.name, row.email, row.subject, row.authUid || "—", row.status].forEach(value => {
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
      await deleteTeacher(activeSchoolId, row.teacherId);
      showToast("Teacher deleted", "success");
      await refresh();
    };
    actionTd.append(editBtn, deleteBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function refresh() {
  teachersCache = (await listTeachers(activeSchoolId)).sort((a,b) => String(a.name||"").localeCompare(String(b.name||"")));
  renderTable(teachersCache);
}

initAdminPage(async (profile) => {
  activeSchoolId = new URLSearchParams(window.location.search).get("schoolId") || profile.schoolId || "";
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });
  document.getElementById("teacherCancelBtn").addEventListener("click", resetForm);

  document.getElementById("teacherForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("teacherNameInput").value,
      email: document.getElementById("teacherEmailInput").value,
      authUid: document.getElementById("teacherAuthUidInput").value,
      subject: document.getElementById("teacherSubjectInput").value,
      status: document.getElementById("teacherStatusInput").value
    };
    if (!payload.name || !payload.email) {
      showToast("Teacher name and email are required", "warn");
      return;
    }
    if (editingTeacherId) {
      await updateTeacher(activeSchoolId, editingTeacherId, payload);
      showToast("Teacher updated", "success");
    } else {
      await createTeacher(activeSchoolId, payload);
      showToast("Teacher created", "success");
    }
    resetForm();
    await refresh();
  });

  await refresh();
});