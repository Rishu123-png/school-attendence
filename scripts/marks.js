/* ============================================================
   MARKS.JS — COMPLETE (was missing from repo!)
   Features: scope selector, student loader, marks entry,
             prediction with progress bar, full table overview,
             CSV export, offline check, loader, bottom nav
   ============================================================ */

import { initTheme, showToast, showLoader, hideLoader, initOfflineBanner, markActiveNav } from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import {
  resolveTeacherMarkContext,
  listStudentsForMarkScope,
  getStudentSubjectMarks,
  saveStudentSubjectMarks,
  buildPredictionSummary
} from "../services/marks-service.js";

let activeSchoolId = "";
let currentProfile = null;
let currentUser    = null;
let scopeList      = [];
let studentList    = [];
let currentScope   = null;
let currentStudentId = "";

initTheme();
initOfflineBanner();
showLoader();

function goLogin() { window.location.href = "./index.html"; }

function goBack() {
  const s = encodeURIComponent(activeSchoolId);
  if (isSchoolAdmin(currentProfile)) {
    window.location.href = `./school-admin.html?schoolId=${s}`;
  } else {
    window.location.href = `./teacher-home.html?schoolId=${s}`;
  }
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = String(v ?? "—"); }
function getNum(id, def = 0) { return Number(document.getElementById(id)?.value || def); }

/* ─── Prediction ─────────────────────────────────────────────── */
function showPrediction() {
  const summary = buildPredictionSummary({
    ut1Score:    getNum("ut1Score"),    ut1Max:    getNum("ut1Max",    25),
    hyScore:     getNum("hyScore"),     hyMax:     getNum("hyMax",    100),
    ut2Score:    getNum("ut2Score"),    ut2Max:    getNum("ut2Max",    25),
    annualScore: getNum("annualScore"), annualMax: getNum("annualMax",100),
    attendancePct: getNum("marksAttendancePct", 100)
  });

  const card = document.getElementById("marksPredictionCard");
  if (card) card.style.display = "";

  setText("predPct",   `${summary.predictedAnnualPct}%`);
  setText("predScore", `${summary.predictedScore} / ${getNum("annualMax",100)}`);

  const gradeEl = document.getElementById("predGrade");
  if (gradeEl) gradeEl.textContent = summary.grade;

  const badge = document.getElementById("marksGradeBadge");
  if (badge) {
    badge.textContent = summary.grade;
    badge.className = "badge " + (
      summary.predictedAnnualPct >= 75 ? "badge-success" :
      summary.predictedAnnualPct >= 50 ? "badge-warn" : "badge-danger"
    );
  }

  const bar = document.getElementById("predBar");
  if (bar) bar.style.width = `${Math.min(100, summary.predictedAnnualPct)}%`;

  const barLabel = document.getElementById("predBarLabel");
  if (barLabel) barLabel.textContent = `${summary.predictedAnnualPct}%`;
}

/* ─── Fill scope select ──────────────────────────────────────── */
function fillScopeSelect(scopes) {
  const select = document.getElementById("marksScopeSelect");
  select.innerHTML = '<option value="">-- Select class / subject --</option>';
  scopes.forEach((scope, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${scope.classLabel} — ${scope.subjectLabel}`;
    select.appendChild(opt);
  });
}

/* ─── Fill student select ────────────────────────────────────── */
function fillStudentSelect(students) {
  const select = document.getElementById("marksStudentSelect");
  select.innerHTML = '<option value="">-- Select student --</option>';
  students.forEach(st => {
    const opt = document.createElement("option");
    opt.value = st.studentId;
    opt.textContent = `${st.fullName || st.studentId}${st.rollNo ? ` (Roll ${st.rollNo})` : ""}`;
    select.appendChild(opt);
  });
}

/* ─── Load marks for a student ───────────────────────────────── */
async function loadStudent() {
  const scopeIdx = document.getElementById("marksScopeSelect")?.value;
  const studentId = document.getElementById("marksStudentSelect")?.value;
  if (scopeIdx === "" || !studentId) {
    showToast("Select scope and student first", "warn");
    return;
  }

  currentScope     = scopeList[parseInt(scopeIdx, 10)] || null;
  currentStudentId = studentId;
  if (!currentScope) return;

  const student = studentList.find(s => s.studentId === studentId);
  const marks   = await getStudentSubjectMarks(activeSchoolId, studentId, currentScope.subjectId);

  /* Show card */
  const card = document.getElementById("marksStudentCard");
  if (card) card.style.display = "";

  setText("marksStudentName", student?.fullName || studentId);
  setText("marksScopeLabel",  `Scope: ${currentScope.classLabel} — ${currentScope.subjectLabel}`);

  /* Fill marks */
  const exams = marks.exams || {};
  const setVal = (id, v, def) => { const el = document.getElementById(id); if (el) el.value = (v !== undefined && v !== null) ? v : def; };
  setVal("ut1Score",    exams.ut1?.score,           0);
  setVal("ut1Max",      exams.ut1?.maxScore,        25);
  setVal("hyScore",     exams.halfYearly?.score,    0);
  setVal("hyMax",       exams.halfYearly?.maxScore, 100);
  setVal("ut2Score",    exams.ut2?.score,           0);
  setVal("ut2Max",      exams.ut2?.maxScore,        25);
  setVal("annualScore", exams.annual?.score,        0);
  setVal("annualMax",   exams.annual?.maxScore,     100);

  showPrediction();
}

/* ─── Save marks ──────────────────────────────────────────────── */
async function saveMarks() {
  if (!navigator.onLine) { showToast("You are offline. Cannot save marks.", "error"); return; }
  if (!currentScope || !currentStudentId) { showToast("No student loaded", "warn"); return; }

  const btn = document.getElementById("marksSaveBtn");
  btn.disabled = true; btn.textContent = "Saving…";

  try {
    const student = studentList.find(s => s.studentId === currentStudentId);
    await saveStudentSubjectMarks(activeSchoolId, {
      studentId:     currentStudentId,
      subjectId:     currentScope.subjectId,
      subjectName:   currentScope.subjectLabel,
      teacherId:     currentScope.teacherId,
      teacherName:   currentProfile?.displayName || "Teacher",
      ut1Score:      getNum("ut1Score"),    ut1Max:    getNum("ut1Max",    25),
      hyScore:       getNum("hyScore"),     hyMax:     getNum("hyMax",    100),
      ut2Score:      getNum("ut2Score"),    ut2Max:    getNum("ut2Max",    25),
      annualScore:   getNum("annualScore"), annualMax: getNum("annualMax", 100),
    });
    showToast("✅ Marks saved successfully!", "success");
    showPrediction();
    await loadMarksTable();
  } catch (err) {
    console.error(err);
    showToast("Failed to save marks: " + (err.message || ""), "error");
  } finally {
    btn.disabled = false; btn.textContent = "💾 Save Marks";
  }
}

/* ─── Load marks overview table ──────────────────────────────── */
async function loadMarksTable() {
  const scopeIdx = document.getElementById("marksScopeSelect")?.value;
  if (scopeIdx === "" || !scopeList.length) return;

  const scope = scopeList[parseInt(scopeIdx, 10)] || null;
  if (!scope) return;

  const tableCard = document.getElementById("marksTableCard");
  if (tableCard) tableCard.style.display = "";

  const tbody = document.querySelector("#marksTable tbody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;">Loading…</td></tr>`;

  const students = await listStudentsForMarkScope(activeSchoolId, scope.classId, scope.subjectId);
  const marksArr = await Promise.all(students.map(s => getStudentSubjectMarks(activeSchoolId, s.studentId, scope.subjectId)));

  tbody.innerHTML = "";
  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state"><div class="empty-icon">📊</div><p>No students found for this scope.</p></div>
    </td></tr>`;
    return;
  }

  students.forEach((st, i) => {
    const m    = marksArr[i] || {};
    const exams= m.exams || {};
    const pct  = buildPredictionSummary({
      ut1Score:    exams.ut1?.score      || 0, ut1Max:    exams.ut1?.maxScore      || 25,
      hyScore:     exams.halfYearly?.score || 0, hyMax:   exams.halfYearly?.maxScore || 100,
      ut2Score:    exams.ut2?.score      || 0, ut2Max:    exams.ut2?.maxScore      || 25,
      annualScore: exams.annual?.score   || 0, annualMax: exams.annual?.maxScore   || 100,
      attendancePct: 100
    });

    const tr = document.createElement("tr");
    const fields = [
      { label: "Student",      value: st.fullName || st.studentId },
      { label: "UT-1",         value: exams.ut1       ? `${exams.ut1.score}/${exams.ut1.maxScore}`           : "—" },
      { label: "Half-Yearly",  value: exams.halfYearly? `${exams.halfYearly.score}/${exams.halfYearly.maxScore}` : "—" },
      { label: "UT-2",         value: exams.ut2       ? `${exams.ut2.score}/${exams.ut2.maxScore}`           : "—" },
      { label: "Annual",       value: exams.annual    ? `${exams.annual.score}/${exams.annual.maxScore}`      : "—" },
      { label: "Predicted %",  value: m.exams ? `${pct.predictedAnnualPct}%` : "—" },
    ];
    fields.forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = value;
      tr.appendChild(td);
    });
    // Grade badge cell
    const gradeTd = document.createElement("td");
    gradeTd.setAttribute("data-label", "Grade");
    if (m.exams) {
      const badge = document.createElement("span");
      badge.className = "badge " + (
        pct.predictedAnnualPct >= 75 ? "badge-success" :
        pct.predictedAnnualPct >= 50 ? "badge-warn" : "badge-danger"
      );
      badge.textContent = pct.grade;
      gradeTd.appendChild(badge);
    } else {
      gradeTd.textContent = "—";
    }
    tr.appendChild(gradeTd);
    tbody.appendChild(tr);
  });
}

/* ─── Export CSV ─────────────────────────────────────────────── */
function exportMarksCSV() {
  const rows = [];
  document.querySelectorAll("#marksTable tbody tr").forEach(tr => {
    const cells = Array.from(tr.querySelectorAll("td")).map(td => td.textContent.trim());
    if (cells.length) rows.push(cells);
  });
  if (!rows.length) { showToast("No data to export", "warn"); return; }
  const header = ["Student","UT-1","Half-Yearly","UT-2","Annual","Predicted %","Grade"];
  const csv = [header.join(",")]
    .concat(rows.map(r => r.map(v => `"${v.replace(/"/g,'""')}"`).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "marks.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ─── Clear form ─────────────────────────────────────────────── */
function clearForm() {
  ["ut1Score","ut1Max","hyScore","hyMax","ut2Score","ut2Max","annualScore","annualMax"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id.endsWith("Max") ? (id.includes("hy") || id.includes("annual") ? 100 : 25) : 0;
  });
  document.getElementById("marksStudentCard")?.style.setProperty("display","none");
  document.getElementById("marksPredictionCard")?.style.setProperty("display","none");
  currentStudentId = "";
  currentScope     = null;
}

/* ─── Scope change → fill students ───────────────────────────── */
document.getElementById("marksScopeSelect")?.addEventListener("change", async () => {
  const scopeIdx = document.getElementById("marksScopeSelect").value;
  if (scopeIdx === "") { studentList = []; fillStudentSelect([]); return; }
  const scope = scopeList[parseInt(scopeIdx, 10)] || null;
  if (!scope) return;
  studentList = await listStudentsForMarkScope(activeSchoolId, scope.classId, scope.subjectId);
  fillStudentSelect(studentList);
  await loadMarksTable();
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => { await logoutCurrentUser(); goLogin(); });
document.getElementById("backBtn")?.addEventListener("click", goBack);
document.getElementById("marksLoadBtn")?.addEventListener("click", loadStudent);
document.getElementById("marksSaveBtn")?.addEventListener("click", saveMarks);
document.getElementById("marksPredictBtn")?.addEventListener("click", showPrediction);
document.getElementById("marksClearBtn")?.addEventListener("click", clearForm);
document.getElementById("marksExportBtn")?.addEventListener("click", exportMarksCSV);

/* Live prediction as user types */
["ut1Score","ut1Max","hyScore","hyMax","ut2Score","ut2Max","annualScore","annualMax","marksAttendancePct"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", () => {
    if (currentStudentId) showPrediction();
  });
});

requireAuth(async (user) => {
  try {
    currentUser    = user;
    currentProfile = await getUserProfile(user.uid);
    if (!isTeacher(currentProfile) && !isSchoolAdmin(currentProfile)) {
      showToast("Teacher access only", "warn");
      setTimeout(goLogin, 700);
      return;
    }

    activeSchoolId = getSchoolIdFromProfile(currentProfile);
    if (!activeSchoolId) {
      showToast("No school linked to this account.", "warn");
      return;
    }

    const s = encodeURIComponent(activeSchoolId);
    document.getElementById("teacherMeta").textContent = `School: ${activeSchoolId}`;
    document.getElementById("nav-home")?.setAttribute("href",       `./teacher-home.html?schoolId=${s}`);
    document.getElementById("nav-schedule")?.setAttribute("href",   `./teacher-schedule.html?schoolId=${s}`);
    document.getElementById("nav-attendance")?.setAttribute("href", `./period-attendance.html?schoolId=${s}`);
    document.getElementById("nav-bunkers")?.setAttribute("href",    `./top-bunkers.html?schoolId=${s}`);
    document.querySelector("#breadcrumb a")?.setAttribute("href",   `./teacher-home.html?schoolId=${s}`);
    markActiveNav();

    const { teacher, scopes } = await resolveTeacherMarkContext(activeSchoolId, user.uid);
    scopeList = scopes;

    if (!teacher && !isSchoolAdmin(currentProfile)) {
      showToast("Your teacher account is not linked yet.", "warn");
    }

    fillScopeSelect(scopes);

    if (!scopes.length) {
      showToast("No assigned scopes found. Ask admin to assign you to a class-subject.", "info");
    }
  } catch (err) {
    console.error(err);
    showToast("Failed to load marks page: " + (err.message || ""), "error");
  } finally {
    hideLoader();
  }
}, goLogin);
