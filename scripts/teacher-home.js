/* ============================================================
   TEACHER HOME — v4 CLEAN FIX
   The loader overlay is in HTML. JS only toggles .hidden.
   Critical data loads first → loader hides → extras load in bg.
   Safety net forces hide after 8s if anything silently fails.
   ============================================================ */
import {
  initTheme, showToast, hideLoader,
  initOfflineBanner, markActiveNav,
  startLoaderSafetyNet, clearLoaderSafetyNet
} from "./app-shell.js";
import { requireAuth, logoutCurrentUser } from "../services/auth-service.js";
import { getUserProfile, isTeacher, isSchoolAdmin, getSchoolIdFromProfile } from "../services/profile-service.js";
import { listTeachers } from "../services/teacher-service.js";
import { listClasses } from "../services/class-service.js";
import { listTeacherScheduleForDate } from "../services/timetable-service.js";
import { getLatestAnnouncements } from "../services/announcement-service.js";
import { isHoliday } from "../services/holiday-service.js";
import { getAtRiskStudents } from "../services/attendance-service.js";

let schoolId = "", profile = null, teacher = null;
let classMap = new Map();
let _loaderDone = false;

/* Init immediately */
initTheme();
initOfflineBanner();
startLoaderSafetyNet(8000); /* Force-hide after 8s no matter what */

/* Network dot */
function syncNetDot() {
  const d = document.getElementById("netDot");
  if (d) d.classList.toggle("offline", !navigator.onLine);
}
window.addEventListener("online", syncNetDot);
window.addEventListener("offline", syncNetDot);
syncNetDot();

/* Hide loader exactly once */
function done() {
  if (_loaderDone) return;
  _loaderDone = true;
  clearLoaderSafetyNet();
  hideLoader();
}

function goLogin() { window.location.href = "./index.html"; }

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function set(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(v ?? "—");
}

function attUrl(row, date) {
  const u = new URL("./period-attendance.html", location.href);
  u.searchParams.set("schoolId", schoolId);
  u.searchParams.set("classId",  row.classId  || "");
  u.searchParams.set("date",     date         || "");
  u.searchParams.set("periodId", row.periodId || "");
  return u.toString();
}

/* ── Next class card ──────────────────────────────────────── */
function showNextCard(rows, date) {
  const card = document.getElementById("nextClassCard");
  const btn  = document.getElementById("nextAttendanceBtn");
  const qBtn = document.getElementById("goAttendanceBtn");
  if (!card || !btn || !qBtn) return;

  if (!rows.length) {
    card.style.display = "none";
    qBtn.disabled = true;
    return;
  }

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const next = rows.find(r => {
    if (!String(r.startTime || "").includes(":")) return false;
    const [h, m] = r.startTime.split(":").map(Number);
    return h * 60 + m >= nowMin;
  }) || rows[0];

  set("nextClassLabel",   `Class: ${classMap.get(next.classId)?.displayName || next.classId || "—"}`);
  set("nextTimeLabel",    `Time: ${[next.startTime, next.endTime].filter(Boolean).join(" - ") || "—"}`);
  set("nextSubjectLabel", `Subject: ${next.subjectName || next.subjectId || "—"}`);
  set("nextRoomLabel",    `Room: ${next.roomNo || "—"}`);

  const url = attUrl(next, date);
  btn.onclick  = () => { window.location.href = url; };
  qBtn.onclick = () => { window.location.href = url; };
  qBtn.disabled = false;
  card.style.display = "";
}

/* ── Schedule table ────────────────────────────────────────── */
function renderSchedule(rows, date) {
  showNextCard(rows, date);
  set("todaySlotCount",    rows.length);
  set("todaySubjectCount", rows.filter(r => r.slotType === "subject").length);
  set("todayClassCount",   rows.filter(r => r.slotType !== "subject").length);

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
    [
      { l: "Class",   v: classMap.get(row.classId)?.displayName || row.classId || "—" },
      { l: "Period",  v: row.label || `Period ${row.periodNo || ""}` },
      { l: "Type",    v: row.slotType === "subject" ? "Subject" : "Class" },
      { l: "Time",    v: [row.startTime, row.endTime].filter(Boolean).join(" - ") || "—" },
      { l: "Subject", v: row.subjectName || row.subjectId || "—" },
      { l: "Room",    v: row.roomNo || "—" },
    ].forEach(({ l, v }) => {
      const td = document.createElement("td");
      td.setAttribute("data-label", l);
      td.textContent = String(v || "—");
      tr.appendChild(td);
    });
    const atd = document.createElement("td");
    atd.setAttribute("data-label", "Action");
    const b = document.createElement("button");
    b.className = "btn-cta";
    b.textContent = "Mark";
    b.onclick = () => { window.location.href = attUrl(row, date); };
    atd.appendChild(b);
    tr.appendChild(atd);
    tbody.appendChild(tr);
  });
}

/* ── Announcements ─────────────────────────────────────────── */
function renderAnnouncements(items) {
  const wrap = document.getElementById("announcementsWrap");
  if (!wrap) return;
  if (!items || !items.length) {
    wrap.innerHTML = `<p style="color:var(--muted);font-size:13px;">No announcements yet.</p>`;
    return;
  }
  const ICON = { general: "📋", exam: "📝", event: "🎉", urgent: "🚨" };
  wrap.innerHTML = "";
  items.forEach(item => {
    const d = document.createElement("div");
    d.style.cssText = "background:var(--btn-ghost-bg);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:8px;";
    d.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <span>${ICON[item.type] || "📋"}</span>
        <strong style="font-size:13px;color:var(--heading-text);">${item.title || "Notice"}</strong>
      </div>
      <p style="font-size:12px;margin:0;">${(item.body || "").slice(0, 120)}${item.body?.length > 120 ? "…" : ""}</p>`;
    wrap.appendChild(d);
  });
}

async function loadSchedule() {
  if (!teacher) return;
  try {
    const rows = await listTeacherScheduleForDate(schoolId, teacher.teacherId, today());
    renderSchedule(rows, today());
  } catch (err) {
    console.error("Schedule error:", err);
    renderSchedule([], today());
  }
}

/* ── Events ────────────────────────────────────────────────── */
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await logoutCurrentUser();
  goLogin();
});
document.getElementById("refreshHomeScheduleBtn")?.addEventListener("click", loadSchedule);

/* ── Auth ──────────────────────────────────────────────────── */
requireAuth(async user => {

  /* 1. Get profile */
  let p;
  try {
    p = await getUserProfile(user.uid);
  } catch (err) {
    console.error("Profile read error:", err);
    showToast("Cannot read profile. Check Firebase rules.", "error");
    done();
    return;
  }

  profile = p;

  if (!p) {
    showToast("No profile found. Setting up school…", "warn");
    done();
    setTimeout(() => { window.location.href = "./index.html"; }, 1500);
    return;
  }

  if (!isTeacher(p) && !isSchoolAdmin(p)) {
    showToast("Teacher access only", "warn");
    done();
    setTimeout(goLogin, 700);
    return;
  }

  schoolId = getSchoolIdFromProfile(p);
  if (!schoolId) {
    set("teacherName", p.displayName || "Teacher");
    set("teacherMeta", "No school linked — ask admin");
    showToast("No school linked to this account.", "warn");
    done();
    return;
  }

  /* 2. Set nav links (sync — no Firebase needed) */
  const s = encodeURIComponent(schoolId);
  const nav = {
    "nav-schedule":   `./teacher-schedule.html?schoolId=${s}`,
    "nav-attendance": `./period-attendance.html?schoolId=${s}`,
    "nav-bunkers":    `./top-bunkers.html?schoolId=${s}`,
    "nav-marks":      `./marks.html?schoolId=${s}`,
  };
  Object.entries(nav).forEach(([id, href]) => document.getElementById(id)?.setAttribute("href", href));
  document.getElementById("goScheduleBtn")?.setAttribute("href",    nav["nav-schedule"]);
  document.getElementById("goBunkersBtn")?.setAttribute("href",     nav["nav-bunkers"]);
  document.getElementById("goMarksBtn")?.setAttribute("href",       nav["nav-marks"]);
  document.getElementById("goReportBtn")?.setAttribute("href",      `./attendance-report.html?schoolId=${s}`);
  document.getElementById("goLeaderboardBtn")?.setAttribute("href", `./leaderboard.html?schoolId=${s}`);
  markActiveNav();

  /* 3. Load teachers + classes (critical) */
  let teachers = [], classes = [];
  try {
    [teachers, classes] = await Promise.all([
      listTeachers(schoolId),
      listClasses(schoolId)
    ]);
  } catch (err) {
    console.error("Core data error:", err);
    showToast("Could not load school data: " + (err.message || ""), "error");
    done();
    return;
  }

  classMap = new Map(classes.map(c => [c.classId, c]));
  teacher  = teachers.find(r => String(r.authUid || "") === String(user.uid)) || null;

  /* 4. Fill teacher info */
  const name    = teacher?.name || p.displayName || "Teacher";
  const subject = teacher?.subject || "";
  set("teacherName",        name);
  set("teacherMeta",        subject ? `${subject} · School: ${schoolId}` : `School: ${schoolId}`);
  set("teacherTodayChip",   `📅 Today: ${today()}`);
  set("teacherSchoolChip",  `🏫 ${schoolId}`);
  set("teacherSubjectChip", `📘 ${subject || "Teacher"}`);

  /* 5. HIDE LOADER — page is now ready */
  done();

  /* 6. Show content depending on link status */
  if (!teacher) {
    const card = document.getElementById("notLinkedCard");
    if (card) card.style.display = "";
    const uidEl = document.getElementById("myAuthUidDisplay");
    if (uidEl) uidEl.textContent = user.uid;
    set("teacherWelcomeLine", "Your account is not linked yet. See the card below.");
    set("todaySlotCount", "—"); set("todaySubjectCount", "—"); set("todayClassCount", "—");
    renderAnnouncements([]);
  } else {
    set("teacherWelcomeLine", "Your schedule is loaded. Use the Next Class card to mark attendance quickly.");
    /* Load schedule — non-blocking */
    loadSchedule();
  }

  /* 7. Background extras — failures never block the page */
  getLatestAnnouncements(schoolId, 3)
    .then(items => renderAnnouncements(items))
    .catch(() => renderAnnouncements([]));

  isHoliday(schoolId, today())
    .then(isHol => {
      if (isHol) {
        const hw = document.getElementById("holidayWarning");
        if (hw) hw.style.display = "";
      }
    })
    .catch(() => {});

  getAtRiskStudents(schoolId, 75)
    .then(list => {
      set("atRiskCount", list.length);
      const banner = document.getElementById("atRiskBanner");
      if (banner) banner.style.display = list.length > 0 ? "" : "none";
    })
    .catch(() => {
      const banner = document.getElementById("atRiskBanner");
      if (banner) banner.style.display = "none";
    });

}, () => {
  /* Not logged in */
  done();
  goLogin();
});
