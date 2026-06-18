import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { listTeacherAlerts, listParentNotifications, sweepTeacherLateAlerts } from "../services/notification-service.js";

let activeSchoolId = "";

function renderTeacherAlerts(rows) {
  const tbody = document.querySelector("#teacherAlertsTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "No teacher alerts found.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    [row.teacherName || row.teacherId || "—", row.classLabel || row.classId || "—", row.subjectName || row.subjectId || "—", row.date || "—", row.periodId || "—", row.status || "—"].forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderParentNotifications(rows) {
  const tbody = document.querySelector("#parentNotificationsTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "No parent notification records found.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    [row.studentName || row.studentId || "—", row.classId || "—", row.subjectName || row.subjectId || "—", row.date || "—", row.periodId || "—", row.status || "—"].forEach(value => {
      const td = document.createElement("td");
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });
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

initAdminPage(async (profile) => {
  activeSchoolId = new URLSearchParams(window.location.search).get("schoolId") || profile.schoolId || "";
  document.getElementById("schoolMeta").textContent = `School ID: ${activeSchoolId}`;

  const today = new Date();
  document.getElementById("alertsDateInput").value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });
  document.getElementById("alertsRefreshBtn").addEventListener("click", refresh);
  document.getElementById("alertsSweepBtn").addEventListener("click", async () => {
    const date = document.getElementById("alertsDateInput").value;
    const grace = parseInt(document.getElementById("lateGraceInput").value, 10) || 3;
    const result = await sweepTeacherLateAlerts(activeSchoolId, date, grace);
    showToast(`Late alert sweep finished. Created ${result.created} alerts.`, "success");
    await refresh();
  });

  await refresh();
});