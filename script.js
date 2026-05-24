// script.js — Master script (fixed, no duplicates, all features)
console.log("script.js loaded ✅");

import { initSidebar } from "./sidebar.js";
import { initTheme }   from "./theme.js";
import { showToast, showConfirm, showLoader, hideLoader } from "./toast.js";

import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  ref, get, set, push, onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ═══════════════════════════════════════════════════════
   GLOBAL STATE
═══════════════════════════════════════════════════════ */
let currentTeacherUser = null;
let teacherProfile     = null;
let allStudents        = {};
let selectedStudentId  = null;
let currentClassFilter = '';
let currentSearchQuery = '';

onAuthStateChanged(auth, user => { currentTeacherUser = user; });

/* ── Auth guard — replaces all retry-loop patterns ── */
function requireAuth(cb) {
  onAuthStateChanged(auth, user => {
    if (!user) { window.location.href = 'index.html'; return; }
    cb(user);
  });
}

/* ═══════════════════════════════════════════════════════
   LOGIN / LOGOUT
═══════════════════════════════════════════════════════ */
window.login = async function () {
  const email    = (document.getElementById('email')?.value    || '').trim();
  const password =  document.getElementById('password')?.value || '';
  if (!email || !password) { showToast('Enter email and password', 'warning'); return; }
  showLoader('Signing in…');
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentTeacherUser = cred.user;
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Login failed', err);
    showToast(err.message || 'Login failed', 'error');
  } finally {
    hideLoader();
  }
};

window.logout = async function () {
  showLoader('Signing out…');
  try   { await signOut(auth); }
  catch (err) { console.warn('Sign out error', err); }
  finally {
    hideLoader();
    window.location.href = 'index.html';
  }
};

/* ═══════════════════════════════════════════════════════
   TEACHER PROFILE  (populates sidebar name/subject & class selects)
═══════════════════════════════════════════════════════ */
export async function loadTeacherProfile() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;

  onValue(ref(db, `teachers/${uid}`), snapshot => {
    const data = snapshot.val() || {};
    teacherProfile = data;

    const set_ = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    set_('teacherName',        data.name    || '');
    set_('teacherSubject',     data.subject || '');
    set_('teacherSubjectAdd',  data.subject || '');
    set_('teacherNameDisplay', data.name    || 'Teacher');

    const classes = data.classes || {};
    const ids = Array.isArray(classes)
      ? classes
      : (Object.keys(classes).length ? Object.values(classes) : []);

    ['classSelect','classSelectAdd','analyticsClassSelect'].forEach(selectId => {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = '<option value="">-- Select class --</option>';
      ids.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.innerText = c;
        sel.appendChild(opt);
      });
      if (prev) sel.value = prev;
    });
  });
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD  (page: dashboard.html)
═══════════════════════════════════════════════════════ */
window.initDashboardPage = function () {
  requireAuth(() => {
    initSidebar();
    initTheme();
    loadTeacherProfile();

    const classSel = document.getElementById('classSelect');
    if (classSel) {
      classSel.onchange = () => {
        currentClassFilter = classSel.value || '';
        loadStudents(currentClassFilter);
        loadClassSummary(currentClassFilter);
      };
    }

    // Search box
    const searchEl = document.getElementById('studentSearch');
    if (searchEl) {
      searchEl.oninput = () => {
        currentSearchQuery = searchEl.value.toLowerCase();
        renderStudentsTable();
      };
    }

    loadStudents();
    setTimeout(checkYearlyPromotion, 800);
  });
};

/* ── sidebarGoAttendance — was missing, caused dashboard crash ── */
window.sidebarGoAttendance = function () {
  const cls = currentClassFilter || document.getElementById('classSelect')?.value || '';
  if (cls) {
    localStorage.setItem('selectedClass', cls);
    localStorage.removeItem('selectedStudentId');
    window.location.href = 'mark-attendance.html';
  } else {
    window.location.href = 'mark-attendance.html';
  }
};

export async function loadStudents(selectedClass = '') {
  currentClassFilter = selectedClass || currentClassFilter || '';
  showLoader('Loading students…');
  try {
    const snap = await get(ref(db, 'students'));
    allStudents = snap.val() || {};
    renderStudentsTable();
    updateStudentsCount();
  } catch (err) {
    console.error('loadStudents', err);
    showToast('Failed to load students', 'error');
  } finally {
    hideLoader();
  }
}

function renderStudentsTable() {
  const table = document.getElementById('studentsTable');
  if (!table) return;

  table.innerHTML = `<tr>
    <th>Name</th><th>Class</th><th>Attendance</th><th>Absences</th><th>Actions</th>
  </tr>`;

  const query = currentSearchQuery.toLowerCase();
  let shown = 0;

  for (const id in allStudents) {
    const s = allStudents[id];
    if (!s) continue;
    if (currentClassFilter && s.class !== currentClassFilter) continue;
    if (auth.currentUser && s.teacher && s.teacher !== auth.currentUser.uid) continue;
    if (query && !(s.name || '').toLowerCase().includes(query)) continue;

    shown++;
    const attVals  = Object.values(s.attendance || {});
    const total    = attVals.length;
    const present  = attVals.filter(v => v === 'present').length;
    const absences = attVals.filter(v => v === 'absent').length;
    const pct      = total > 0 ? Math.round((present / total) * 100) : 0;
    const badgeColor = pct >= 75 ? '#4ad07a' : pct >= 50 ? '#f5a623' : '#ff6b6b';

    const row = table.insertRow();

    // Name
    row.insertCell(0).innerText = s.name || '';

    // Class
    row.insertCell(1).innerText = s.class || '';

    // Attendance badge
    const attCell = row.insertCell(2);
    attCell.innerHTML = total > 0
      ? `<span class="att-badge" style="background:${badgeColor}20;color:${badgeColor};border:1px solid ${badgeColor}40">${pct}%</span>`
      : `<span class="att-badge" style="background:rgba(255,255,255,0.05);color:#888">No data</span>`;

    // Absences
    const abCell = row.insertCell(3);
    abCell.innerText = absences;
    if (absences >= 5) abCell.style.color = '#ff6b6b';

    // Actions
    const actionCell = row.insertCell(4);
    actionCell.className = 'action-cell';

    if (!s.teacher) {
      const claimBtn = makeBtn('Claim', 'btn-ghost', () => claimStudent(id));
      actionCell.appendChild(claimBtn);
    }

    const editBtn = makeBtn('✏️ Edit', 'btn-ghost', async () => {
      const newName = prompt('Edit student name', s.name || '');
      if (!newName || !newName.trim()) return;
      showLoader('Saving…');
      try {
        await set(ref(db, `students/${id}/name`), newName.trim());
        showToast('Name updated', 'success');
        await loadStudents(currentClassFilter);
      } catch (err) {
        console.error(err);
        showToast('Failed to edit name', 'error');
      } finally { hideLoader(); }
    });
    actionCell.appendChild(editBtn);

    const delBtn = makeBtn('🗑️ Delete', 'btn-danger', async () => {
      const ok = await showConfirm(`Delete "${s.name || 'this student'}"? This cannot be undone.`);
      if (!ok) return;
      showLoader('Deleting…');
      try {
        await set(ref(db, `students/${id}`), null);
        showToast('Student deleted', 'success');
        await loadStudents(currentClassFilter);
      } catch (err) {
        console.error(err);
        showToast('Delete failed', 'error');
      } finally { hideLoader(); }
    });
    actionCell.appendChild(delBtn);

    const markBtn = makeBtn('📅 Attendance', 'btn-cta', () => {
      localStorage.removeItem('selectedClass');
      localStorage.setItem('selectedStudentId', id);
      window.location.href = 'mark-attendance.html';
    });
    markBtn.disabled = !!(s.teacher && auth.currentUser && s.teacher !== auth.currentUser.uid);
    actionCell.appendChild(markBtn);
  }

  if (shown === 0) {
    const r = table.insertRow();
    const c = r.insertCell(0);
    c.colSpan = 5;
    c.style.textAlign = 'center';
    c.style.color = 'var(--muted)';
    c.innerText = query ? 'No students match your search.' : 'No students found for this class.';
  }
}

function makeBtn(label, cls, onClick) {
  const btn = document.createElement('button');
  btn.innerText = label;
  btn.className = cls;
  btn.style.marginRight = '6px';
  btn.onclick = onClick;
  return btn;
}

function updateStudentsCount() {
  const countEl = document.getElementById('studentsCount');
  if (!countEl) return;
  let count = 0;
  for (const id in allStudents) {
    const s = allStudents[id];
    if (!s) continue;
    if (currentClassFilter && s.class !== currentClassFilter) continue;
    if (auth.currentUser && s.teacher && s.teacher !== auth.currentUser.uid) continue;
    count++;
  }
  countEl.innerText = count;
}

/* ── Attendance summary card for selected class ── */
async function loadClassSummary(className) {
  const card = document.getElementById('classSummaryCard');
  if (!card) return;
  if (!className) {
    card.innerHTML = '<p style="color:var(--muted)">Select a class to view data.</p>';
    return;
  }

  showLoader('Loading summary…');
  try {
    const snap = await get(ref(db, 'students'));
    const data = snap.val() || {};
    const now  = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();

    let totalStudents = 0, totalPresent = 0, totalPossible = 0;

    for (const id in data) {
      const s = data[id];
      if (!s || s.class !== className) continue;
      if (auth.currentUser && s.teacher && s.teacher !== auth.currentUser.uid) continue;
      totalStudents++;
      totalPossible += daysInMonth;
      for (let d = 1; d <= daysInMonth; d++) {
        const dd = `${thisMonth}-${String(d).padStart(2,'0')}`;
        if ((s.attendance || {})[dd] === 'present') totalPresent++;
      }
    }

    const pct = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;
    const color = pct >= 75 ? '#4ad07a' : pct >= 50 ? '#f5a623' : '#ff6b6b';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="font-size:15px; font-weight:600">${className}</div>
          <div class="badge" style="margin-top:8px">Students: <strong>${totalStudents}</strong></div>
        </div>
        <div style="text-align:right">
          <div style="font-size:32px; font-weight:700; color:${color}">${pct}%</div>
          <div style="color:var(--muted); font-size:13px">Present this month</div>
        </div>
      </div>
      <div style="margin-top:14px; background:rgba(255,255,255,0.04); border-radius:10px; height:8px; overflow:hidden">
        <div style="width:${pct}%; height:100%; background:${color}; border-radius:10px; transition:width 0.6s ease"></div>
      </div>`;
  } catch (err) {
    console.error('loadClassSummary', err);
  } finally {
    hideLoader();
  }
}

/* ═══════════════════════════════════════════════════════
   ADD STUDENT  (page: add-students.html)
═══════════════════════════════════════════════════════ */
window.initAddStudentsPage = function () {
  requireAuth(() => {
    initSidebar();
    initTheme();
    loadTeacherProfile();
  });
};

window.addStudent = async function () {
  if (!auth.currentUser) { window.location.href = 'index.html'; return; }
  const name = (document.getElementById('studentName')?.value || '').trim();
  const cls  = (document.getElementById('classSelectAdd')?.value || '').trim();
  if (!name || !cls) { showToast('Enter student name and select class', 'warning'); return; }

  showLoader('Adding student…');
  try {
    const subj   = teacherProfile?.subject || '';
    const newRef = push(ref(db, 'students'));
    await set(newRef, { name, class: cls, subject: subj, teacher: auth.currentUser.uid, attendance: {} });
    showToast(`${name} added!`, 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
  } catch (err) {
    console.error('addStudent', err);
    showToast('Failed to add student', 'error');
  } finally {
    hideLoader();
  }
};

/* ═══════════════════════════════════════════════════════
   CLAIM STUDENT
═══════════════════════════════════════════════════════ */
window.claimStudent = async function (studentId) {
  if (!auth.currentUser) { showToast('Login required', 'warning'); return; }
  const ok = await showConfirm('Claim this student and assign them to your account?');
  if (!ok) return;
  showLoader('Claiming…');
  try {
    await set(ref(db, `students/${studentId}/teacher`), auth.currentUser.uid);
    showToast('Student claimed!', 'success');
    await loadStudents(currentClassFilter);
  } catch (err) {
    console.error('claimStudent', err);
    showToast('Failed to claim student', 'error');
  } finally {
    hideLoader();
  }
};

/* ═══════════════════════════════════════════════════════
   NAV HELPERS
═══════════════════════════════════════════════════════ */
window.goToMarkAttendance = function () {
  const cls = document.getElementById('classSelect')?.value || currentClassFilter;
  if (!cls) { showToast('Select a class first', 'warning'); return; }
  localStorage.setItem('selectedClass', cls);
  localStorage.removeItem('selectedStudentId');
  window.location.href = 'mark-attendance.html';
};

/* ═══════════════════════════════════════════════════════
   MARK ATTENDANCE  (page: mark-attendance.html)
═══════════════════════════════════════════════════════ */
window.initMarkAttendancePage = async function () {
  requireAuth(async () => {
    initSidebar();
    initTheme();

    const classForMark = localStorage.getItem('selectedClass');
    selectedStudentId  = localStorage.getItem('selectedStudentId') || null;

    // Auto-set today's date
    const todayInput = document.getElementById('attendanceDate');
    if (todayInput) todayInput.value = todayDateString();

    if (classForMark) {
      await loadClassAttendanceUI(classForMark);
      return;
    }

    if (!selectedStudentId) {
      showToast('No student selected. Redirecting to dashboard.', 'warning');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
      return;
    }

    showLoader('Loading student…');
    try {
      const snap    = await get(ref(db, `students/${selectedStudentId}`));
      const student = snap.val() || {};
      const nameEl  = document.getElementById('studentNameLabel');
      if (nameEl) nameEl.innerText = student.name || '';

      const now = new Date();
      const defaultMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const mp = document.getElementById('monthPickerMark');
      if (mp) mp.value = defaultMonth;

      document.getElementById('singleStudentUI').style.display  = 'block';
      document.getElementById('classAttendanceUI').style.display = 'none';
      await loadMarkAttendanceMonth();
    } catch (err) {
      console.error('initMarkAttendancePage', err);
      showToast('Failed to load student', 'error');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
    } finally {
      hideLoader();
    }
  });
};

window.loadMarkAttendanceMonth = async function () {
  const mp    = document.getElementById('monthPickerMark');
  const month = mp?.value;
  if (!selectedStudentId) return;

  showLoader('Loading attendance…');
  try {
    const snap    = await get(ref(db, `students/${selectedStudentId}`));
    const student = snap.val() || {};
    const att     = student.attendance || {};
    const table   = document.getElementById('markAttendanceTable');
    if (!table) return;

    table.innerHTML = `<tr><th>Date</th><th>Status</th><th>Present</th><th>Absent</th></tr>`;
    const [y, m] = (month || '').split('-').map(Number);

    const dates = (y && m)
      ? Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) =>
          `${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`)
      : Object.keys(att).sort();

    dates.forEach(dd => {
      const status = att[dd] || '';
      const r = table.insertRow();
      r.insertCell(0).innerText = dd;
      const stCell = r.insertCell(1);
      stCell.innerText = status || '—';
      if (status === 'present') stCell.style.color = '#4ad07a';
      if (status === 'absent')  stCell.style.color = '#ff6b6b';

      const pb = document.createElement('button');
      pb.innerText = 'Present'; pb.className = 'btn-ghost';
      pb.onclick = async () => {
        await set(ref(db, `students/${selectedStudentId}/attendance/${dd}`), 'present');
        window.loadMarkAttendanceMonth();
      };
      r.insertCell(2).appendChild(pb);

      const ab = document.createElement('button');
      ab.innerText = 'Absent'; ab.className = 'btn-danger';
      ab.onclick = async () => {
        await set(ref(db, `students/${selectedStudentId}/attendance/${dd}`), 'absent');
        window.loadMarkAttendanceMonth();
      };
      r.insertCell(3).appendChild(ab);
    });
  } catch (err) {
    console.error('loadMarkAttendanceMonth', err);
    showToast('Failed to load attendance', 'error');
  } finally {
    hideLoader();
  }
};

/* ── CLASS MODE UI ───────────────────────────────────── */
async function loadClassAttendanceUI(className) {
  document.getElementById('classAttendanceUI').style.display  = 'block';
  document.getElementById('singleStudentUI').style.display    = 'none';

  document.getElementById('classAttendanceUI').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <h2>Mark Attendance — <span style="color:var(--accentC)">${className}</span></h2>
      <button class="btn-cta" id="viewClassAnalyticsBtn">📊 Analytics</button>
    </div>
    <div class="card" style="margin-top:12px;">
      <label class="label">Date</label>
      <input id="attendanceDate" type="date" value="${todayDateString()}">
    </div>
    <div class="table-wrap" style="margin-top:12px;">
      <table id="classAttendanceTable">
        <tr><th>Name</th><th>Present ✅</th><th>Absent ❌</th></tr>
      </table>
    </div>
    <div class="row" style="margin-top:12px; gap:10px; flex-wrap:wrap;">
      <button id="saveClassAttendanceBtn"   class="btn-cta">💾 Save Attendance</button>
      <button id="cancelClassAttendanceBtn" class="btn-ghost">⬅ Back</button>
      <button id="exportClassCSVBtn"        class="btn-ghost">📥 Export CSV</button>
    </div>`;

  showLoader('Loading class…');
  try {
    const snap = await get(ref(db, 'students'));
    const data = snap.val() || {};
    const rows = [];
    for (const id in data) {
      const s = data[id];
      if (!s || s.class !== className) continue;
      if (!(s.teacher && auth.currentUser && s.teacher === auth.currentUser.uid)) continue;
      rows.push({ id, name: s.name || '' });
    }

    const table = document.getElementById('classAttendanceTable');
    if (!table) return;

    if (rows.length === 0) {
      const r = table.insertRow(); const c = r.insertCell(0);
      c.colSpan = 3; c.style.textAlign = 'center'; c.innerText = 'No students found.';
    } else {
      rows.forEach(st => {
        const r = table.insertRow();
        r.dataset.studentId = st.id;
        r.insertCell(0).innerText = st.name;
        const pi = document.createElement('input');
        pi.type = 'radio'; pi.name = `att_${st.id}`; pi.value = 'present'; pi.checked = true;
        r.insertCell(1).appendChild(pi);
        const ai = document.createElement('input');
        ai.type = 'radio'; ai.name = `att_${st.id}`; ai.value = 'absent';
        r.insertCell(2).appendChild(ai);
      });
    }

    document.getElementById('saveClassAttendanceBtn').onclick   = async () => {
      const dateVal = document.getElementById('attendanceDate').value || todayDateString();
      await saveClassAttendance(rows, dateVal);
    };
    document.getElementById('cancelClassAttendanceBtn').onclick = () => {
      localStorage.removeItem('selectedClass');
      window.location.href = 'dashboard.html';
    };
    document.getElementById('exportClassCSVBtn').onclick = () =>
      exportClassAttendanceCSV(rows, document.getElementById('attendanceDate').value || todayDateString());
    document.getElementById('viewClassAnalyticsBtn').onclick = () => {
      localStorage.setItem('analyticsClass', className);
      window.location.href = 'analytics.html';
    };
  } catch (err) {
    console.error('loadClassAttendanceUI', err);
    showToast('Failed to load class', 'error');
  } finally {
    hideLoader();
  }
}

async function saveClassAttendance(rows, dateStr) {
  if (!rows || rows.length === 0) { showToast('No students to save', 'warning'); return; }
  showLoader('Saving attendance…');
  try {
    for (const st of rows) {
      const selected = document.querySelector(`input[name="att_${st.id}"]:checked`);
      const value    = selected ? selected.value : 'present';
      await set(ref(db, `students/${st.id}/attendance/${dateStr}`), value);
    }
    showToast(`Attendance saved for ${dateStr} ✅`, 'success');
    localStorage.removeItem('selectedClass');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
  } catch (err) {
    console.error('saveClassAttendance', err);
    showToast('Failed to save attendance', 'error');
  } finally {
    hideLoader();
  }
}

function todayDateString() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

/* ═══════════════════════════════════════════════════════
   EXPORTS (CSV / Excel / Print)
═══════════════════════════════════════════════════════ */
function tableToCSV(headerRow, rows) {
  const esc  = cell => `"${String(cell).replace(/"/g,'""')}"`;
  const all  = [headerRow.join(',')].concat(rows.map(r => r.map(esc).join(',')));
  return all.join('\n');
}

function downloadFile(filename, content, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

window.exportAttendanceCSV = async function () {
  if (!selectedStudentId) { showToast('No student selected', 'warning'); return; }
  showLoader('Exporting…');
  try {
    const snap = await get(ref(db, `students/${selectedStudentId}`));
    const s    = snap.val() || {};
    const rows = Object.keys(s.attendance || {}).sort().map(d => [d, s.attendance[d]]);
    downloadFile(`${s.name || 'student'}_attendance.csv`, tableToCSV(['Date','Status'], rows));
    showToast('CSV downloaded!', 'success');
  } catch (err) { showToast('Export failed', 'error'); }
  finally { hideLoader(); }
};

window.exportAttendanceExcel = async function () {
  if (!selectedStudentId) { showToast('No student selected', 'warning'); return; }
  showLoader('Exporting…');
  try {
    const snap = await get(ref(db, `students/${selectedStudentId}`));
    const s    = snap.val() || {};
    const rows = Object.keys(s.attendance || {}).sort().map(d => [d, s.attendance[d]]);
    downloadFile(`${s.name || 'student'}_attendance.xls`, tableToCSV(['Date','Status'], rows), 'application/vnd.ms-excel');
    showToast('Excel downloaded!', 'success');
  } catch (err) { showToast('Export failed', 'error'); }
  finally { hideLoader(); }
};

function exportClassAttendanceCSV(rows, dateStr) {
  if (!rows || rows.length === 0) { showToast('No data to export', 'warning'); return; }
  const csvRows = rows.map(st => {
    const sel = document.querySelector(`input[name="att_${st.id}"]:checked`);
    return [st.name, st.id, sel ? sel.value : 'present'];
  });
  downloadFile(`class_attendance_${dateStr}.csv`, tableToCSV(['Name','StudentId','Status'], csvRows));
  showToast('CSV downloaded!', 'success');
}

window.exportBunkersCSV = async function () {
  showLoader('Exporting…');
  try {
    const snap = await get(ref(db, 'students'));
    const data = snap.val() || {};
    const rows = [];
    for (const id in data) {
      const s = data[id];
      if (!s || !auth.currentUser || s.teacher !== auth.currentUser.uid) continue;
      const absent = Object.values(s.attendance || {}).filter(v => v === 'absent').length;
      if (absent > 0) rows.push([s.name||'', s.class||'', s.subject||'', absent]);
    }
    if (rows.length === 0) { showToast('No bunkers found', 'info'); return; }
    downloadFile('top_bunkers.csv', tableToCSV(['Name','Class','Subject','Absences'], rows));
    showToast('CSV downloaded!', 'success');
  } catch (err) {
    showToast('Export failed', 'error');
  } finally {
    hideLoader();
  }
};

window.printReport = function () {
  const table = document.getElementById('markAttendanceTable') || document.getElementById('attendanceMonthTable');
  if (!table) { showToast('Nothing to print', 'warning'); return; }
  const w     = window.open('', '', 'width=900,height=700');
  const title = document.getElementById('studentNameLabel')?.innerText || 'Attendance Report';
  w.document.write(`<h3>Monthly Attendance — ${title}</h3>${table.outerHTML}`);
  w.document.close();
  w.print();
};

/* ═══════════════════════════════════════════════════════
   TOP BUNKERS  (page: top-bunkers.html)
═══════════════════════════════════════════════════════ */
window.initTopBunkersPage = function () {
  requireAuth(async () => {
    initTheme();
    showLoader('Loading…');
    try {
      const snap = await get(ref(db, 'students'));
      const data = snap.val() || {};
      const bunkers = [];
      for (const id in data) {
        const s = data[id];
        if (!s || !auth.currentUser || s.teacher !== auth.currentUser.uid) continue;
        const absent = Object.values(s.attendance || {}).filter(v => v === 'absent').length;
        if (absent > 0) bunkers.push({ id, ...s, totalAbsent: absent });
      }
      bunkers.sort((a, b) => b.totalAbsent - a.totalAbsent);
      const table = document.getElementById('bunkersTable');
      if (!table) return;
      table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Subject</th><th>Absences</th></tr>`;
      if (bunkers.length === 0) {
        const r = table.insertRow(); const c = r.insertCell(0);
        c.colSpan = 4; c.style.textAlign = 'center'; c.innerText = '🎉 No students with absences!';
      } else {
        bunkers.forEach(s => {
          const r = table.insertRow();
          r.insertCell(0).innerText = s.name;
          r.insertCell(1).innerText = s.class;
          r.insertCell(2).innerText = s.subject || '';
          const c = r.insertCell(3); c.innerText = s.totalAbsent;
          if (s.totalAbsent >= 5) c.style.color = '#ff6b6b';
          else if (s.totalAbsent >= 3) c.style.color = '#f5a623';
        });
      }
    } catch (err) {
      console.error('initTopBunkersPage', err);
      showToast('Failed to load data', 'error');
    } finally {
      hideLoader();
    }
  });
};

/* ═══════════════════════════════════════════════════════
   ANALYTICS  (page: analytics.html)
═══════════════════════════════════════════════════════ */
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

  showLoader('Generating analytics…');
  try {
    const snap = await get(ref(db, 'students'));
    const data = snap.val() || {};
    const students = [];
    for (const id in data) {
      const s = data[id];
      if (!s || s.class !== className) continue;
      if (!auth.currentUser || s.teacher !== auth.currentUser.uid) continue;
      students.push({ id, name: s.name || '', attendance: s.attendance || {} });
    }

    const [y, m]  = month.split('-').map(Number);
    const mdays   = new Date(y, m, 0).getDate();
    const dayTotals = Array(mdays).fill(0);
    let totalPresent = 0, totalAbsent = 0;
    const studentTotals = [];

    for (const s of students) {
      let sp = 0, sa = 0;
      for (let d = 1; d <= mdays; d++) {
        const dd = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const v  = s.attendance[dd];
        if (v === 'present') { sp++; totalPresent++; dayTotals[d-1]++; }
        if (v === 'absent')  { sa++; totalAbsent++; }
      }
      studentTotals.push({ id: s.id, name: s.name, present: sp, absent: sa });
    }

    const area = document.getElementById('chartsArea');
    area.innerHTML = '';

    // Summary
    const totalPossible = students.length * mdays;
    const pct = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;
    const col = pct >= 75 ? '#4ad07a' : pct >= 50 ? '#f5a623' : '#ff6b6b';
    const summary = mkEl('div', 'card',
      `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div><strong>${className} — ${month}</strong>
          <div style="color:var(--muted);margin-top:4px">${students.length} students · ${mdays} days</div></div>
        <div style="text-align:right">
          <div style="font-size:28px;font-weight:700;color:${col}">${pct}%</div>
          <div style="color:var(--muted);font-size:13px">Present overall</div>
        </div></div>
       <div style="margin-top:14px;background:rgba(255,255,255,0.05);border-radius:8px;height:8px;overflow:hidden">
         <div style="width:${pct}%;height:100%;background:${col};border-radius:8px;transition:width 0.6s"></div>
       </div>`);
    area.appendChild(summary);

    // Day bar chart
    const dayCard = mkEl('div', 'card',
      `<strong>Daily Present Count — ${month}</strong>
       <div id="dayBar" style="margin-top:12px;display:flex;gap:4px;align-items:flex-end;height:130px"></div>`);
    area.appendChild(dayCard);
    const maxDay = Math.max(...dayTotals, 1);
    dayTotals.forEach((v, i) => {
      const bar = document.createElement('div');
      bar.style.cssText = `flex:1;height:${Math.max(8, Math.round(v/maxDay*100))}%;
        background:linear-gradient(180deg,#0ea5e9,#3b82f6);border-radius:6px 6px 0 0;cursor:default`;
      bar.title = `Day ${i+1}: ${v} present`;
      dayCard.querySelector('#dayBar').appendChild(bar);
    });

    // Student ranking table
    const rankCard = mkEl('div', 'card', '<strong>Student Attendance Ranking</strong>');
    const tw = document.createElement('div'); tw.className = 'table-wrap';
    const t  = document.createElement('table');
    t.innerHTML = `<tr><th>Name</th><th>Present</th><th>Absent</th><th>%</th></tr>`;
    studentTotals.sort((a,b) => b.present - a.present).forEach(s => {
      const pctS = mdays > 0 ? Math.round((s.present / mdays) * 100) : 0;
      const c    = pctS >= 75 ? '#4ad07a' : pctS >= 50 ? '#f5a623' : '#ff6b6b';
      const r = t.insertRow();
      r.insertCell(0).innerText = s.name;
      r.insertCell(1).innerText = s.present;
      r.insertCell(2).innerText = s.absent;
      const pc = r.insertCell(3);
      pc.innerHTML = `<span style="color:${c};font-weight:600">${pctS}%</span>`;
    });
    tw.appendChild(t); rankCard.appendChild(tw);
    area.appendChild(rankCard);

    // Buttons
    const ctrl = mkEl('div', 'row', '');
    ctrl.style.marginTop = '10px'; ctrl.style.gap = '10px';

    const exBtn = document.createElement('button');
    exBtn.className = 'btn-cta'; exBtn.innerText = '📥 Export Excel';
    exBtn.onclick = async () => {
      const header = ['Name'];
      for (let d = 1; d <= mdays; d++) header.push(`D${d}`);
      const exRows = studentTotals.map(st => {
        const row = [st.name];
        const stObj = students.find(s => s.id === st.id);
        for (let d = 1; d <= mdays; d++) {
          const dd = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          row.push((stObj?.attendance[dd] || '').substring(0,1).toUpperCase() || '-');
        }
        return row;
      });
      downloadFile(`analytics_${className}_${month}.xls`, tableToCSV(header, exRows), 'application/vnd.ms-excel');
      showToast('Excel downloaded!', 'success');
    };
    ctrl.appendChild(exBtn);

    const prBtn = document.createElement('button');
    prBtn.className = 'btn-ghost'; prBtn.innerText = '🖨️ Print';
    prBtn.onclick = () => {
      const w = window.open('', '', 'width=900,height=700');
      w.document.write(`<h3>Attendance — ${className} — ${month}</h3>${summary.outerHTML}${tw.outerHTML}`);
      w.document.close(); w.print();
    };
    ctrl.appendChild(prBtn);
    area.appendChild(ctrl);

    showToast('Analytics ready!', 'success');
  } catch (err) {
    console.error('renderAnalytics', err);
    showToast('Failed to render analytics', 'error');
  } finally {
    hideLoader();
  }
};

window.openAnalyticsForStudent = function () {
  if (!selectedStudentId) { showToast('No student selected', 'warning'); return; }
  localStorage.setItem('analyticsStudentId', selectedStudentId);
  window.location.href = 'analytics.html';
};

function mkEl(tag, cls, html) {
  const el = document.createElement(tag);
  el.className = cls;
  el.innerHTML = html;
  return el;
}

/* ═══════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════ */
window.fixTeacherIds = async function () {
  if (!auth.currentUser) { showToast('Login first', 'warning'); return; }
  const ok = await showConfirm('Set ALL students with no teacher to your account?');
  if (!ok) return;
  showLoader('Fixing…');
  try {
    const snap = await get(ref(db, 'students'));
    const data = snap.val() || {};
    for (const id in data) {
      if (!data[id]?.teacher) await set(ref(db, `students/${id}/teacher`), auth.currentUser.uid);
    }
    showToast('Done! Reloading students.', 'success');
    await loadStudents(currentClassFilter);
  } catch (err) {
    showToast('Fix failed — check console', 'error');
  } finally {
    hideLoader();
  }
};

/* ═══════════════════════════════════════════════════════
   YEARLY CLASS PROMOTION SYSTEM
═══════════════════════════════════════════════════════ */
let promoStudents = [], promoIndex = 0, promoResults = {}, promoClassMap = {};

function getAcademicYear() {
  const now = new Date(); const mo = now.getMonth() + 1;
  return mo >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

function buildPromoClassMap(classList) {
  const grades = classList.map(c => { const m = c.match(/^(\d+)/); return m ? parseInt(m[1]) : null; }).filter(Boolean);
  const maxGrade = grades.length ? Math.max(...grades) : 0;
  const map = {};
  classList.forEach(cls => {
    const m = cls.match(/^(\d+)(.*)/);
    if (!m) { map[cls] = null; return; }
    const grade = parseInt(m[1]); const section = m[2];
    map[cls] = grade >= maxGrade ? null : `${grade + 1}${section}`;
  });
  return map;
}

async function checkYearlyPromotion() {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  try {
    const snap    = await get(ref(db, `teachers/${uid}`));
    const teacher = snap.val() || {};
    const year    = getAcademicYear();
    if (year <= (teacher.lastPromotionYear || 0)) return;

    const remindKey = `promoRemind_${uid}_${year}`;
    if (parseInt(localStorage.getItem(remindKey) || '0') >= 3) return;

    const studSnap  = await get(ref(db, 'students'));
    const allData   = studSnap.val() || {};
    const myStudents = [];
    for (const id in allData) {
      const s = allData[id];
      if (!s || s.teacher !== uid) continue;
      myStudents.push({ id, ...s });
    }
    if (myStudents.length === 0) return;

    const classes = teacher.classes || {};
    let classList = Array.isArray(classes) ? [...classes] : Object.values(classes);
    classList = classList.filter(Boolean);
    if (classList.length === 0) return;

    promoClassMap = buildPromoClassMap(classList);
    promoStudents = myStudents;
    promoIndex    = 0;
    promoResults  = {};

    const modal = document.getElementById('promotionModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('promoChoiceView').style.display  = 'block';
    document.getElementById('promoReviewView').style.display  = 'none';
    document.getElementById('promoDoneView').style.display    = 'none';
    const sub = document.getElementById('promoSubtitle');
    if (sub) sub.innerText = `Academic year ${year}–${year+1} detected. What would you like to do with your ${myStudents.length} student(s)?`;
  } catch (err) { console.error('checkYearlyPromotion', err); }
}

window.remindLaterPromotion = function () {
  const uid = auth.currentUser?.uid; if (!uid) return;
  const k   = `promoRemind_${uid}_${getAcademicYear()}`;
  localStorage.setItem(k, String(parseInt(localStorage.getItem(k)||'0')+1));
  document.getElementById('promotionModal').style.display = 'none';
};
window.closePromotionModal = function () { document.getElementById('promotionModal').style.display = 'none'; };

window.startPromoteAll = async function () {
  const uid = auth.currentUser?.uid; if (!uid) return;
  const btn = document.getElementById('promoteAllBtn');
  if (btn) { btn.disabled = true; btn.innerText = 'Promoting…'; }
  let promoted = 0, graduated = 0, unchanged = 0;
  for (const s of promoStudents) {
    const next = promoClassMap[s.class];
    if (next === undefined) unchanged++;
    else if (next === null) graduated++;
    else { await set(ref(db, `students/${s.id}/class`), next); promoted++; }
  }
  await set(ref(db, `teachers/${uid}/lastPromotionYear`), getAcademicYear());
  document.getElementById('promoChoiceView').style.display = 'none';
  document.getElementById('promoDoneView').style.display   = 'block';
  let msg = `${promoted} student(s) promoted.`;
  if (graduated) msg += ` ${graduated} graduated (final class).`;
  if (unchanged) msg += ` ${unchanged} had unrecognized class.`;
  document.getElementById('promoDoneSummary').innerText = msg;
  await loadStudents(currentClassFilter);
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
  const absences = Object.values(s.attendance || {}).filter(v => v === 'absent').length;
  const next     = promoClassMap[s.class];
  document.getElementById('promoCurrentNum').innerText      = idx + 1;
  document.getElementById('promoStudentName').innerText     = s.name || '(No name)';
  document.getElementById('promoStudentClass').innerText    = s.class || '-';
  document.getElementById('promoStudentAbsences').innerText = absences;
  const marks   = s.marks || {};
  const marksEl = document.getElementById('promoStudentMarks');
  if (marksEl) {
    if (marks.ut1Score || marks.hyScore) {
      marksEl.innerText = `UT-1: ${marks.ut1Score||'-'}/${marks.ut1Max||25}  |  HY: ${marks.hyScore||'-'}/${marks.hyMax||100}`;
      marksEl.style.display = 'block';
    } else { marksEl.style.display = 'none'; }
  }
  const passBtn = document.getElementById('promoPassBtn');
  if (passBtn) passBtn.innerText = next === null ? '🎓 Graduate' : next ? `✅ Pass → Class ${next}` : '✅ Pass';
}

window.reviewDecision = function (decision) {
  promoResults[promoStudents[promoIndex].id] = decision;
  showPromoStudent(promoIndex + 1);
};

async function finishReviewPromotion() {
  document.getElementById('promoReviewView').style.display = 'none';
  document.getElementById('promoDoneView').style.display   = 'block';
  const uid = auth.currentUser?.uid;
  let promoted = 0, failed = 0, skipped = 0;
  for (const s of promoStudents) {
    const dec = promoResults[s.id];
    if (dec === 'pass') {
      const next = promoClassMap[s.class];
      if (next) { await set(ref(db, `students/${s.id}/class`), next); }
      promoted++;
    } else if (dec === 'fail') { failed++; }
    else { skipped++; }
  }
  if (uid) await set(ref(db, `teachers/${uid}/lastPromotionYear`), getAcademicYear());
  let summary = `${promoted} promoted, ${failed} kept in same class.`;
  if (skipped) summary += ` ${skipped} not reviewed.`;
  document.getElementById('promoDoneSummary').innerText = summary;
  await loadStudents(currentClassFilter);
}

window.skipRemainingPromotion = async function () {
  const uid = auth.currentUser?.uid; if (!uid) return;
  let promoted = 0;
  for (const s of promoStudents) {
    if (promoResults[s.id] === 'pass') {
      const next = promoClassMap[s.class];
      if (next) { await set(ref(db, `students/${s.id}/class`), next); promoted++; }
    }
  }
  const k = `promoRemind_${uid}_${getAcademicYear()}`;
  localStorage.setItem(k, '2');
  document.getElementById('promotionModal').style.display = 'none';
  if (promoted) await loadStudents(currentClassFilter);
};
