/* ============================================================
   SUBJECTS MANAGE — UPGRADED
   Fixes: loader via admin-common, empty state, mobile data-labels,
          schoolId security, error handling, badge for type
   ============================================================ */

import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { listSubjects, createSubject } from "../services/subject-service.js";

let activeSchoolId = "";

const TYPE_BADGE = {
  core:     "badge-info",
  elective: "badge-success",
  lab:      "badge-warn",
  activity: "badge-info",
};

function renderTable(rows) {
  const tbody = document.querySelector("#subjectsTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4">
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <p>No subjects added yet.<br>Use the form above to create subjects.</p>
      </div>
    </td></tr>`;
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const fields = [
      { label: "Name", value: row.name || "—" },
      { label: "Code", value: row.code || "—" },
    ];
    fields.forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = value;
      tr.appendChild(td);
    });

    const typeTd = document.createElement("td");
    typeTd.setAttribute("data-label", "Type");
    const badge = document.createElement("span");
    badge.className = `badge ${TYPE_BADGE[row.type] || "badge-info"}`;
    badge.textContent = row.type || "—";
    typeTd.appendChild(badge);
    tr.appendChild(typeTd);

    const idTd = document.createElement("td");
    idTd.setAttribute("data-label", "ID");
    idTd.style.fontSize = "11px";
    idTd.style.color = "var(--muted)";
    idTd.textContent = row.subjectId || "—";
    tr.appendChild(idTd);

    tbody.appendChild(tr);
  });
}

async function refresh() {
  const rows = await listSubjects(activeSchoolId);
  renderTable(rows.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""))));
}

initAdminPage(async (profile, safeSchoolId) => {
  activeSchoolId = safeSchoolId;
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });

  document.getElementById("subjectForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("subjectNameInput")?.value?.trim() || "";
    if (!name) { showToast("Subject name is required", "warn"); return; }

    const btn = document.getElementById("subjectSubmitBtn");
    btn.disabled = true;
    try {
      await createSubject(activeSchoolId, {
        name,
        code: document.getElementById("subjectCodeInput")?.value?.trim() || "",
        type: document.getElementById("subjectTypeInput")?.value || "core"
      });
      document.getElementById("subjectForm").reset();
      showToast("Subject created", "success");
      await refresh();
    } catch (err) {
      showToast(err.message || "Failed to create subject", "error");
    } finally {
      btn.disabled = false;
    }
  });

  await refresh();
});

