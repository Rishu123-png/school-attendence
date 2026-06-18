/* ============================================================
   CLASSES MANAGE — UPGRADED
   Fixes: delete confirmation, empty state, mobile data-labels
   ============================================================ */

import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast, confirmAction } from "./app-shell.js";
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
    const opt = document.createElement("option");
    opt.value = row.teacherId;
    opt.textContent = row.name || row.teacherId;
    select.appendChild(opt);
  });
  if (current) select.value = current;
}

function resetForm() {
  editingClassId = "";
  document.getElementById("classForm")?.reset();
  const btn = document.getElementById("classSubmitBtn");
  if (btn) btn.textContent = "💾 Save Class";
  document.getElementById("classCancelBtn").style.display = "none";
}

function startEdit(row) {
  editingClassId = row.classId;
  document.getElementById("classNameInput").value     = row.name         || "";
  document.getElementById("classSectionInput").value  = row.section      || "";
  document.getElementById("classStreamInput").value   = row.stream       || "";
  document.getElementById("classRoomInput").value     = row.roomNo       || "";
  document.getElementById("classTeacherSelect").value = row.classTeacherId || "";
  document.getElementById("classSubmitBtn").textContent = "✏️ Update Class";
  document.getElementById("classCancelBtn").style.display = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTable(rows) {
  const tbody = document.querySelector("#classesTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <div class="empty-icon">🏛️</div>
        <p>No classes created yet.<br>Use the form above to create a class.</p>
      </div>
    </td></tr>`;
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const teacher = teacherMap.get(row.classTeacherId)?.name || "—";
    const fields = [
      { label: "Class",     value: row.displayName || row.classId },
      { label: "Name",      value: row.name         || "—" },
      { label: "Section",   value: row.section       || "—" },
      { label: "Stream",    value: row.stream        || "—" },
      { label: "Teacher",   value: teacher },
    ];
    fields.forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = String(value || "—");
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
      const ok = await confirmAction(`Delete class "${row.displayName || row.name}"? This cannot be undone.`);
      if (!ok) return;
      await deleteClass(activeSchoolId, row.classId);
      showToast("Class deleted", "success");
      await refresh();
    };
    actionTd.append(editBtn, " ", deleteBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function refresh() {
  const [teachers, classes] = await Promise.all([listTeachers(activeSchoolId), listClasses(activeSchoolId)]);
  fillTeachers(teachers.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""))));
  renderTable(classes.sort((a,b) => String(a.displayName||"").localeCompare(String(b.displayName||""))));
}

initAdminPage(async (profile, safeSchoolId) => {
  activeSchoolId = safeSchoolId;
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });
  document.getElementById("classCancelBtn")?.addEventListener("click", resetForm);
  document.getElementById("classCancelBtn").style.display = "none";

  document.getElementById("classForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name:          document.getElementById("classNameInput").value.trim(),
      section:       document.getElementById("classSectionInput").value.trim(),
      stream:        document.getElementById("classStreamInput").value.trim(),
      roomNo:        document.getElementById("classRoomInput").value.trim(),
      classTeacherId:document.getElementById("classTeacherSelect").value
    };
    if (!payload.name)    { showToast("Class name is required", "warn");    return; }
    if (!payload.section) { showToast("Section is required", "warn"); return; }

    const btn = document.getElementById("classSubmitBtn");
    btn.disabled = true;
    try {
      if (editingClassId) {
        await updateClass(activeSchoolId, editingClassId, payload);
        showToast("Class updated", "success");
      } else {
        await createClass(activeSchoolId, payload);
        showToast("Class created", "success");
      }
      resetForm();
      await refresh();
    } catch (err) {
      showToast(err.message || "Failed to save class", "error");
    } finally {
      btn.disabled = false;
    }
  });

  await refresh();
});
