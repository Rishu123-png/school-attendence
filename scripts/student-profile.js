/* ============================================================
   STUDENT PROFILE — NEW
   Search by name, show attendance %, marks, bunks all in one view
   Works for both admin and teacher
   ============================================================ */
import { initTheme, showToast, showLoader, hideLoader, initOfflineBanner } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { listStudents } from "../services/student-service.js";
import { listClasses } from "../services/class-service.js";
import { listSubjects } from "../services/subject-service.js";
import { getStudentOverallSummary } from "../services/attendance-service.js";
import { getStudentSubjectMarks, buildPredictionSummary } from "../services/marks-service.js";
import { listBunkEvents } from "../services/bunk-service.js";

let activeSchoolId = "", currentProfile = null;
let allStudents = [], classMap = new Map(), subjectMap = new Map();

initTheme(); initOfflineBanner(); showLoader();

function goLogin() { window.location.href = "./index.html"; }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = String(v ?? "—"); }

async function showProfile(student) {
  document.getElementById("profileCard").style.display = "";
  const sid = student.studentId;

  setText("profName",    student.fullName || sid);
  setText("profClass",   `Class: ${classMap.get(student.classId)?.displayName || student.classId || "—"}`);
  setText("profSection", `Section: ${student.section || "—"}`);
  setText("profRoll",    `Roll: ${student.rollNo || "—"}`);
  setText("profStream",  `Stream: ${student.stream || "—"}`);
  setText("profSubjectCount", (student.selectedSubjectIds || []).length);

  /* Attendance summary */
  const summary = await getStudentOverallSummary(activeSchoolId, sid);
  const subjectSummaries = Object.entries(summary).filter(([k]) => k !== "_class");
  const classEntry = summary["_class"];

  const overallPcts = subjectSummaries.map(([, s]) => s.pct || 0);
  const overallAvg  = overallPcts.length > 0 ? Math.round(overallPcts.reduce((a, b) => a + b, 0) / overallPcts.length) : (classEntry?.pct ?? null);
  const isAtRisk    = overallAvg !== null && overallAvg < 75;

  setText("profOverallAtt", overallAvg != null ? `${overallAvg}%` : "No data");
  const riskBadge = document.getElementById("profRiskBadge");
  if (isAtRisk) {
    riskBadge.style.display = "";
    riskBadge.className = "badge badge-danger";
    riskBadge.textContent = "⚠️ At Risk (<75%)";
  } else {
    riskBadge.style.display = "none";
  }

  /* Attendance table */
  const attTbody = document.querySelector("#profAttTable tbody");
  attTbody.innerHTML = "";
  if (!subjectSummaries.length) {
    attTbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📊</div><p>No attendance data yet.</p></div></td></tr>`;
  } else {
    subjectSummaries.forEach(([subjectId, s]) => {
      const tr = document.createElement("tr");
      const pctColor = s.pct < 75 ? "color:var(--danger);font-weight:700;" : s.pct < 85 ? "color:var(--warn);font-weight:700;" : "color:var(--success);font-weight:700;";
      const fields = [
        { label:"Subject",  value: subjectMap.get(subjectId)?.name || subjectId },
        { label:"Present",  value: s.presentCount || 0 },
        { label:"Total",    value: s.totalCount   || 0 },
        { label:"Att %",    value: `${s.pct || 0}%`, style: pctColor },
        { label:"Status",   value: s.atRisk ? "⚠️ At Risk" : "✅ OK", style: s.atRisk ? "color:var(--danger);" : "color:var(--success);" },
      ];
      fields.forEach(({ label, value, style }) => {
        const td = document.createElement("td");
        td.setAttribute("data-label", label);
        td.textContent = value;
        if (style) td.style.cssText = style;
        tr.appendChild(td);
      });
      attTbody.appendChild(tr);
    });
  }

  /* Marks summary */
  const marksTbody = document.querySelector("#profMarksTable tbody");
  marksTbody.innerHTML = "";
  const subjectIds = (student.selectedSubjectIds || []);
  if (!subjectIds.length) {
    marksTbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📝</div><p>No subjects enrolled.</p></div></td></tr>`;
  } else {
    const marksAll = await Promise.all(subjectIds.map(sid2 => getStudentSubjectMarks(activeSchoolId, sid, sid2)));
    let gradeSum = 0, gradeCount = 0;
    subjectIds.forEach((subjectId, i) => {
      const m = marksAll[i] || {};
      const e = m.exams || {};
      const tr = document.createElement("tr");
      const pred = e.ut1 ? buildPredictionSummary({
        ut1Score: e.ut1?.score||0, ut1Max: e.ut1?.maxScore||25,
        hyScore: e.halfYearly?.score||0, hyMax: e.halfYearly?.maxScore||100,
        ut2Score: e.ut2?.score||0, ut2Max: e.ut2?.maxScore||25,
        annualScore: e.annual?.score||0, annualMax: e.annual?.maxScore||100,
        attendancePct: overallAvg || 100
      }) : null;
      if (pred) { gradeSum += pred.predictedAnnualPct; gradeCount++; }
      const fields = [
        { label:"Subject",      value: subjectMap.get(subjectId)?.name || subjectId },
        { label:"UT-1",         value: e.ut1       ? `${e.ut1.score}/${e.ut1.maxScore}` : "—" },
        { label:"Half-Yearly",  value: e.halfYearly? `${e.halfYearly.score}/${e.halfYearly.maxScore}` : "—" },
        { label:"UT-2",         value: e.ut2       ? `${e.ut2.score}/${e.ut2.maxScore}` : "—" },
        { label:"Annual",       value: e.annual    ? `${e.annual.score}/${e.annual.maxScore}` : "—" },
        { label:"Grade",        value: pred?.grade || "—", style: pred && pred.predictedAnnualPct >= 75 ? "color:var(--success);font-weight:700;" : pred ? "color:var(--danger);font-weight:700;" : "" },
      ];
      fields.forEach(({ label, value, style }) => {
        const td = document.createElement("td");
        td.setAttribute("data-label", label);
        td.textContent = value;
        if (style) td.style.cssText = style;
        tr.appendChild(td);
      });
      marksTbody.appendChild(tr);
    });
    setText("profAvgGrade", gradeCount > 0 ? `${Math.round(gradeSum/gradeCount)}%` : "—");
  }

  /* Bunks */
  const allBunks = await listBunkEvents(activeSchoolId);
  const myBunks  = allBunks.filter(b => b.studentId === sid).slice(0, 20);
  setText("profBunks", myBunks.length);
  const bunkTbody = document.querySelector("#profBunkTable tbody");
  bunkTbody.innerHTML = "";
  if (!myBunks.length) {
    bunkTbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">🎉</div><p>No bunk events recorded!</p></div></td></tr>`;
  } else {
    myBunks.forEach(b => {
      const tr = document.createElement("tr");
      [{ label:"Date", value: b.date }, { label:"Subject", value: b.subjectName||b.subjectId||"—" }, { label:"Period", value: b.periodId||"—" }, { label:"Teacher", value: b.teacherName||"—" }]
        .forEach(({ label, value }) => {
          const td = document.createElement("td");
          td.setAttribute("data-label", label);
          td.textContent = value;
          tr.appendChild(td);
        });
      bunkTbody.appendChild(tr);
    });
  }
}

function renderSearchResults(results, query) {
  const div = document.getElementById("searchResults");
  div.innerHTML = "";
  if (!results.length) {
    div.innerHTML = `<p style="color:var(--muted);font-size:13px;">No students found for "${query}"</p>`;
    return;
  }
  results.slice(0, 10).forEach(s => {
    const btn = document.createElement("button");
    btn.className = "btn-ghost";
    btn.style.cssText = "font-size:13px;padding:8px 14px;";
    btn.textContent = `${s.fullName} (${classMap.get(s.classId)?.displayName || s.classId || "?"})`;
    btn.addEventListener("click", () => { div.innerHTML = ""; showProfile(s); });
    div.appendChild(btn);
  });
}

document.getElementById("studentSearchBtn")?.addEventListener("click", () => {
  const q = document.getElementById("studentSearchInput").value.trim().toLowerCase();
  if (!q) { showToast("Enter a name to search", "warn"); return; }
  const results = allStudents.filter(s => (s.fullName || "").toLowerCase().includes(q));
  renderSearchResults(results, q);
});
document.getElementById("studentSearchInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("studentSearchBtn")?.click();
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => { await logoutCurrentUser(); goLogin(); });
document.getElementById("backBtn")?.addEventListener("click", () => {
  const s = encodeURIComponent(activeSchoolId);
  window.location.href = isSchoolAdmin(currentProfile)
    ? `./school-admin.html?schoolId=${s}`
    : `./teacher-home.html?schoolId=${s}`;
});

requireAuth(async user => {
  try {
    currentProfile = await getUserProfile(user.uid);
    if (!isTeacher(currentProfile) && !isSchoolAdmin(currentProfile)) { showToast("Access denied", "warn"); setTimeout(goLogin, 700); return; }
    activeSchoolId = getSchoolIdFromProfile(currentProfile);
    if (!activeSchoolId) { showToast("No school linked", "warn"); return; }
    document.getElementById("pageMeta").textContent = `School: ${activeSchoolId}`;

    const [students, classes, subjects] = await Promise.all([
      listStudents(activeSchoolId),
      listClasses(activeSchoolId),
      listSubjects(activeSchoolId)
    ]);
    allStudents = students;
    classMap    = new Map(classes.map(c  => [c.classId,   c]));
    subjectMap  = new Map(subjects.map(s => [s.subjectId, s]));

    /* Auto-load from URL param */
    const sid = new URLSearchParams(window.location.search).get("studentId");
    if (sid) {
      const st = students.find(s => s.studentId === sid);
      if (st) await showProfile(st);
    }
  } catch (err) {
    console.error(err);
    showToast("Error: " + (err.message || ""), "error");
  } finally { hideLoader(); }
}, goLogin);
