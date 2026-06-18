/* ============================================================
   TEACHERS MANAGE — UPGRADED
   Fixes: delete confirmation, empty state, mobile data-labels,
          badge for status, error handling
   ============================================================ */

import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast, confirmAction } from "./app-shell.js";
import { listTeachers, createTeacher, updateTeacher, deleteTeacher } from "../services/teacher-service.js";

let activeSchoolId = "";
let editingTeacherId = "";

function resetForm() {
  editingTeacherId = "";
  document.getElementById("teacherForm")?.reset();
  const btn = document.getElementById("teacherSubmitBtn");
  if (btn) btn.textContent = "💾 Save Teacher";
  document.getElementById("teacherCancelBtn").style.display = "none";
}

function startEdit(row) {
  editingTeacherId = row.teacherId;
  document.getElementById("teacherNameInput").value    = row.name    || "";
  document.getElementById("teacherEmailInput").value   = row.email   || "";
  document.getElementById("teacherAuthUidInput").value = row.authUid || "";
  document.getElementById("teacherSubjectInput").value = row.subject || "";
  document.getElementById("teacherStatusInput").value  = row.status  || "active";
  document.getElementById("teacherSubmitBtn").textContent = "✏️ Update Teacher";
  document.getElementById("teacherCancelBtn").style.display = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function statusBadge(status) {
  const cls = status === "active" ? "badge-success" : "badge-danger";
  return `<span class="badge ${cls}">${status || "—"}</span>`;
}

function renderTable(rows) {
  const tbody = document.querySelector("#teachersTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <div class="empty-icon">👨‍🏫</div>
        <p>No teachers added yet.<br>Use the form above to add a teacher.</p>
      </div>
    </td></tr>`;
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const fields = [
      { label: "Name",    value: row.name    || "—" },
      { label: "Email",   value: row.email   || "—" },
      { label: "Subject", value: row.subject || "—" },
      { label: "Auth UID",value: row.authUid || "— (not linked)" },
    ];
    fields.forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = value;
      tr.appendChild(td);
    });
    const statusTd = document.createElement("td");
    statusTd.setAttribute("data-label", "Status");
    statusTd.innerHTML = statusBadge(row.status);
    tr.appendChild(statusTd);

    const actionTd = document.createElement("td");
    actionTd.setAttribute("data-label", "Actions");
    const editBtn = document.createElement("button");
    editBtn.className = "btn-ghost"; editBtn.textContent = "✏️ Edit";
    editBtn.onclick = () => startEdit(row);
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-danger"; deleteBtn.textContent = "🗑️ Delete";
    deleteBtn.onclick = async () => {
      const ok = await confirmAction(`Delete teacher "${row.name}"? This cannot be undone.`);
      if (!ok) return;
      await deleteTeacher(activeSchoolId, row.teacherId);
      showToast("Teacher deleted", "success");
      await refresh();
    };
    actionTd.append(editBtn, " ", deleteBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function refresh() {
  const teachers = await listTeachers(activeSchoolId);
  renderTable(teachers.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""))));
}

initAdminPage(async (profile, safeSchoolId) => {
  activeSchoolId = safeSchoolId;
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });
  document.getElementById("teacherCancelBtn")?.addEventListener("click", resetForm);
  document.getElementById("teacherCancelBtn").style.display = "none";

  document.getElementById("teacherForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name:    document.getElementById("teacherNameInput").value.trim(),
      email:   document.getElementById("teacherEmailInput").value.trim(),
      authUid: document.getElementById("teacherAuthUidInput").value.trim(),
      subject: document.getElementById("teacherSubjectInput").value.trim(),
      status:  document.getElementById("teacherStatusInput").value
    };
    if (!payload.name)  { showToast("Teacher name is required", "warn");  return; }
    if (!payload.email) { showToast("Teacher email is required", "warn"); return; }

    const btn = document.getElementById("teacherSubmitBtn");
    btn.disabled = true;
    try {
      if (editingTeacherId) {
        await updateTeacher(activeSchoolId, editingTeacherId, payload);
        showToast("Teacher updated", "success");
      } else {
        await createTeacher(activeSchoolId, payload);
        showToast("Teacher added", "success");
      }
      resetForm();
      await refresh();
    } catch (err) {
      showToast(err.message || "Failed to save teacher", "error");
    } finally {
      btn.disabled = false;
    }
  });

  await refresh();
});
