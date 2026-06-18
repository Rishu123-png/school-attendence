import { initTheme, showToast, showLoader, hideLoader, initOfflineBanner, markActiveNav } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { listClasses } from "../services/class-service.js";
import { getClassLeaderboard } from "../services/analytics-service.js";
import { exportStudentReportCSV } from "../services/export-service.js";

let activeSchoolId = "", currentProfile = null;
let currentData = [], currentClassName = "";

initTheme(); initOfflineBanner(); showLoader();
function goLogin() { window.location.href = "./index.html"; }

const MEDALS = ["🥇","🥈","🥉"];

function renderPodium(rows) {
  const top3 = rows.slice(0, 3);
  const pRow = document.getElementById("podiumRow");
  if (top3.length < 1) { pRow.style.display = "none"; return; }
  pRow.style.display = "";
  [0,1,2].forEach(i => {
    const el = document.getElementById(`podium${i+1}`);
    const s  = top3[i];
    if (!s) { el.style.display = "none"; return; }
    el.style.display = "";
    el.innerHTML = `
      <div style="font-size:32px;margin-bottom:6px;">${MEDALS[i]}</div>
      <div style="font-weight:800;font-size:14px;">${s.name}</div>
      <div style="color:var(--muted);font-size:12px;margin-top:2px;">${s.rollNo}</div>
      <div style="font-size:18px;font-weight:900;margin-top:8px;color:var(--accent-a);">${s.score}</div>
      <div style="font-size:11px;color:var(--muted);">score</div>
      <div style="margin-top:6px;" class="chip-row" style="justify-content:center;">
        ${s.attPct != null ? `<span class="chip" style="font-size:11px;">🎯 ${s.attPct}%</span>` : ""}
      </div>`;
  });
}

function renderTable(rows) {
  const tbody = document.querySelector("#leaderboardTable tbody");
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📭</div><p>No data yet. Mark attendance and enter marks first.</p></div></td></tr>`;
    return;
  }
  rows.forEach((s, i) => {
    const tr = document.createElement("tr");
    if (s.atRisk) tr.style.borderLeft = "3px solid var(--danger)";
    const rankIcon = i < 3 ? MEDALS[i] : String(i + 1);
    const fields = [
      { label:"Rank",        value: rankIcon },
      { label:"Student",     value: s.name },
      { label:"Roll",        value: s.rollNo },
      { label:"Section",     value: s.section },
      { label:"Attendance %",value: s.attPct  != null ? `${s.attPct}%`  : "—", style: s.atRisk ? "color:var(--danger);font-weight:700;" : s.attPct >= 85 ? "color:var(--success);" : "" },
      { label:"Avg Marks %", value: s.avgMarks != null ? `${s.avgMarks}%` : "—" },
      { label:"Score",       value: s.score, style: "font-weight:800;" },
    ];
    fields.forEach(({ label, value, style }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = String(value ?? "—");
      if (style) td.style.cssText = style;
      tr.appendChild(td);
    });
    const statusTd = document.createElement("td");
    statusTd.setAttribute("data-label", "Status");
    const badge = document.createElement("span");
    badge.className = s.atRisk ? "badge badge-danger" : "badge badge-success";
    badge.textContent = s.atRisk ? "⚠️ At Risk" : "✅ Good";
    statusTd.appendChild(badge);
    tr.appendChild(statusTd);
    // Make name clickable → student profile
    tr.querySelector("td:nth-child(2)").style.cursor = "pointer";
    tr.querySelector("td:nth-child(2)").style.color  = "var(--accent-a)";
    tr.querySelector("td:nth-child(2)").addEventListener("click", () => {
      window.location.href = `./student-profile.html?schoolId=${encodeURIComponent(activeSchoolId)}&studentId=${encodeURIComponent(s.studentId)}`;
    });
    tbody.appendChild(tr);
  });
}

async function loadLeaderboard() {
  const classId = document.getElementById("lbClassSelect").value;
  if (!classId) { showToast("Select a class first", "warn"); return; }
  const btn = document.getElementById("lbLoadBtn");
  btn.disabled = true; btn.textContent = "Loading…";
  try {
    currentData = await getClassLeaderboard(activeSchoolId, classId);
    currentClassName = document.getElementById("lbClassSelect").selectedOptions[0]?.textContent || classId;
    renderPodium(currentData);
    renderTable(currentData);
  } catch (err) {
    showToast(err.message || "Failed", "error");
  } finally { btn.disabled = false; btn.textContent = "🏆 Load Leaderboard"; }
}

document.getElementById("lbLoadBtn")?.addEventListener("click", loadLeaderboard);
document.getElementById("lbExportBtn")?.addEventListener("click", () => {
  if (!currentData.length) { showToast("Load a leaderboard first", "warn"); return; }
  exportStudentReportCSV(currentData, currentClassName);
});
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
    const s = encodeURIComponent(activeSchoolId);
    document.getElementById("nav-home")?.setAttribute("href", `./teacher-home.html?schoolId=${s}`);
    document.getElementById("nav-schedule")?.setAttribute("href", `./teacher-schedule.html?schoolId=${s}`);
    document.getElementById("nav-attendance")?.setAttribute("href", `./period-attendance.html?schoolId=${s}`);
    document.getElementById("nav-bunkers")?.setAttribute("href", `./top-bunkers.html?schoolId=${s}`);
    document.getElementById("nav-marks")?.setAttribute("href", `./marks.html?schoolId=${s}`);
    document.querySelector("#breadcrumb a")?.setAttribute("href", isSchoolAdmin(currentProfile) ? `./school-admin.html?schoolId=${s}` : `./teacher-home.html?schoolId=${s}`);
    markActiveNav();
    const classes = await listClasses(activeSchoolId);
    const sel = document.getElementById("lbClassSelect");
    classes.sort((a,b) => String(a.displayName||"").localeCompare(String(b.displayName||""))).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.classId; opt.textContent = c.displayName || c.classId;
      sel.appendChild(opt);
    });
  } catch (err) { showToast(err.message||"Error","error"); }
  finally { hideLoader(); }
}, goLogin);
