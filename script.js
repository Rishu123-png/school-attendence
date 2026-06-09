// script.js — Master script (all bugs fixed + all new features)
import { initSidebar } from "./sidebar.js";
import { initTheme }   from "./theme.js";
import { auth, db }    from "./firebase.js";
import { showToast, showConfirm, showPrompt, showLoading, hideLoading } from "./toast.js";
import {
  buildBadgeHtml,
  escapeHtml,
  isValidClassName,
  isValidStudentName,
  normalizeClassName,
  normalizeStudentName,
  safeWindowTitle
} from "./security.js";
import { logAudit } from "./audit.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  ref, onValue, get, set, push
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ── GLOBAL STATE ─────────────────────────────────────────── */
let currentTeacherUser = null;
let teacherProfile     = null;
let currentUserProfile = null;
let allStudents        = {};
let selectedStudentId  = null;
let currentClassFilter = "";

onAuthStateChanged(auth, (user) => { currentTeacherUser = user; });

async function fetchUserProfile(uid = auth.currentUser?.uid) {
  if (!uid) return null;
  try {
    const snap = await get(ref(db, `userProfiles/${uid}`));
    return snap.exists() ? snap.val() : null;
  } catch (error) {
    console.warn('user-profile-load-failed', error);
    return null;
  }
}

async function hydrateCurrentUserProfile(uid = auth.currentUser?.uid) {
  currentUserProfile = await fetchUserProfile(uid);
  return currentUserProfile;
}

function buildSchoolAdminUrl(profile = currentUserProfile) {
  const schoolId = profile?.schoolId || new URLSearchParams(window.location.search).get('schoolId') || '';
  return schoolId ? `school-admin.html?schoolId=${encodeURIComponent(schoolId)}` : 'school-setup.html';
}

function updateDashboardRoleUi() {
  const schoolAdminBtn = document.getElementById('schoolAdminShortcut');
  const teacherScheduleBtn = document.getElementById('teacherScheduleShortcut');
  const roleLine = document.getElementById('dashboardRoleLine');

  const isActualSchoolAdmin = currentUserProfile?.role === 'schoolAdmin' && !currentUserProfile?.teacherId;
  if (schoolAdminBtn) schoolAdminBtn.style.display = isActualSchoolAdmin ? '' : 'none';
  if (teacherScheduleBtn) teacherScheduleBtn.style.display = currentUserProfile?.schoolId ? '' : 'none';

  if (roleLine) {
    if (isActualSchoolAdmin) {
      roleLine.innerText = 'You are logged in as School Admin. Use School Admin tools and teacher tools from here.';
    } else if (currentUserProfile?.schoolId) {
      roleLine.innerText = 'Your school workspace is active. Open your schedule to view assigned periods and mark attendance.';
    } else {
      roleLine.innerText = 'Track classes, attendance, and performance.';
    }
  }
}

window.goToSchoolAdmin = async function () {
  if (!currentUserProfile) await hydrateCurrentUserProfile();
  window.location.href = buildSchoolAdminUrl(currentUserProfile);
};

window.goToTeacherSchedule = async function () {
  if (!currentUserProfile) await hydrateCurrentUserProfile();
  if (!currentUserProfile?.schoolId) {
    showToast('No school is linked to this account yet.', 'warning');
    return;
  }
  window.location.href = `teacher-schedule.html?schoolId=${encodeURIComponent(currentUserProfile.schoolId)}`;
};

/* ── AUTH GUARD ───────────────────────────────────────────── */
function requireAuth(cb) {
  if (auth.currentUser) { cb(); return; }
  const unsub = onAuthStateChanged(auth, user => {
    if (user) { unsub(); cb(); }
    else { unsub(); window.location.href = 'index.html'; }
  });
}

/* ── LOGIN / LOGOUT ───────────────────────────────────────── */
window.login = async function () {
  const email    = (document.getElementById('email')?.value || '').trim();
  const password = document.getElementById('password')?.value || '';
  if (!email || !password) { showToast('Enter email and password', 'warning'); return; }
  showLoading('Signing in…');
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await fetchUserProfile(userCredential.user.uid);
    const pendingRedirect = localStorage.getItem('postLoginRedirect') || '';
    if (pendingRedirect) {
      localStorage.removeItem('postLoginRedirect');
      window.location.href = pendingRedirect;
      return;
    }
    if (profile?.role === 'schoolAdmin' && !profile?.teacherId) {
      window.location.href = buildSchoolAdminUrl(profile);
      return;
    }
    if (profile?.schoolId) {
      window.location.href = `teacher-schedule.html?schoolId=${encodeURIComponent(profile.schoolId)}`;
      return;
    }
    window.location.href = 'dashboard.html';
  } catch (err) {
    hideLoading();
    showToast(err.message || 'Login failed', 'error');
  }
};

window.logout = async function () {
  try { await signOut(auth); } catch (_) {}
  window.location.href = 'index.html';
};

/* ── TEACHER PROFILE ──────────────────────────────────────── */
function loadTeacherProfile() {
  const uid = auth.currentUser.uid;
  onValue(ref(db, `teachers/${uid}`), snap => {
    const data = snap.val() || {};
    teacherProfile = data;
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    const fallbackName = currentUserProfile?.displayName || 'Teacher';
    const fallbackSubject = currentUserProfile?.role === 'schoolAdmin' ? 'School Admin' : '';
    setText('teacherName', data.name || fallbackName);
    setText('teacherSubject', data.subject || fallbackSubject);
    setText('teacherSubjectAdd', data.subject || fallbackSubject);
    setText('teacherNameDisplay', data.name || fallbackName);

    const classes = data.classes || {};
    const ids = Array.isArray(classes)
      ? classes
      : (Object.keys(classes).length ? Object.values(classes) : []);

    ['classSelect','classSelectAdd','analyticsClassSelect'].forEach(selId => {
      const sel = document.getElementById(selId);
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = '<option value="">-- Select class --</option>';
      ids.forEach(c => { const o = document.createElement('option'); o.value = c; o.innerText = c; sel.appendChild(o); });
      if (cur) sel.value = cur;
    });
  });
}

/* ── DASHBOARD ────────────────────────────────────────────── */
window.initDashboardPage = function () {
  requireAuth(async () => {
    await hydrateCurrentUserProfile();
    initSidebar();
    initTheme();
    loadTeacherProfile();
    updateDashboardRoleUi();

    // Attendance summary card for current month
    renderMonthlySummary();

    const classSel = document.getElementById('classSelect');
    if (classSel) {
      classSel.onchange = () => {
        currentClassFilter = classSel.value || '';
        loadStudents(currentClassFilter);
      };
    }

    // Search box
    const searchBox = document.getElementById('studentSearch');
    if (searchBox) {
      searchBox.oninput = () => renderStudentsTable(currentClassFilter);
    }

    loadStudents();
    setTimeout(checkYearlyPromotion, 800);
  });
};

// FIX #17: sidebarGoAttendance was referenced in dashboard.html but never defined
window.sidebarGoAttendance = function () {
  const classSel = document.getElementById('classSelect');
  const cls = classSel ? classSel.value : currentClassFilter;
  if (!cls) { showToast('Select a class first', 'warning'); return; }
  localStorage.setItem('selectedClass', cls);
  localStorage.removeItem('selectedStudentId');
  window.location.href = 'mark-attendance.html';
};

window.goToMarkAttendance = function () {
  const classSel = document.getElementById('classSelect');
  const cls = classSel ? classSel.value : currentClassFilter;
  if (!cls) { showToast('Select a class first', 'warning'); return; }
  localStorage.setItem('selectedClass', cls);
  localStorage.removeItem('selectedStudentId');
  window.location.href = 'mark-attendance.html';
};

// NEW: Monthly summary card
async function renderMonthlySummary() {
  const card = document.getElementById('monthlySummaryCard');
  if (!card || !auth.currentUser) return;
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = String(now.getMonth() + 1).padStart(2, '0');
  const month = `${y}-${m}`;
  const snap  = await get(ref(db, 'students'));
  const data  = snap.val() || {};
  let totalPresent = 0, totalAbsent = 0, studentCount = 0;
  for (const id in data) {
    const s = data[id];
    if (!s || s.teacher !== auth.currentUser.uid) continue;
    studentCount++;
    for (const date in (s.attendance || {})) {
      if (date.startsWith(month)) {
        if (s.attendance[date] === 'present') totalPresent++;
        else totalAbsent++;
      }
    }
  }
  const total = totalPresent + totalAbsent;
  const pct   = total ? Math.round((totalPresent / total) * 100) : 0;
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div><strong style="font-size:16px;">📅 This Month — ${month}</strong>
        <div style="color:var(--muted);margin-top:4px;">${studentCount} students tracked</div></div>
      <div style="display:flex;gap:16px;">
        <div style="text-align:center"><div style="font-size:22px;color:#4ad07a;">${totalPresent}</div><div style="color:var(--muted);font-size:12px;">Present</div></div>
        <div style="text-align:center"><div style="font-size:22px;color:#ff6b6b;">${totalAbsent}</div><div style="color:var(--muted);font-size:12px;">Absent</div></div>
        <div style="text-align:center"><div style="font-size:22px;color:${pct>=75?'#4ad07a':pct>=50?'#f39c12':'#ff6b6b'}">${pct}%</div><div style="color:var(--muted);font-size:12px;">Avg</div></div>
      </div>
    </div>`;
}

export async function loadStudents(selectedClass = '') {
  currentClassFilter = selectedClass || currentClassFilter || '';
  showLoading('Loading students…');
  try {
    const snap  = await get(ref(db, 'students'));
    allStudents = snap.val() || {};
    renderStudentsTable(currentClassFilter);
    // Update count badge
    const countEl = document.getElementById('studentsCount');
    if (countEl) {
      const visible = Object.values(allStudents).filter(s =>
        s && (!currentClassFilter || s.class === currentClassFilter) &&
        (!auth.currentUser || !s.teacher || s.teacher === auth.currentUser.uid)
      );
      countEl.innerText = visible.length;
    }
  } catch (err) {
    showToast('Failed to load students', 'error');
  } finally {
    hideLoading();
  }
}

// FIX #18: renderStudentsTable now properly uses selectedClass + search filter
function renderStudentsTable(selectedClass = '') {
  const table     = document.getElementById('studentsTable');
  if (!table) return;
  const searchVal = (document.getElementById('studentSearch')?.value || '').toLowerCase();

  table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Attendance</th><th>Absences</th><th>Actions</th></tr>`;
  if (!allStudents) return;

  const now   = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  for (const id in allStudents) {
    const s = allStudents[id];
    if (!s) continue;
    if (selectedClass && s.class !== selectedClass) continue;
    if (s.teacher && auth.currentUser && s.teacher !== auth.currentUser.uid) continue;
    if (searchVal && !(s.name||'').toLowerCase().includes(searchVal)) continue;

    // NEW: attendance % badge
    const att = s.attendance || {};
    const monthEntries = Object.keys(att).filter(d => d.startsWith(month));
    const present = monthEntries.filter(d => att[d] === 'present').length;
    const total   = monthEntries.length;
    const pct     = total ? Math.round((present / total) * 100) : null;
    const badgeColor = pct === null ? '#888' : pct >= 75 ? '#4ad07a' : pct >= 50 ? '#f39c12' : '#ff6b6b';
    const badgeText  = pct === null ? 'No data' : `${pct}%`;
    const absences   = Object.values(att).filter(v => v === 'absent').length;

    const row = table.insertRow();
    row.insertCell(0).innerText = s.name || '';
    row.insertCell(1).innerText = s.class || '';

    // Attendance badge cell
    const attCell = row.insertCell(2);
    attCell.innerHTML = buildBadgeHtml(badgeText, badgeColor);

    row.insertCell(3).innerText = absences;

    const ac = row.insertCell(4);
    ac.style.display = 'flex';
    ac.style.gap = '6px';
    ac.style.flexWrap = 'wrap';

    if (!s.teacher) {
      const claimBtn = makeBtn('Claim', '#6b6cff', () => claimStudent(id));
      ac.appendChild(claimBtn);
    }

    // FIX #5: Edit uses showPrompt (no nested function bug)
    const editBtn = makeBtn('✏️ Edit', '#37d6ff', () => {
      showPrompt('Edit student name', s.name || '', async (newName) => {
        if (!newName) return;
        const cleanedName = normalizeStudentName(newName);
        if (!isValidStudentName(cleanedName)) {
          showToast('Use 2-60 valid characters for the student name.', 'warning');
          return;
        }
        showLoading('Saving…');
        try {
          await set(ref(db, `students/${id}/name`), cleanedName);
          await logAudit('student.update', { studentId: id, field: 'name' });
          showToast('Student updated!');
          loadStudents(currentClassFilter);
        } catch (err) { showToast('Failed to update', 'error'); }
        finally { hideLoading(); }
      });
    });
    ac.appendChild(editBtn);

    const delBtn = makeBtn('🗑️ Delete', '#ff6b6b', () => {
      showConfirm(`Delete "${s.name}"? This cannot be undone.`, async () => {
        showLoading('Deleting…');
        try {
          await set(ref(db, `students/${id}`), null);
          await logAudit('student.delete', { studentId: id, studentName: s.name || '' });
          showToast('Student deleted', 'warning');
          loadStudents(currentClassFilter);
        } catch (err) { showToast('Delete failed', 'error'); }
        finally { hideLoading(); }
      });
    });
    ac.appendChild(delBtn);

    const markBtn = makeBtn('📅 Attendance', '#ff6bc4', () => {
      localStorage.removeItem('selectedClass');
      localStorage.setItem('selectedStudentId', id);
      window.location.href = 'mark-attendance.html';
    });
    markBtn.disabled = !(s.teacher && auth.currentUser && s.teacher === auth.currentUser.uid);
    ac.appendChild(markBtn);
  }
}

function makeBtn(label, color, onclick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = `padding:6px 12px;border-radius:8px;border:none;background:${color}22;
    color:${color};cursor:pointer;font-size:12px;font-weight:600;border:1px solid ${color}44;transition:0.2s;`;
  b.onmouseover = () => b.style.background = `${color}44`;
  b.onmouseout  = () => b.style.background = `${color}22`;
  b.onclick = onclick;
  return b;
}

/* ── ADD STUDENT ──────────────────────────────────────────── */
window.initAddStudentsPage = function () {
  requireAuth(() => {
    initSidebar();
    initTheme();
    loadTeacherProfile();
  });
};

window.addStudent = async function () {
  if (!auth.currentUser) { window.location.href = 'index.html'; return; }
  const name = normalizeStudentName(document.getElementById('studentName')?.value || '');
  const cls  = normalizeClassName(document.getElementById('classSelectAdd')?.value || '');
  if (!name || !cls) { showToast('Enter student name and class', 'warning'); return; }
  if (!isValidStudentName(name)) { showToast('Enter a valid student name', 'warning'); return; }
  if (!isValidClassName(cls)) { showToast('Enter a valid class name', 'warning'); return; }
  showLoading('Adding student…');
  try {
    const subj   = teacherProfile?.subject || '';
    const newRef = push(ref(db, 'students'));
    await set(newRef, { name, class: cls, subject: subj, teacher: auth.currentUser.uid, attendance: {} });
    await logAudit('student.add', { studentId: newRef.key, className: cls });
    showToast('Student added successfully!');
    setTimeout(() => window.location.href = 'dashboard.html', 800);
  } catch (err) {
    showToast('Failed to add student', 'error');
  } finally { hideLoading(); }
};

/* ── CLAIM STUDENT ────────────────────────────────────────── */
window.claimStudent = async function (studentId) {
  if (!auth.currentUser) { showToast('Login required', 'warning'); return; }
  showConfirm('Claim this student and assign to your account?', async () => {
    showLoading();
    try {
      await set(ref(db, `students/${studentId}/teacher`), auth.currentUser.uid);
      await logAudit('student.claim', { studentId });
      showToast('Student claimed!');
      loadStudents(currentClassFilter);
    } catch (err) { showToast('Failed to claim student', 'error'); }
    finally { hideLoading(); }
  });
};

/* ── MARK ATTENDANCE PAGE ─────────────────────────────────── */
window.initMarkAttendancePage = async function () {
  requireAuth(async () => {
    initSidebar();
    initTheme();

    const classForMark = localStorage.getItem('selectedClass');
    selectedStudentId  = localStorage.getItem('selectedStudentId') || null;

    if (classForMark) { await loadClassAttendanceUI(classForMark); return; }

    if (!selectedStudentId) {
      showToast('No student selected. Go to dashboard.', 'warning');
      setTimeout(() => window.location.href = 'dashboard.html', 1500);
      return;
    }

    showLoading('Loading student…');
    try {
      const snap    = await get(ref(db, `students/${selectedStudentId}`));
      const student = snap.val() || {};
      const el      = document.getElementById('studentNameLabel');
      if (el) el.innerText = student.name || '';

      // NEW: Auto-set today's date / default month
      const now          = new Date();
      const defaultMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const mp           = document.getElementById('monthPickerMark');
      if (mp) mp.value = defaultMonth;

      document.getElementById('singleStudentUI').style.display  = 'block';
      document.getElementById('classAttendanceUI').style.display = 'none';
      await loadMarkAttendanceMonth();
    } catch (err) {
      showToast('Failed to load student', 'error');
      setTimeout(() => window.location.href = 'dashboard.html', 1500);
    } finally { hideLoading(); }
  });
};

window.loadMarkAttendanceMonth = async function () {
  const mp    = document.getElementById('monthPickerMark');
  const month = mp?.value;
  if (!selectedStudentId) return;
  showLoading('Loading attendance…');
  try {
    const snap      = await get(ref(db, `students/${selectedStudentId}`));
    const student   = snap.val() || {};
    const attendance = student.attendance || {};
    const table     = document.getElementById('markAttendanceTable');
    if (!table) return;
    table.innerHTML = `<tr><th>Date</th><th>Status</th><th>Present</th><th>Absent</th></tr>`;

    const [y, m] = (month || '').split('-').map(Number);
    if (!y || !m) {
      Object.keys(attendance).sort().forEach(date => buildAttRow(table, date, attendance[date]));
      return;
    }
    const days = new Date(y, m, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const dd = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      buildAttRow(table, dd, attendance[dd] || '');
    }
  } catch (err) { showToast('Failed to load attendance', 'error'); }
  finally { hideLoading(); }
};

function buildAttRow(table, date, status) {
  const r     = table.insertRow();
  r.insertCell(0).innerText = date;
  const stCell = r.insertCell(1);
  stCell.innerText = status || '—';
  if (status === 'present') stCell.style.color = '#4ad07a';
  if (status === 'absent')  stCell.style.color = '#ff6b6b';

  const markAtt = async (val) => {
    await set(ref(db, `students/${selectedStudentId}/attendance/${date}`), val);
    await logAudit('attendance.single.mark', { studentId: selectedStudentId, date, status: val });
    window.loadMarkAttendanceMonth();
  };

  const pb = makeBtn('Present', '#4ad07a', () => markAtt('present'));
  r.insertCell(2).appendChild(pb);
  const ab = makeBtn('Absent', '#ff6b6b', () => markAtt('absent'));
  r.insertCell(3).appendChild(ab);
}

/* CLASS MODE */
async function loadClassAttendanceUI(className) {
  document.getElementById('classAttendanceUI').style.display  = 'block';
  document.getElementById('singleStudentUI').style.display    = 'none';
// NEW: Auto-set today's date
  const today = todayDateString();
  const safeClassName = escapeHtml(className);

  document.getElementById('classAttendanceUI').innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <h2 style="margin:0;">📋 Class: <span style="color:#ff6bc4">${safeClassName}</span></h2>
        <button class="btn-cta" id="viewClassAnalyticsBtn">📊 Analytics</button>
      </div>
      <div style="margin-top:12px;">
        <label>Date</label>
        <input id="attendanceDate" type="date" value="${today}" style="margin-left:8px;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.07);color:#fff;">
      </div>
    </div>
    <div class="card" style="margin-top:12px;">
      <div class="table-wrap"><table id="classAttendanceTable"><tr><th>Name</th><th>Present</th><th>Absent</th></tr></table></div>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
        <button class="btn-cta" id="saveClassAttendanceBtn">💾 Save Attendance</button>
        <button class="btn-cta" id="cancelClassAttendanceBtn">⬅ Back</button>
        <button class="btn-cta" id="exportClassCSVBtn">📥 Export CSV</button>
      </div>
    </div>`;

  document.getElementById('viewClassAnalyticsBtn').onclick = () => {
    localStorage.setItem('analyticsClass', className);
    window.location.href = 'analytics.html';
  };
  document.getElementById('cancelClassAttendanceBtn').onclick = () => {
    localStorage.removeItem('selectedClass');
    window.location.href = 'dashboard.html';
  };

  showLoading('Loading class…');
  try {
    const snap = await get(ref(db, 'students'));
    const data = snap.val() || {};
    const rows = [];
    for (const id in data) {
      const s = data[id];
      if (!s || s.class !== className) continue;
      if (!(s.teacher && s.teacher === auth.currentUser.uid)) continue;
      rows.push({ id, name: s.name || '' });
    }

    const table = document.getElementById('classAttendanceTable');
    if (rows.length === 0) {
      const r = table.insertRow(); r.insertCell(0).colSpan = 3;
      r.cells[0].innerText = 'No students found in this class.';
    } else {
      rows.forEach(st => {
        const r = table.insertRow();
        r.insertCell(0).innerText = st.name;
        const pi = document.createElement('input'); pi.type='radio'; pi.name=`att_${st.id}`; pi.value='present'; pi.checked=true;
        r.insertCell(1).appendChild(pi);
        const ai = document.createElement('input'); ai.type='radio'; ai.name=`att_${st.id}`; ai.value='absent';
        r.insertCell(2).appendChild(ai);
        r.dataset.studentId = st.id;
      });
    }
document.getElementById('saveClassAttendanceBtn').onclick = async () => {
      const dateVal = document.getElementById('attendanceDate').value || today;
      showLoading('Saving…');
      try {
        for (const st of rows) {
          const sel = document.querySelector(`input[name="att_${st.id}"]:checked`);
          await set(ref(db, `students/${st.id}/attendance/${dateVal}`), sel ? sel.value : 'present');
        }
        await logAudit('attendance.class.mark', { className, date: dateVal, totalStudents: rows.length });
        showToast(`Attendance saved for ${dateVal}!`);
        localStorage.removeItem('selectedClass');
        setTimeout(() => window.location.href = 'dashboard.html', 800);
      } catch (err) { showToast('Failed to save attendance', 'error'); }
      finally { hideLoading(); }
    };

    document.getElementById('exportClassCSVBtn').onclick = () => {
      const dateVal = document.getElementById('attendanceDate').value || today;
      const csvRows = rows.map(st => {
        const sel = document.querySelector(`input[name="att_${st.id}"]:checked`);
        return [st.name, st.id, sel ? sel.value : 'present'];
      });
      const csv = tableToCSV(['Name','StudentId','Status'], csvRows);
      downloadFile(`class_attendance_${dateVal}.csv`, csv, 'text/csv');
    };
  } catch (err) { showToast('Failed to load class', 'error'); }
  finally { hideLoading(); }
}

function todayDateString() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}
/* ── EXPORTS ──────────────────────────────────────────────── */
function tableToCSV(headerRow, rows) {
  return [headerRow.join(',')]
    .concat(rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')))
    .join('\n');
}

function downloadFile(filename, content, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

window.exportAttendanceCSV = async function () {
  if (!selectedStudentId) { showToast('No student selected', 'warning'); return; }
  const snap      = await get(ref(db, `students/${selectedStudentId}`));
  const student   = snap.val() || {};
  const attendance = student.attendance || {};
  const rows      = Object.keys(attendance).sort().map(d => [d, attendance[d]]);
  downloadFile(`${student.name||'student'}_attendance.csv`, tableToCSV(['Date','Status'], rows));
  showToast('CSV downloaded!');
};

window.exportAttendanceExcel = async function () {
  if (!selectedStudentId) { showToast('No student selected', 'warning'); return; }
  const snap      = await get(ref(db, `students/${selectedStudentId}`));
  const student   = snap.val() || {};
  const attendance = student.attendance || {};
  const rows      = Object.keys(attendance).sort().map(d => [d, attendance[d]]);
  downloadFile(`${student.name||'student'}_attendance.xls`, tableToCSV(['Date','Status'], rows), 'application/vnd.ms-excel');
  showToast('Excel downloaded!');
};

window.exportBunkersCSV = async function () {
  showLoading();
  try {
    const snap = await get(ref(db, 'students'));
    const data = snap.val() || {};
    const rows = [];
    for (const id in data) {
      const s = data[id];
      if (!s || !(s.teacher && s.teacher === auth.currentUser.uid)) continue;
      const absent = Object.values(s.attendance||{}).filter(v=>v==='absent').length;
      if (absent > 0) rows.push([s.name||'', s.class||'', s.subject||'', absent]);
    }
    if (!rows.length) { showToast('No absence data found', 'info'); return; }
    downloadFile('top_bunkers.csv', tableToCSV(['Name','Class','Subject','Absences'], rows));
    showToast('CSV downloaded!');
  } catch (err) { showToast('Export failed', 'error'); }
  finally { hideLoading(); }
};

window.printReport = function () {
  const table = document.getElementById('markAttendanceTable') || document.getElementById('attendanceMonthTable');
  if (!table) { showToast('Nothing to print', 'warning'); return; }
  const title = safeWindowTitle(document.getElementById('studentNameLabel')?.innerText || 'Attendance Report');
  const w = window.open('', '', 'width=900,height=700');
  w.document.write(`<h3>Monthly Attendance Report — ${escapeHtml(title)}</h3>${table.outerHTML}`);
  w.document.close(); w.print();
};

/* ── TOP BUNKERS PAGE ─────────────────────────────────────── */
window.initTopBunkersPage = function () {
  requireAuth(async () => {
    initTheme();
    showLoading('Loading…');
    try {
      const snap    = await get(ref(db, 'students'));
      const data    = snap.val() || {};
      const bunkers = [];
      for (const id in data) {
        const s = data[id];
        if (!s || s.teacher !== auth.currentUser.uid) continue;
        const absent = Object.values(s.attendance||{}).filter(v=>v==='absent').length;
        if (absent > 0) bunkers.push({ id, ...s, totalAbsent: absent });
      }
      bunkers.sort((a,b) => b.totalAbsent - a.totalAbsent);
      const table = document.getElementById('bunkersTable');
      if (!table) return;
      table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Subject</th><th>Absences</th></tr>`;
      bunkers.forEach(s => {
        const r  = table.insertRow();
        r.insertCell(0).innerText = s.name;
        r.insertCell(1).innerText = s.class;
        r.insertCell(2).innerText = s.subject;
        const c  = r.insertCell(3); c.innerText = s.totalAbsent;
        if (s.totalAbsent >= 3) c.style.color = '#ff6b6b';
      });
    } catch (err) { showToast('Failed to load data', 'error'); }
    finally { hideLoading(); }
  });
};
/* ── ANALYTICS PAGE ───────────────────────────────────────── */
window.initAnalyticsPage = function () {
  requireAuth(() => {
    initSidebar();
    initTheme();
    loadTeacherProfile();
    const now = new Date();
    const el  = document.getElementById('analyticsMonth');
    if (el) el.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const cls = localStorage.getItem('analyticsClass');
    if (cls) {
      const sel = document.getElementById('analyticsClassSelect');
      if (sel) sel.value = cls;
      localStorage.removeItem('analyticsClass');
    }
  });
};

window.renderAnalytics = async function () {
  const className = document.getElementById('analyticsClassSelect')?.value;
  const month     = document.getElementById('analyticsMonth')?.value;
  if (!className) { showToast('Select a class', 'warning'); return; }
  if (!month)     { showToast('Select a month', 'warning'); return; }

  const safeClassName = escapeHtml(className);
  const safeMonth = escapeHtml(month);

  showLoading('Generating analytics…');
  try {
    const snap     = await get(ref(db, 'students'));
    const data     = snap.val() || {};
    const students = [];
    for (const id in data) {
      const s = data[id];
      if (!s || s.class !== className || s.teacher !== auth.currentUser.uid) continue;
      students.push({ id, name: s.name || '', attendance: s.attendance || {} });
    }

    const [y, m]    = month.split('-').map(Number);
    const mdays     = new Date(y, m, 0).getDate();
    const totals    = { present: 0, absent: 0, dayTotals: Array(mdays).fill(0) };
    const studentTotals = [];

    for (const s of students) {
      let sp = 0, sa = 0;
      for (let d = 1; d <= mdays; d++) {
        const dd = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const st = s.attendance[dd];
        if (st === 'present') { sp++; totals.present++; totals.dayTotals[d-1]++; }
        if (st === 'absent')  { sa++; totals.absent++; }
      }
      studentTotals.push({ id: s.id, name: s.name, present: sp, absent: sa, totalDays: mdays, attObj: s.attendance });
    }

    const area = document.getElementById('chartsArea');
    area.innerHTML = '';

    const pct = (students.length * mdays) ? Math.round((totals.present / (students.length * mdays)) * 100) : 0;
    const summary = document.createElement('div'); summary.className = 'card';
    summary.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div><strong>${safeClassName} — ${safeMonth}</strong><div style="color:var(--muted)">${students.length} students · ${mdays} days</div></div>
        <div style="display:flex;gap:16px;">
          <div style="text-align:center;"><div style="font-size:22px;color:#4ad07a">${totals.present}</div><div style="color:var(--muted);font-size:12px">Present</div></div>
          <div style="text-align:center;"><div style="font-size:22px;color:#ff6b6b">${totals.absent}</div><div style="color:var(--muted);font-size:12px">Absent</div></div>
          <div style="text-align:center;"><div style="font-size:22px;color:${pct>=75?'#4ad07a':pct>=50?'#f39c12':'#ff6b6b'}">${pct}%</div><div style="color:var(--muted);font-size:12px">Overall</div></div>
        </div>
      </div>`;
    area.appendChild(summary);
// Bar chart
    const dayCard = document.createElement('div'); dayCard.className = 'card';
    dayCard.innerHTML = `<strong>Daily Present Count</strong>
      <div id="dayBar" style="margin-top:10px;display:flex;gap:4px;align-items:flex-end;height:120px;"></div>`;
    area.appendChild(dayCard);
    const dayBar = dayCard.querySelector('#dayBar');
    const maxDay = Math.max(...totals.dayTotals, 1);
    totals.dayTotals.forEach((v, i) => {
      const col = document.createElement('div');
      const h   = Math.round((v / maxDay) * 100);
      col.style.cssText = `flex:1;min-width:6px;height:${Math.max(6,h)}%;background:linear-gradient(180deg,#ff6bc4,#6b6cff);border-radius:4px;`;
      col.title = `Day ${i+1}: ${v} present`;
      dayBar.appendChild(col);
    });

    // Ranking table
    const rankCard = document.createElement('div'); rankCard.className = 'card';
    rankCard.innerHTML = `<strong>Student Attendance Ranking</strong>`;
    const tw = document.createElement('div'); tw.className = 'table-wrap';
    const t  = document.createElement('table');
    t.innerHTML = `<tr><th>#</th><th>Name</th><th>Present</th><th>Absent</th><th>%</th><th>Status</th></tr>`;
    studentTotals.sort((a,b) => b.present - a.present).forEach((s, idx) => {
      const p   = s.totalDays ? Math.round((s.present/s.totalDays)*100) : 0;
      const col = p >= 75 ? '#4ad07a' : p >= 50 ? '#f39c12' : '#ff6b6b';
      const label = p >= 75 ? '✅ Good' : p >= 50 ? '⚠️ Low' : '❌ Critical';
      const tr  = t.insertRow();
      tr.insertCell(0).innerText = idx + 1;
      tr.insertCell(1).innerText = s.name;
      tr.insertCell(2).innerText = s.present;
      tr.insertCell(3).innerText = s.absent;
      tr.insertCell(4).innerHTML = `<span style="color:${col};font-weight:600;">${p}%</span>`;
      tr.insertCell(5).innerHTML = `<span style="color:${col};font-size:12px;">${label}</span>`;
    });
    tw.appendChild(t); rankCard.appendChild(tw); area.appendChild(rankCard);

    // Controls
    const ctrl = document.createElement('div'); ctrl.className = 'action-row';
    const expBtn = document.createElement('button'); expBtn.className = 'btn-cta'; expBtn.innerText = '📥 Export Excel';
    expBtn.onclick = () => {
      const header = ['Name', ...Array.from({length:mdays},(_,i)=>`D${i+1}`)];
      const rows   = studentTotals.map(st => [st.name, ...Array.from({length:mdays},(_,i)=>{
        const dd = `${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
        return (st.attObj[dd]||'').substring(0,1);
      })]);
      downloadFile(`analytics_${className}_${month}.xls`, tableToCSV(header, rows), 'application/vnd.ms-excel');
      showToast('Excel downloaded!');
    };
    ctrl.appendChild(expBtn);

    const prtBtn = document.createElement('button'); prtBtn.className = 'btn-cta'; prtBtn.innerText = '🖨️ Print';
    prtBtn.onclick = () => {
      const w = window.open('', '', 'width=900,height=700');
      w.document.write(`<h3>Attendance — ${safeClassName} — ${safeMonth}</h3>${summary.outerHTML}${tw.outerHTML}`);
      w.document.close(); w.print();
    };
    ctrl.appendChild(prtBtn);
    area.appendChild(ctrl);

  } catch (err) { showToast('Failed to render analytics', 'error'); console.error(err); }
  finally { hideLoading(); }
};

window.openAnalyticsForStudent = function () {
  if (!selectedStudentId) { showToast('No student selected', 'warning'); return; }
  localStorage.setItem('analyticsStudentId', selectedStudentId);
  window.location.href = 'analytics.html';
};
/* ── YEARLY PROMOTION ─────────────────────────────────────── */
let promoStudents = [], promoIndex = 0, promoResults = {}, promoClassMap = {};

function getAcademicYear() {
  const now = new Date(); const m = now.getMonth() + 1;
  return m >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

function buildPromoClassMap(classList) {
  const grades  = classList.map(c => { const m = c.match(/^(\d+)/); return m ? parseInt(m[1]) : null; }).filter(g=>g!==null);
  const maxGrade = grades.length ? Math.max(...grades) : 0;
  const map = {};
  classList.forEach(cls => {
    const m = cls.match(/^(\d+)(.*)/);
    if (!m) { map[cls] = null; return; }
    map[cls] = parseInt(m[1]) >= maxGrade ? null : `${parseInt(m[1])+1}${m[2]}`;
  });
  return map;
}

// FIX #6: renamed checkAcademicYearAndPromote → checkYearlyPromotion (was never defined before)
async function checkYearlyPromotion() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  try {
    const snap    = await get(ref(db, `teachers/${uid}`));
    const teacher = snap.val() || {};
    const curYear = getAcademicYear();
    if (curYear <= (teacher.lastPromotionYear || 0)) return;
    const remindKey = `promoRemind_${uid}_${curYear}`;
    if (parseInt(localStorage.getItem(remindKey)||'0') >= 3) return;
    const studSnap   = await get(ref(db, 'students'));
    const allData    = studSnap.val() || {};
    const myStudents = [];
    for (const id in allData) {
      const s = allData[id];
      if (!s || s.teacher !== uid) continue;
      myStudents.push({ id, ...s });
    }
    if (!myStudents.length) return;
    const classes   = teacher.classes || {};
    let classList   = Array.isArray(classes) ? [...classes] : Object.values(classes);
    classList = classList.filter(Boolean);
    if (!classList.length) return;
    promoClassMap = buildPromoClassMap(classList);
    promoStudents = myStudents; promoIndex = 0; promoResults = {};
    const modal = document.getElementById('promotionModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('promoChoiceView').style.display  = 'block';
    document.getElementById('promoReviewView').style.display  = 'none';
    document.getElementById('promoDoneView').style.display    = 'none';
    const sub = document.getElementById('promoSubtitle');
    if (sub) sub.innerText = `Academic year ${curYear}–${curYear+1} detected. ${myStudents.length} student(s) to review.`;
  } catch (err) { console.error('checkYearlyPromotion', err); }
}
window.remindLaterPromotion = function () {
  const uid = auth.currentUser?.uid; if (!uid) return;
  const key = `promoRemind_${uid}_${getAcademicYear()}`;
  localStorage.setItem(key, String(parseInt(localStorage.getItem(key)||'0')+1));
  document.getElementById('promotionModal').style.display = 'none';
};
window.closePromotionModal = function () { document.getElementById('promotionModal').style.display = 'none'; };

window.startPromoteAll = async function () {
  const uid = auth.currentUser?.uid; if (!uid) return;
  const btn = document.getElementById('promoteAllBtn');
  if (btn) { btn.disabled=true; btn.innerText='Promoting…'; }
  showLoading('Promoting all students…');
  let promoted=0, graduated=0, unchanged=0;
  for (const s of promoStudents) {
    const next = promoClassMap[s.class];
    if (next === undefined) unchanged++;
    else if (next === null) graduated++;
    else { await set(ref(db, `students/${s.id}/class`), next); promoted++; }
  }
  await set(ref(db, `teachers/${uid}/lastPromotionYear`), getAcademicYear());
  await logAudit('promotion.bulk', { promoted, graduated, unchanged, academicYear: getAcademicYear() });
  hideLoading();
  document.getElementById('promoChoiceView').style.display = 'none';
  document.getElementById('promoDoneView').style.display   = 'block';
  let msg = `${promoted} promoted.`;
  if (graduated) msg += ` ${graduated} graduated (final class).`;
  if (unchanged) msg += ` ${unchanged} had unrecognized class.`;
  document.getElementById('promoDoneSummary').innerText = msg;
  loadStudents(currentClassFilter);
};

window.startReviewPromotion = function () {
  document.getElementById('promoChoiceView').style.display = 'none';
  document.getElementById('promoReviewView').style.display = 'block';
  document.getElementById('promoTotalNum').innerText = promoStudents.length;
  showPromoStudent(0);
};

function showPromoStudent(idx) {
  if (idx >= promoStudents.length) { finishReviewPromotion(); return; }
  promoIndex = idx;
  const s       = promoStudents[idx];
  const absences = Object.values(s.attendance||{}).filter(v=>v==='absent').length;
  const next     = promoClassMap[s.class];
  document.getElementById('promoCurrentNum').innerText       = idx+1;
  document.getElementById('promoStudentName').innerText      = s.name||'(No name)';
  document.getElementById('promoStudentClass').innerText     = s.class||'-';
  document.getElementById('promoStudentAbsences').innerText  = absences;
  const passBtn = document.getElementById('promoPassBtn');
  if (passBtn) passBtn.innerText = next===null ? '🎓 Graduate' : next ? `✅ Pass → Class ${next}` : '✅ Pass';
}
window.reviewDecision = function (decision) {
  promoResults[promoStudents[promoIndex].id] = decision;
  showPromoStudent(promoIndex + 1);
};

async function finishReviewPromotion() {
  document.getElementById('promoReviewView').style.display = 'none';
  document.getElementById('promoDoneView').style.display   = 'block';
  const uid = auth.currentUser?.uid;
  let promoted=0, failed=0, skipped=0;
  for (const s of promoStudents) {
    const dec = promoResults[s.id];
    if (dec === 'pass') { const next=promoClassMap[s.class]; if(next) { await set(ref(db,`students/${s.id}/class`),next); promoted++; } }
    else if (dec === 'fail') failed++;
    else skipped++;
  }
  if (uid) await set(ref(db,`teachers/${uid}/lastPromotionYear`), getAcademicYear());
  await logAudit('promotion.review.complete', { promoted, failed, skipped, academicYear: getAcademicYear() });
  document.getElementById('promoDoneSummary').innerText = `${promoted} promoted, ${failed} kept, ${skipped} skipped.`;
  loadStudents(currentClassFilter);
}

window.skipRemainingPromotion = async function () {
  const uid = auth.currentUser?.uid; if (!uid) return;
  for (const s of promoStudents) {
    if (promoResults[s.id]==='pass') { const next=promoClassMap[s.class]; if(next) await set(ref(db,`students/${s.id}/class`),next); }
  }
  localStorage.setItem(`promoRemind_${uid}_${getAcademicYear()}`, '2');
  await logAudit('promotion.review.partial-save', { academicYear: getAcademicYear() });
  document.getElementById('promotionModal').style.display = 'none';
  loadStudents(currentClassFilter);
};

window.fixTeacherIds = async function () {
  if (!auth.currentUser) { showToast('Login first', 'warning'); return; }
  showConfirm('Assign ALL unowned students to your account?', async () => {
    showLoading();
    try {
      const snap = await get(ref(db,'students'));
      const data = snap.val()||{};
      let reassigned = 0;
      for (const id in data) {
        const s = data[id];
        if (s && !s.teacher) {
          await set(ref(db,`students/${id}/teacher`), auth.currentUser.uid);
          reassigned++;
        }
      }
      await logAudit('student.reassign.bulk', { reassigned });
      showToast('Done! Students reassigned.');
      loadStudents(currentClassFilter);
    } catch (err) { showToast('Failed', 'error'); }
    finally { hideLoading(); }
  });
};