import { initTheme, showToast, showLoader, hideLoader, initOfflineBanner } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { listClasses } from "../services/class-service.js";
import { listStudents } from "../services/student-service.js";
import { listAttendanceForDateRange } from "../services/attendance-service.js";
import { exportAttendanceCSV, triggerPrint } from "../services/export-service.js";

let activeSchoolId = "", currentProfile = null;
let currentRecords = [], currentClassLabel = "", studentMap = new Map();

initTheme(); initOfflineBanner(); showLoader();
function goLogin() { window.location.href = "./index.html"; }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = String(v ?? "—"); }
function today() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function monthAgo() { const d=new Date(); d.setMonth(d.getMonth()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

async function generateReport() {
  const classId  = document.getElementById("repClassSelect").value;
  const fromDate = document.getElementById("repFromDate").value;
  const toDate   = document.getElementById("repToDate").value;
  if (!classId)  { showToast("Select a class", "warn"); return; }
  if (!fromDate || !toDate) { showToast("Select date range", "warn"); return; }
  if (fromDate > toDate) { showToast("From date must be before To date", "warn"); return; }

  const btn = document.getElementById("repLoadBtn");
  btn.disabled = true; btn.textContent = "Generating…";

  try {
    currentClassLabel = document.getElementById("repClassSelect").selectedOptions[0]?.textContent || classId;
    const [records, students] = await Promise.all([
      listAttendanceForDateRange(activeSchoolId, classId, fromDate, toDate),
      listStudents(activeSchoolId)
    ]);
    const classStudents = students.filter(s => s.classId === classId);
    studentMap = new Map(classStudents.map(s => [s.studentId, s]));
    currentRecords = records;

    /* Summary stats */
    const total   = records.length;
    const present = records.filter(r => r.status === "present" || r.status === "late").length;
    const absent  = records.filter(r => r.status === "absent").length;
    const late    = records.filter(r => r.status === "late").length;
    const pct     = total > 0 ? Math.round((present / total) * 100) : 0;
    setText("repTotal",   total);
    setText("repPresent", present);
    setText("repAbsent",  absent);
    setText("repPct",     total > 0 ? `${pct}%` : "—");
    document.getElementById("repSummaryGrid").style.display = "";

    /* Student-wise summary */
    const byStudent = new Map();
    records.forEach(r => {
      if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, { present:0, absent:0, late:0, total:0 });
      const s = byStudent.get(r.studentId);
      s.total++;
      if (r.status === "present") s.present++;
      else if (r.status === "absent") s.absent++;
      else if (r.status === "late") { s.late++; s.present++; }
    });

    const stBody = document.querySelector("#repStudentTable tbody");
    stBody.innerHTML = "";
    classStudents.forEach(stu => {
      const stats = byStudent.get(stu.studentId) || { present:0, absent:0, late:0, total:0 };
      const stPct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : null;
      const tr = document.createElement("tr");
      if (stPct !== null && stPct < 75) tr.style.borderLeft = "3px solid var(--danger)";
      const fields = [
        { label:"Student",  value: stu.fullName || stu.studentId },
        { label:"Roll",     value: stu.rollNo || "—" },
        { label:"Present",  value: stats.present },
        { label:"Absent",   value: stats.absent, style: stats.absent > 0 ? "color:var(--danger);" : "" },
        { label:"Late",     value: stats.late,   style: stats.late > 0 ? "color:var(--warn);" : "" },
        { label:"Total",    value: stats.total },
        { label:"Att %",    value: stPct != null ? `${stPct}%` : "—", style: stPct !== null ? (stPct < 75 ? "color:var(--danger);font-weight:700;" : stPct < 85 ? "color:var(--warn);" : "color:var(--success);") : "" },
      ];
      fields.forEach(({ label, value, style }) => {
        const td = document.createElement("td");
        td.setAttribute("data-label", label);
        td.textContent = String(value ?? "—");
        if (style) td.style.cssText = style;
        tr.appendChild(td);
      });
      stBody.appendChild(tr);
    });
    document.getElementById("repStudentCard").style.display = "";

    /* Detailed records */
    const detBody = document.querySelector("#repDetailTable tbody");
    detBody.innerHTML = "";
    if (!records.length) {
      detBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📭</div><p>No attendance records in this date range.</p></div></td></tr>`;
    } else {
      records.slice(0, 500).forEach(r => {
        const tr = document.createElement("tr");
        const statusColor = r.status==="present"||r.status==="late" ? "color:var(--success);" : r.status==="absent" ? "color:var(--danger);" : "";
        const student = studentMap.get(r.studentId);
        const fields = [
          { label:"Date",    value: r.date },
          { label:"Period",  value: r.periodId },
          { label:"Student", value: r.studentName || student?.fullName || r.studentId },
          { label:"Roll",    value: student?.rollNo || "—" },
          { label:"Status",  value: r.status, style: statusColor + "font-weight:700;" },
          { label:"Subject", value: r.subjectName || "—" },
          { label:"Teacher", value: r.teacherName || "—" },
        ];
        fields.forEach(({ label, value, style }) => {
          const td = document.createElement("td");
          td.setAttribute("data-label", label);
          td.textContent = String(value ?? "—");
          if (style) td.style.cssText = style;
          tr.appendChild(td);
        });
        detBody.appendChild(tr);
      });
    }
    document.getElementById("repDetailCard").style.display = "";

    /* Print header */
    setText("printSchoolName",  `School: ${activeSchoolId}`);
    setText("printReportTitle", `Attendance Report — ${currentClassLabel} | ${fromDate} to ${toDate}`);
    document.getElementById("printHeader").style.display = "";

  } catch (err) {
    console.error(err);
    showToast("Error: " + (err.message || ""), "error");
  } finally { btn.disabled = false; btn.textContent = "📊 Generate Report"; }
}

document.getElementById("repLoadBtn")?.addEventListener("click", generateReport);
document.getElementById("repCSVBtn")?.addEventListener("click", () => {
  if (!currentRecords.length) { showToast("Generate report first", "warn"); return; }
  const from = document.getElementById("repFromDate").value;
  const to   = document.getElementById("repToDate").value;
  exportAttendanceCSV(currentRecords, currentClassLabel, `${from}_to_${to}`);
});
document.getElementById("repPrintBtn")?.addEventListener("click", triggerPrint);
document.getElementById("logoutBtn")?.addEventListener("click", async () => { await logoutCurrentUser(); goLogin(); });
document.getElementById("backBtn")?.addEventListener("click", () => {
  const s = encodeURIComponent(activeSchoolId);
  window.location.href = isSchoolAdmin(currentProfile) ? `./school-admin.html?schoolId=${s}` : `./teacher-home.html?schoolId=${s}`;
});

requireAuth(async user => {
  try {
    currentProfile = await getUserProfile(user.uid);
    if (!isTeacher(currentProfile) && !isSchoolAdmin(currentProfile)) { showToast("Access denied","warn"); setTimeout(goLogin,700); return; }
    activeSchoolId = getSchoolIdFromProfile(currentProfile);
    document.getElementById("pageMeta").textContent = `School: ${activeSchoolId}`;
    document.getElementById("repFromDate").value = monthAgo();
    document.getElementById("repToDate").value   = today();
    const classes = await listClasses(activeSchoolId);
    const sel = document.getElementById("repClassSelect");
    classes.sort((a,b) => String(a.displayName||"").localeCompare(String(b.displayName||""))).forEach(c => {
      const opt = document.createElement("option"); opt.value = c.classId; opt.textContent = c.displayName || c.classId;
      sel.appendChild(opt);
    });
    /* pre-select from URL */
    const urlClassId = new URLSearchParams(window.location.search).get("classId");
    if (urlClassId) sel.value = urlClassId;
  } catch (err) { showToast(err.message||"Error","error"); }
  finally { hideLoader(); }
}, goLogin);
