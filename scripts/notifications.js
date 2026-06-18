/* ============================================================
   NOTIFICATIONS — UPGRADED
   Fixes: loader via admin-common, empty states, mobile data-labels,
          badge for status, breadcrumb
   ============================================================ */

import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { listTeacherAlerts, listParentNotifications, sweepTeacherLateAlerts } from "../services/notification-service.js";

let activeSchoolId = "";

function statusBadge(status) {
  const cls = status === "open" ? "badge-danger" : status === "submitted" ? "badge-success" : "badge-warn";
  return `<span class="badge ${cls}">${status || "—"}</span>`;
}

function renderTeacherAlerts(rows) {
  const tbody = document.querySelector("#teacherAlertsTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <p>No teacher alerts found. All periods are being marked on time!</p>
      </div>
    </td></tr>`;
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const fields = [
      { label: "Teacher", value: row.teacherName || row.teacherId || "—" },
      { label: "Class",   value: row.classLabel  || row.classId   || "—" },
      { label: "Subject", value: row.subjectName || row.subjectId || "—" },
      { label: "Date",    value: row.date         || "—" },
      { label: "Period",  value: row.periodId     || "—" },
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
    tbody.appendChild(tr);
  });
}

function renderParentNotifications(rows) {
  const tbody = document.querySelector("#parentNotificationsTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No parent notification records found.</p>
      </div>
    </td></tr>`;
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const fields = [
      { label: "Student", value: row.studentName || row.studentId || "—" },
      { label: "Class",   value: row.classId     || "—" },
      { label: "Subject", value: row.subjectName || row.subjectId || "—" },
      { label: "Date",    value: row.date         || "—" },
      { label: "Period",  value: row.periodId     || "—" },
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
    tbody.appendChild(tr);
  });
}

async function refresh() {
  const [teacherAlerts, parentNotifications] = await Promise.all([
    listTeacherAlerts(activeSchoolId),
    listParentNotifications(activeSchoolId)
  ]);
  renderTeacherAlerts(teacherAlerts);
  renderParentNotifications(parentNotifications);
}

initAdminPage(async (profile, safeSchoolId) => {
  activeSchoolId = safeSchoolId;
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;

  const today = new Date();
  document.getElementById("alertsDateInput").value =
    `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });
  document.getElementById("alertsRefreshBtn")?.addEventListener("click", refresh);
  document.getElementById("alertsSweepBtn")?.addEventListener("click", async () => {
    if (!navigator.onLine) { showToast("You are offline. Cannot run sweep.", "error"); return; }
    const date  = document.getElementById("alertsDateInput").value;
    const grace = parseInt(document.getElementById("lateGraceInput")?.value || "3", 10) || 3;
    const sweepBtn = document.getElementById("alertsSweepBtn");
    sweepBtn.disabled = true;
    try {
      const result = await sweepTeacherLateAlerts(activeSchoolId, date, grace);
      showToast(`Sweep done. Created ${result.created} late alerts.`, "success");
      await refresh();
    } catch (err) {
      showToast(err.message || "Sweep failed", "error");
    } finally {
      sweepBtn.disabled = false;
    }
  });

  await refresh();
});
