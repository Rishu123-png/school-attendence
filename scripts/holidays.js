import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast, confirmAction } from "./app-shell.js";
import { listHolidays, setHoliday, deleteHoliday } from "../services/holiday-service.js";

let activeSchoolId = "";
const TYPE_MAP = { holiday:"🎉 Holiday", exam:"📝 Exam", event:"🎊 Event", halfday:"🕐 Half Day" };

function renderTable(rows) {
  const tbody = document.querySelector("#holidaysTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📅</div><p>No holidays added yet.</p></div></td></tr>`;
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const today = new Date().toISOString().slice(0,10);
    if (row.date < today) tr.style.opacity = "0.55";
    [
      { label:"Date",   value: row.date },
      { label:"Reason", value: row.reason },
      { label:"Type",   value: TYPE_MAP[row.type] || row.type },
    ].forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = value;
      tr.appendChild(td);
    });
    const actionTd = document.createElement("td");
    actionTd.setAttribute("data-label","Action");
    const del = document.createElement("button");
    del.className = "btn-danger"; del.textContent = "🗑️ Delete";
    del.onclick = async () => {
      const ok = await confirmAction(`Remove holiday on ${row.date}?`);
      if (!ok) return;
      await deleteHoliday(activeSchoolId, row.date);
      showToast("Holiday removed", "success");
      await refresh();
    };
    actionTd.appendChild(del);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

async function refresh() {
  const rows = await listHolidays(activeSchoolId);
  renderTable(rows);
}

initAdminPage(async (profile, safeSchoolId) => {
  activeSchoolId = safeSchoolId;
  document.getElementById("schoolMeta").textContent = `School: ${activeSchoolId}`;
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });

  const today = new Date().toISOString().slice(0,10);
  document.getElementById("holidayDate").value = today;

  document.getElementById("holidayForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const date   = document.getElementById("holidayDate").value;
    const reason = document.getElementById("holidayReason").value.trim();
    const type   = document.getElementById("holidayType").value;
    if (!date)   { showToast("Date is required", "warn");   return; }
    if (!reason) { showToast("Reason is required", "warn"); return; }
    const btn = document.getElementById("holidaySubmitBtn");
    btn.disabled = true;
    try {
      await setHoliday(activeSchoolId, date, reason, type);
      document.getElementById("holidayForm").reset();
      document.getElementById("holidayDate").value = today;
      showToast("Holiday added ✅", "success");
      await refresh();
    } catch (err) {
      showToast(err.message || "Failed", "error");
    } finally { btn.disabled = false; }
  });

  await refresh();
});
