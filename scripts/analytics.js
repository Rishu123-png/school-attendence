/* ============================================================
   ANALYTICS.JS — NEW
   Chart.js powered: trend, subject, teacher performance, class report
   ============================================================ */
import { initAdminPage, schoolLink } from "./admin-common.js";
import { showToast } from "./app-shell.js";
import { getDailyReport, getAttendanceTrend, getSubjectAttendanceSummary, getTeacherPerformance } from "../services/analytics-service.js";
import { getAtRiskStudents } from "../services/attendance-service.js";

let activeSchoolId = "";
let trendChart, subjectChart, teacherChart;

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = String(v ?? "—"); }

function chartDefaults() {
  return {
    responsive: true,
    plugins: { legend: { labels: { color: "#aab7d1", font: { size: 12 } } } },
    scales: {
      x: { ticks: { color: "#aab7d1" }, grid: { color: "rgba(255,255,255,0.06)" } },
      y: { ticks: { color: "#aab7d1" }, grid: { color: "rgba(255,255,255,0.06)" }, min: 0, max: 100 }
    }
  };
}

async function renderAll(date) {
  const [report, trend, subjectSummary, teacherPerf, atRisk] = await Promise.all([
    getDailyReport(activeSchoolId, date),
    getAttendanceTrend(activeSchoolId, 14),
    getSubjectAttendanceSummary(activeSchoolId),
    getTeacherPerformance(activeSchoolId, date),
    getAtRiskStudents(activeSchoolId, 75)
  ]);

  /* KPIs */
  setText("kpiToday",   report.schoolAttendancePct != null ? `${report.schoolAttendancePct}%` : "No data");
  setText("kpiAtRisk",  atRisk.length);
  const totalSubmitted = report.classReports.reduce((a,c) => a + c.periodsSubmitted, 0);
  const totalMissing   = report.classReports.reduce((a,c) => a + c.periodsMissing,   0);
  setText("kpiPeriods", totalSubmitted);
  setText("kpiMissing", totalMissing);

  /* Trend Chart */
  const trendLabels = trend.map(t => t.date.slice(5));
  const trendData   = trend.map(t => t.pct);
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById("trendChart"), {
    type: "line",
    data: {
      labels: trendLabels,
      datasets: [{
        label: "Attendance %",
        data: trendData,
        borderColor: "#6a7cff",
        backgroundColor: "rgba(106,124,255,0.15)",
        fill: true, tension: 0.4,
        pointBackgroundColor: "#6a7cff"
      }]
    },
    options: chartDefaults()
  });

  /* Subject Chart */
  const subLabels = subjectSummary.slice(0, 10).map(s => s.name);
  const subData   = subjectSummary.slice(0, 10).map(s => s.avgPct);
  const subColors = subData.map(v => v < 75 ? "#ff6f7e" : v < 85 ? "#ffb74a" : "#3fd08c");
  if (subjectChart) subjectChart.destroy();
  subjectChart = new Chart(document.getElementById("subjectChart"), {
    type: "bar",
    data: {
      labels: subLabels.length ? subLabels : ["No data"],
      datasets: [{
        label: "Avg Attendance %",
        data: subData.length ? subData : [0],
        backgroundColor: subColors
      }]
    },
    options: { ...chartDefaults(), scales: { ...chartDefaults().scales, y: { ...chartDefaults().scales.y, min: 0, max: 100 } } }
  });

  /* Teacher Performance Chart */
  const teacherLabels = teacherPerf.map(t => t.name || t.teacherId);
  const submitted = teacherPerf.map(t => t.periodsSubmitted);
  const missing   = teacherPerf.map(t => t.periodsMissing);
  if (teacherChart) teacherChart.destroy();
  teacherChart = new Chart(document.getElementById("teacherChart"), {
    type: "bar",
    data: {
      labels: teacherLabels.length ? teacherLabels : ["No data"],
      datasets: [
        { label: "Submitted", data: submitted, backgroundColor: "#3fd08c" },
        { label: "Missing",   data: missing,   backgroundColor: "#ff6f7e" }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#aab7d1" } } },
      scales: {
        x: { stacked: false, ticks: { color: "#aab7d1" }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: { ticks: { color: "#aab7d1" }, grid: { color: "rgba(255,255,255,0.06)" }, min: 0 }
      }
    }
  });

  /* Class Report Table */
  const tbody = document.querySelector("#classReportTable tbody");
  tbody.innerHTML = "";
  if (!report.classReports.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📭</div><p>No attendance data for this date.</p></div></td></tr>`;
    return;
  }
  report.classReports.forEach(c => {
    const tr = document.createElement("tr");
    const pct = c.attendancePct;
    const pctLabel = pct != null ? `${pct}%` : "—";
    const pctColor = pct == null ? "" : pct < 75 ? "color:var(--danger)" : pct < 85 ? "color:var(--warn)" : "color:var(--success)";
    const fields = [
      { label: "Class",      value: c.className },
      { label: "Present",    value: c.totalStudents > 0 ? `${c.presentStudents} / ${c.totalStudents}` : "—" },
      { label: "Att %",      value: pctLabel, style: pctColor },
      { label: "Submitted",  value: c.periodsSubmitted },
      { label: "Missing",    value: c.periodsMissing }
    ];
    fields.forEach(({ label, value, style }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = String(value ?? "—");
      if (style) td.style.cssText = style + ";font-weight:700;";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

initAdminPage(async (profile, safeSchoolId) => {
  activeSchoolId = safeSchoolId;
  document.getElementById("schoolMeta").textContent = `School: ${activeSchoolId}`;
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = schoolLink("./school-admin.html", activeSchoolId);
  });

  const dateInput = document.getElementById("analyticsDateInput");
  dateInput.value = today();
  dateInput.addEventListener("change", () => renderAll(dateInput.value));

  try {
    await renderAll(today());
  } catch (err) {
    console.error(err);
    showToast("Analytics error: " + (err.message || ""), "error");
  }
});
