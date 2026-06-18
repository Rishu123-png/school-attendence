import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { listSubjects, createSubject } from "../services/subject-service.js";

let activeSchoolId = "";

function renderTable(rows) {
  const tbody = document.querySelector("#subjectsTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No subjects found yet.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    [row.name, row.code || "—", row.type || "—", row.subjectId].forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

async function refresh() {
  const rows = await listSubjects(activeSchoolId);
  renderTable(rows.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""))));
}

initAdminPage(async (profile) => {
  activeSchoolId = new URLSearchParams(window.location.search).get("schoolId") || profile.schoolId || "";
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;
  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });

  document.getElementById("subjectForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("subjectNameInput").value,
      code: document.getElementById("subjectCodeInput").value,
      type: document.getElementById("subjectTypeInput").value
    };
    if (!payload.name) {
      showToast("Subject name is required", "warn");
      return;
    }
    await createSubject(activeSchoolId, payload);
    document.getElementById("subjectForm").reset();
    showToast("Subject created", "success");
    await refresh();
  });

  await refresh();
});