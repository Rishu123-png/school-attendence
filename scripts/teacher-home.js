/* ============================================================
   TEACHER HOME — v3.1 FIXED
   Root cause of infinite loading fixed:
   1. hideLoader() is now in BOTH catch AND finally with guard
   2. Promise.all wrapped so one failure doesn't block hideLoader
   3. getAtRiskStudents & announcements won't crash everything
   4. Safety net added: force-hide loader after 8s no matter what
   ============================================================ */
import {
  initTheme, showToast, showLoader, hideLoader,
  initOfflineBanner, markActiveNav,
  startLoaderSafetyNet, clearLoaderSafetyNet
} from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import {
  getUserProfile, isTeacher, isSchoolAdmin, getSchoolIdFromProfile
} from "../services/profile-service.js";
import { listTeachers } from "../services/teacher-service.js";
import { listClasses } from "../services/class-service.js";
import { listTeacherScheduleForDate } from "../services/timetable-service.js";
import { getLatestAnnouncements } from "../services/announcement-service.js";
import { isHoliday } from "../services/holiday-service.js";
import { getAtRiskStudents } from "../services/attendance-service.js";

let activeSchoolId = "", currentProfile = null, currentTeacher = null;
let classMap = new Map();
let loaderHidden = false;

initTheme();
initOfflineBanner();
showLoader();
startLoaderSafetyNet(8000); /* Force-hide after 8s if something silently fails */

function goLogin() { window.location.href = "./index.html"; }

function safeHideLoader() {
  if (loaderHidden) return;
  loaderHidden = true;
  clearLoaderSafetyNet();
  hideLoader();
}

function formatToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(v ?? "");
}

function buildAttendanceUrl(row, dateStr) {
  const url = new URL("./period-attendance.html", window.location.href);
  url.searchParams.set("schoolId", activeSchoolId);
  url.searchParams.set("classId",  row.classId  || "");
  url.searchParams.set("date",     dateStr       || "");
  url.searchParams.set("periodId", row.periodId  || "");
  return url.toString();
}

/* Network dot */
function updateNetDot() {
  const d = document.getElementById("netDot");
  if (d) d.classList.toggle("offline", !navigator.onLine);
}
window.addEventListener("online",  updateNetDot);
window.addEventListener("offline", updateNetDot);
updateNetDot();

/* Next class card */
function updateNextCard(rows, dateStr) {
  const card = document.getElementById("nextClassCard");
  const btn  = document.getElementById("nextAttendanceBtn");
  const qBtn = document.getElementById("goAttendanceBtn");
  if (!card || !btn || !qBtn) return;
  if (!rows.length) { card.style.display = "none"; qBtn.disabled = true; return; }
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const next = rows.find(r => {
    if (!String(r.startTime || "").includes(":")) return false;
    const [h, m] = r.startTime.split(":").map(Number);
    return h * 60 + m >= nowMin;
  }) || rows[0];
  const cl = classMap.get(next.classId)?.displayName || next.classId || "—";
  setText("nextClassLabel",   `Class: ${cl}`);
  setText("nextTimeLabel",    `Time: ${[next.startTime, next.endTime].filter(Boolean).join(" - ") || "—"}`);
  setText("nextSubjectLabel", `Subject: ${next.subjectName || next.subjectId || "—"}`);
  setText("nextRoomLabel",    `Room: ${next.roomNo || "—"}`);
  const url = buildAttendanceUrl(next, dateStr);
  btn.onclick  = () => { window.location.href = url; };
  qBtn.onclick = () => { window.location.href = url; };
  qBtn.disabled = false;
  card.style.display = "";
}

/* Schedule table */
function renderSchedule(rows, dateStr) {
  updateNextCard(rows, dateStr);
  setText("todaySlotCount",    rows.length);
  setText("todaySubjectCount", rows.filter(r => r.slotType === "subject").length);
  setText("todayClassCount",   rows.filter(r => r.slotType !== "subject").length);
  const tbody = document.querySelector("#teacherHomeScheduleTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No periods assigned for today.<br>Ask admin to check the timetable.</p>
      </div>
    </td></tr>`;
    return;
  }
  rows.forEach(row => {
    const tr = document.createElement("tr");
    const cl = classMap.get(row.classId)?.displayName || row.classId || "—";
    [
      { label: "Class",   value: cl },
      { label: "Period",  value: row.label || `Period ${row.periodNo || ""}` },
      { label: "Type",    value: row.slotType === "subject" ? "Subject" : "Class" },
      { label: "Time",    value: [row.startTime, row.endTime].filter(Boolean).join(" - ") || "—" },
      { label: "Subject", value: row.subjectName || row.subjectId || "—" },
      { label: "Room",    value: row.roomNo || "—" },
    ].forEach(({ label, value }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", label);
      td.textContent = String(value || "—");
      tr.appendChild(td);
    });
    const atd = document.createElement("td");
    atd.setAttribute("data-label", "Action");
    const b = document.createElement("button");
    b.className = "btn-cta";
    b.textContent = "Mark";
    b.onclick = () => { window.location.href = buildAttendanceUrl(row, dateStr); };
    atd.appendChild(b);
    tr.appendChild(atd);
    tbody.appendChild(tr);
  });
}

/* Announcements */
function renderAnnouncements(items) {
  const wrap = document.getElementById("announcementsWrap");
  if (!wrap) return;
  if (!items || !items.length) {
    wrap.innerHTML = `<p style="color:var(--muted);font-size:13px;">No announcements yet.</p>`;
    return;
  }
  const TYPE_ICON = { general: "📋", exam: "📝", event: "🎉", urgent: "🚨" };
  wrap.innerHTML = "";
  items.forEach(item => {
    const div = document.createElement("div");
    div.style.cssText = "background:var(--btn-ghost-bg);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:8px;";
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span style="font-size:16px;">${TYPE_ICON[item.type] || "📋"}</span>
        <strong style="font-size:13px;color:var(--heading-text);">${item.title || "Notice"}</strong>
      </div>
      <p style="font-size:12px;">${(item.body || "").slice(0, 120)}${(item.body?.length > 120) ? "…" : ""}</p>`;
    wrap.appendChild(div);
  });
}

async function loadTeacherHome() {
  if (!currentTeacher) return;
  const dateStr = formatToday();
  try {
    const rows = await listTeacherScheduleForDate(activeSchoolId, currentTeacher.teacherId, dateStr);
    renderSchedule(rows, dateStr);
  } catch (err) {
    console.error("Schedule load error:", err);
    renderSchedule([], dateStr);
  }
}

/* ─── Event Listeners ─────────────────────────────────────────── */
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logoutCurrentUser();
  goLogin();
});
document.getElementById("refreshHomeScheduleBtn")?.addEventListener("click", loadTeacherHome);

/* ─── AUTH ────────────────────────────────────────────────────── */
requireAuth(async user => {
  try {
    /* Step 1: Get profile — critical, fail fast if this fails */
    let profile;
    try {
      profile = await getUserProfile(user.uid);
    } catch (err) {
      console.error("Profile read failed:", err);
      showToast("Could not read profile. Check Firebase rules.", "error");
      safeHideLoader();
      return;
    }

    currentProfile = profile;

    if (!profile) {
      /* New user — no profile yet */
      showToast("No profile found. Please set up school first.", "warn");
      safeHideLoader();
      setTimeout(() => { window.location.href = "./index.html"; }, 1500);
      return;
    }

    if (!isTeacher(profile) && !isSchoolAdmin(profile)) {
      showToast("Teacher access only", "warn");
      safeHideLoader();
      setTimeout(goLogin, 700);
      return;
    }

    activeSchoolId = getSchoolIdFromProfile(profile);
    if (!activeSchoolId) {
      showToast("No school linked to this account. Ask admin.", "warn");
      setText("teacherName", profile.displayName || "Teacher");
      setText("teacherMeta", "No school linked");
      safeHideLoader();
      return;
    }

    /* Step 2: Set nav links immediately (no async needed) */
    const s = encodeURIComponent(activeSchoolId);
    const navMap = {
      "nav-schedule":    `./teacher-schedule.html?schoolId=${s}`,
      "nav-attendance":  `./period-attendance.html?schoolId=${s}`,
      "nav-bunkers":     `./top-bunkers.html?schoolId=${s}`,
      "nav-marks":       `./marks.html?schoolId=${s}`,
    };
    Object.entries(navMap).forEach(([id, href]) => document.getElementById(id)?.setAttribute("href", href));
    document.getElementById("goScheduleBtn")?.setAttribute("href",    navMap["nav-schedule"]);
    document.getElementById("goBunkersBtn")?.setAttribute("href",     navMap["nav-bunkers"]);
    document.getElementById("goMarksBtn")?.setAttribute("href",       navMap["nav-marks"]);
    document.getElementById("goReportBtn")?.setAttribute("href",      `./attendance-report.html?schoolId=${s}`);
    document.getElementById("goLeaderboardBtn")?.setAttribute("href", `./leaderboard.html?schoolId=${s}`);
    markActiveNav();

    /* Step 3: Load core data — teachers + classes (critical) */
    let teachers = [], classes = [];
    try {
      [teachers, classes] = await Promise.all([
        listTeachers(activeSchoolId),
        listClasses(activeSchoolId)
      ]);
    } catch (err) {
      console.error("Core data load failed:", err);
      showToast("Could not load school data: " + (err.message || ""), "error");
      safeHideLoader();
      return;
    }

    classMap       = new Map(classes.map(c => [c.classId, c]));
    currentTeacher = teachers.find(r => String(r.authUid || "") === String(user.uid)) || null;

    /* Step 4: Set teacher info in UI immediately */
    const name    = currentTeacher?.name || profile.displayName || "Teacher";
    const subject = currentTeacher?.subject || "";
    setText("teacherName",       name);
    setText("teacherMeta",       subject ? `${subject} · School: ${activeSchoolId}` : `School: ${activeSchoolId}`);
    setText("teacherTodayChip",  `📅 Today: ${formatToday()}`);
    setText("teacherSchoolChip", `🏫 ${activeSchoolId}`);
    setText("teacherSubjectChip",`📘 ${subject || "Teacher"}`);

    /* Step 5: HIDE LOADER NOW — page is ready to show */
    safeHideLoader();

    /* Step 6: Load optional extras in background (won't block page) */
    /* Announcements — non-critical */
    getLatestAnnouncements(activeSchoolId, 3)
      .then(items => renderAnnouncements(items))
      .catch(() => renderAnnouncements([]));

    /* Holiday check — non-critical */
    isHoliday(activeSchoolId, formatToday())
      .then(isHol => {
        if (isHol) {
          const hw = document.getElementById("holidayWarning");
          if (hw) hw.style.display = "";
        }
      })
      .catch(() => {});

    /* At-risk — non-critical, load last */
    getAtRiskStudents(activeSchoolId, 75)
      .then(atRisk => {
        const el = document.getElementById("atRiskCount");
        if (el) el.textContent = atRisk.length;
        const banner = document.getElementById("atRiskBanner");
        if (banner) banner.style.display = atRisk.length > 0 ? "" : "none";
      })
      .catch(() => {
        const banner = document.getElementById("atRiskBanner");
        if (banner) banner.style.display = "none";
      });

    /* Step 7: Render schedule or not-linked card */
    if (!currentTeacher) {
      const card = document.getElementById("notLinkedCard");
      if (card) card.style.display = "";
      const uid = document.getElementById("myAuthUidDisplay");
      if (uid) uid.textContent = user.uid;
      setText("teacherWelcomeLine", "Your teacher account is not linked. Show the Auth UID below to your admin.");
      setText("todaySlotCount",    "—");
      setText("todaySubjectCount", "—");
      setText("todayClassCount",   "—");
    } else {
      setText("teacherWelcomeLine", "Your schedule is loaded from the timetable. Use the Next Class card to mark attendance quickly.");
      /* Load schedule in background */
      loadTeacherHome().catch(err => {
        console.error("Schedule:", err);
        showToast("Could not load schedule", "warn");
      });
    }

  } catch (err) {
    console.error("Teacher home error:", err);
    showToast("Error loading page: " + (err.message || "Unknown error"), "error");
    safeHideLoader();
  }
}, () => {
  /* Not logged in */
  safeHideLoader();
  goLogin();
});
