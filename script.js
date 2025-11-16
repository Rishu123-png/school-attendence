// script.js
// Full client logic: login/logout, teacher profile, classes, students, attendance calendar, history, print, top bunkers

import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  ref,
  onValue,
  get,
  set,
  push,
  update
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

/* -------------------------
   Global state
   ------------------------- */
let currentTeacher = null;    // firebase user object
let teacherProfile = null;    // teacher data from RTDB
let allStudents = {};         // cached students snapshot
let selectedStudentId = null; // student id for History / calendar
let currentClassFilter = "";  // class selected on dashboard
let currentMonth = "";        // YYYY-MM for calendar

/* -------------------------
   Auth handling (safe)
   ------------------------- */
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentTeacher = user;
    // If we are on a page that expects teacher info, load it
    if (document.body.contains(document.getElementById('teacherName'))) {
      loadTeacherProfile();
    }
    // if on dashboard page and class already chosen, load students
    if (document.body.contains(document.getElementById('classSelect'))) {
      // load teacher profile will populate classes and then you can call loadStudents when class chosen
      loadTeacherProfile();
    }
  } else {
    currentTeacher = null;
    // if user is on protected pages, redirect to login
    const protectedPages = ['dashboard.html','add-students.html','mark-attendance.html','top-bunkers.html'];
    const path = window.location.pathname.split('/').pop();
    if (protectedPages.includes(path)) {
      window.location.href = 'index.html';
    }
  }
});

/* -------------------------
   LOGIN / LOGOUT
   ------------------------- */
window.login = async function () {
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  if (!emailEl || !passEl) return alert("Missing page elements.");

  const email = emailEl.value.trim();
  const password = passEl.value;
  if (!email || !password) return alert("Enter email and password.");

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentTeacher = cred.user;
    // after login go to dashboard
    window.location.href = 'dashboard.html';
  } catch (e) {
    alert(e.message || 'Login failed');
  }
};

window.logout = async function () {
  try {
    await signOut(auth);
    currentTeacher = null;
    window.location.href = 'index.html';
  } catch (e) {
    alert('Logout failed: ' + (e.message || e));
  }
};

/* -------------------------
   Load teacher profile & classes (dashboard & add-students pages)
   ------------------------- */
export async function loadTeacherProfile() {
  if (!auth.currentUser) {
    // wait a short moment if auth not yet ready
    setTimeout(loadTeacherProfile, 300);
    return;
  }
  const uid = auth.currentUser.uid;
  const teacherRef = ref(db, `teachers/${uid}`);
  onValue(teacherRef, snapshot => {
    const data = snapshot.val();
    teacherProfile = data || {};
    // fill elements if exist on page
    const nameEl = document.getElementById('teacherName');
    const subjectEl = document.getElementById('teacherSubject');
    const classSel1 = document.getElementById('classSelect');     // dashboard
    const classSelAdd = document.getElementById('classSelectAdd');// add-students
    const teacherSubjectAdd = document.getElementById('teacherSubjectAdd');

    if (nameEl) nameEl.innerText = data?.name || 'Teacher';
    if (subjectEl) subjectEl.innerText = data?.subject || '';
    if (teacherSubjectAdd) teacherSubjectAdd.innerText = data?.subject || '';

    // populate classes into dropdown(s) (expects data.classes as object or array)
    const classes = data?.classes || {};
    // support both { "11A": "11A" } or ["11A","11B"]
    function fillSelect(sel) {
      if (!sel) return;
      sel.innerHTML = '<option value="">-- Select class --</option>';
      if (Array.isArray(classes)) {
        classes.forEach(c => {
          const o = document.createElement('option'); o.value = c; o.innerText = c; sel.appendChild(o);
        });
      } else {
        for (const k in classes) {
          const v = classes[k];
          const o = document.createElement('option'); o.value = v; o.innerText = v; sel.appendChild(o);
        }
      }
    }
    fillSelect(classSel1);
    fillSelect(classSelAdd);
  });
}

/* -------------------------
   Students list (dashboard)
   ------------------------- */
window.loadStudents = function () {
  const classSelect = document.getElementById('classSelect');
  if (!classSelect) return;
  currentClassFilter = classSelect.value;
  // read students once and update view
  const studentsRef = ref(db, 'students');
  onValue(studentsRef, snapshot => {
    allStudents = snapshot.val() || {};
    renderStudentsList();
  });
};

function renderStudentsList() {
  const table = document.getElementById('studentsTable');
  if (!table) return;
  // header
  table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Absences</th><th>Actions</th></tr>`;
  for (const id in allStudents) {
    const s = allStudents[id];
    if (s.teacher !== auth.currentUser.uid) continue;       // only teacher's students
    if (currentClassFilter && s.class !== currentClassFilter) continue;
    // student row
    const row = table.insertRow();
    row.insertCell(0).innerText = s.name;
    row.insertCell(1).innerText = s.class;
    const absentCount = Object.values(s.attendance || {}).filter(x => x === 'absent').length;
    row.insertCell(2).innerText = absentCount;
    const actions = row.insertCell(3);
    // edit button
    const editBtn = document.createElement('button');
    editBtn.innerText = 'Edit';
    editBtn.onclick = () => editStudentName(id);
    actions.appendChild(editBtn);
    // delete button
    const delBtn = document.createElement('button');
    delBtn.innerText = 'Delete';
    delBtn.onclick = () => deleteStudent(id);
    actions.appendChild(delBtn);
    // mark attendance button
    const markBtn = document.createElement('button');
    markBtn.innerText = 'Mark Attendance';
    markBtn.onclick = () => {
      selectedStudentId = id;
      // store selected student id in local storage for mark-attendance page or open modal here
      localStorage.setItem('selectedStudentId', id);
      // for single page flow open modal; for multi page go to mark-attendance.html
      if (window.location.pathname.endsWith('dashboard.html')) {
        // open modal calendar for selected student
        openAttendanceModal(id);
      } else {
        window.location.href = 'mark-attendance.html';
      }
    };
    actions.appendChild(markBtn);
  }
}

/* -------------------------
   Student CRUD
   ------------------------- */
window.showAddStudentForm = function() {
  // simply redirect to add-students page
  window.location.href = 'add-students.html';
};

window.addStudent = async function () {
  const nameEl = document.getElementById('studentName');
  const classSel = document.getElementById('classSelectAdd');
  if (!nameEl || !classSel) return alert('Page not initialized correctly');
  const name = nameEl.value.trim();
  const cls = classSel.value;
  const subject = teacherProfile?.subject || '';

  if (!name || !cls) return alert('Enter student name and select class');

  try {
    const newRef = push(ref(db, 'students'));
    await set(newRef, { name, class: cls, subject, teacher: currentTeacher.uid, attendance: {} });
    alert('Student added');
    nameEl.value = '';
    window.location.href = 'dashboard.html';
  } catch (e) {
    alert('Failed to add student: ' + (e.message || e));
  }
};

function editStudentName(studentId) {
  const newName = prompt('Enter new name:', allStudents[studentId].name || '');
  if (!newName) return;
  update(ref(db, `students/${studentId}`), { name: newName });
}

function deleteStudent(studentId) {
  if (!confirm('Delete this student?')) return;
  // removal using update to empty or set; here set null via update trick
  set(ref(db, `students/${studentId}`), null);
}

/* -------------------------
   Attendance modal & calendar
   ------------------------- */
function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Open modal and load calendar/histry for a student
export function openAttendanceModal(studentId) {
  selectedStudentId = studentId;
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('attendanceModal');
  if (!modal || !overlay) {
    // if modal not available (multi-page), redirect to mark-attendance page
    localStorage.setItem('selectedStudentId', studentId);
    window.location.href = 'mark-attendance.html';
    return;
  }
  // student name display
  const name = allStudents[studentId]?.name || 'Student';
  document.getElementById('modalStudentName').innerText = name;

  // show today's month by default
  const today = new Date();
  currentMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const monthPicker = document.getElementById('monthPicker');
  if (monthPicker) monthPicker.value = currentMonth;

  overlay.style.display = 'block';
  modal.style.display = 'block';
  loadAttendanceMonth();
}

window.closeModal = function () {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('attendanceModal');
  if (overlay) overlay.style.display = 'none';
  if (modal) modal.style.display = 'none';
  selectedStudentId = null;
};

// loads attendance entries for selectedStudentId filtered by month (YYYY-MM)
window.loadAttendanceMonth = async function () {
  const monthInput = document.getElementById('monthPicker');
  const month = monthInput?.value || currentMonth;
  currentMonth = month;
  const table = document.getElementById('attendanceMonthTable');
  if (!selectedStudentId || !table) return;

  // fetch latest student attendance
  const studentSnap = await get(ref(db, `students/${selectedStudentId}`));
  const student = studentSnap.val();
  const attendance = student?.attendance || {};

  // build list of dates in that month present in attendance OR render full month
  table.innerHTML = `<tr><th>Date</th><th>Status</th><th>Mark Present</th><th>Mark Absent</th></tr>`;

  // Option: show all days of calendar month so teacher can mark directly
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) {
    // fallback: show existing entries
    for (const date in attendance) {
      const tr = table.insertRow();
      tr.insertCell(0).innerText = date;
      tr.insertCell(1).innerText = attendance[date];
      const pbtn = tr.insertCell(2).appendChild(document.createElement('button'));
      pbtn.innerText = 'Present';
      pbtn.onclick = () => markAttendanceDate(selectedStudentId, date, 'present');
      const abtn = tr.insertCell(3).appendChild(document.createElement('button'));
      abtn.innerText = 'Absent';
      abtn.onclick = () => markAttendanceDate(selectedStudentId, date, 'absent');
    }
    return;
  }

  // get days in month
  const daysInMonth = new Date(y, m, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const status = attendance[dd] || ''; // '' if no entry
    const row = table.insertRow();
    row.insertCell(0).innerText = dd;
    const statusCell = row.insertCell(1);
    statusCell.innerText = status || '-';
    // Present button
    const pcell = row.insertCell(2);
    const pbtn = document.createElement('button');
    pbtn.innerText = 'Present';
    pbtn.onclick = () => markAttendanceDate(selectedStudentId, dd, 'present');
    pcell.appendChild(pbtn);
    // Absent button
    const acell = row.insertCell(3);
    const abtn = document.createElement('button');
    abtn.innerText = 'Absent';
    abtn.onclick = () => markAttendanceDate(selectedStudentId, dd, 'absent');
    acell.appendChild(abtn);

    // visual highlight
    if (status === 'present') statusCell.style.color = 'lightgreen';
    if (status === 'absent') statusCell.style.color = '#ff7b7b';
  }
};

async function markAttendanceDate(studentId, dateStr, status) {
  try {
    await set(ref(db, `students/${studentId}/attendance/${dateStr}`), status);
    // update local cache (if exists)
    if (allStudents[studentId]) {
      allStudents[studentId].attendance = allStudents[studentId].attendance || {};
      allStudents[studentId].attendance[dateStr] = status;
    }
    // refresh month view
    await loadAttendanceMonth();
  } catch (e) {
    alert('Failed to save attendance: ' + (e.message || e));
  }
}

/* -------------------------
   Mark attendance page flow (mark-attendance.html)
   ------------------------- */
// When mark-attendance.html loads, it expects localStorage.selectedStudentId
export async function initMarkAttendancePage() {
  // get selected student id either from localStorage or query param
  selectedStudentId = localStorage.getItem('selectedStudentId') || selectedStudentId || null;
  if (!selectedStudentId) {
    alert('No student selected. Go to dashboard and click "Mark Attendance".');
    window.location.href = 'dashboard.html';
    return;
  }

  // read all students to populate allStudents cache
  const studentsSnap = await get(ref(db, 'students'));
  allStudents = studentsSnap.val() || {};

  // Display student name and default month
  const student = allStudents[selectedStudentId];
  if (!student) {
    alert('Student not found');
    window.location.href = 'dashboard.html';
    return;
  }
  document.getElementById('studentNameLabel').innerText = student.name;
  // set month picker default
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const mp = document.getElementById('monthPickerMark');
  if (mp) mp.value = defaultMonth;
  // build calendar for this student
  loadMarkAttendanceMonth();
}

export async function loadMarkAttendanceMonth() {
  const month = document.getElementById('monthPickerMark').value;
  if (!selectedStudentId) return;
  const studentSnap = await get(ref(db, `students/${selectedStudentId}`));
  const student = studentSnap.val() || {};
  const attendance = student.attendance || {};

  const table = document.getElementById('markAttendanceTable');
  if (!table) return;
  table.innerHTML = `<tr><th>Date</th><th>Status</th><th>Present</th><th>Absent</th></tr>`;

  const [y, m] = (month || '').split('-').map(Number);
  if (!y || !m) {
    // show existing entries
    for (const date in attendance) {
      const tr = table.insertRow();
      tr.insertCell(0).innerText = date;
      tr.insertCell(1).innerText = attendance[date] || '-';
      const p = tr.insertCell(2).appendChild(document.createElement('button'));
      p.innerText = 'Present'; p.onclick = () => markAttendanceDate(selectedStudentId, date, 'present');
      const a = tr.insertCell(3).appendChild(document.createElement('button'));
      a.innerText = 'Absent'; a.onclick = () => markAttendanceDate(selectedStudentId, date, 'absent');
    }
    return;
  }

  const daysInMonth = new Date(y, m, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dd = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const status = attendance[dd] || '';
    const row = table.insertRow();
    row.insertCell(0).innerText = dd;
    const st = row.insertCell(1); st.innerText = status || '-';
    const pcell = row.insertCell(2);
    const pbtn = document.createElement('button'); pbtn.innerText = 'Present';
    pbtn.onclick = () => markAttendanceDate(selectedStudentId, dd, 'present');
    pcell.appendChild(pbtn);
    const acell = row.insertCell(3);
    const abtn = document.createElement('button'); abtn.innerText = 'Absent';
    abtn.onclick = () => markAttendanceDate(selectedStudentId, dd, 'absent');
    acell.appendChild(abtn);
    if (status === 'present') st.style.color = 'lightgreen';
    if (status === 'absent') st.style.color = '#ff7b7b';
  }
}

/* -------------------------
   Print monthly report for selected student (modal or mark-attendance page)
   ------------------------- */
window.printReport = function () {
  // prefer mark-attendance table if exists
  const table = document.getElementById('markAttendanceTable') || document.getElementById('attendanceMonthTable');
  if (!table) return alert('Nothing to print');
  const w = window.open('', '', 'width=900,height=700');
  const studentName = (document.getElementById('studentNameLabel') && document.getElementById('studentNameLabel').innerText)
    || (document.getElementById('modalStudentName') && document.getElementById('modalStudentName').innerText)
    || 'Student';
  w.document.write(`<h3>Monthly Attendance Report — ${studentName}</h3>`);
  w.document.write(table.outerHTML);
  w.document.close();
  w.print();
};

/* -------------------------
   Top Bunkers page
   ------------------------- */
export async function loadTopBunkersPage() {
  // ensure we have latest students
  const snap = await get(ref(db, 'students'));
  const students = snap.val() || {};
  const list = [];
  for (const id in students) {
    const s = students[id];
    if (s.teacher !== auth.currentUser.uid) continue;
    const totalAbsent = Object.values(s.attendance || {}).filter(v => v === 'absent').length;
    if (totalAbsent > 0) list.push({ id, ...s, totalAbsent });
  }
  list.sort((a,b) => b.totalAbsent - a.totalAbsent);

  const table = document.getElementById('bunkersTable');
  if (!table) return;
  table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Subject</th><th>Absences</th></tr>`;
  list.forEach(s => {
    const r = table.insertRow();
    r.insertCell(0).innerText = s.name;
    r.insertCell(1).innerText = s.class;
    r.insertCell(2).innerText = s.subject;
    const cell = r.insertCell(3);
    cell.innerText = s.totalAbsent;
    if (s.totalAbsent >= 3) cell.classList.add('top-bunker');
  });
}

/* -------------------------
   Utility: on pages load wiring
   ------------------------- */
window.initDashboardPage = function () {
  // Called by dashboard.html onload
  if (!auth.currentUser) {
    // wait and retry
    setTimeout(window.initDashboardPage, 300);
    return;
  }
  loadTeacherProfile(); // will populate classes
  // wire class change handler
  const classSel = document.getElementById('classSelect');
  if (classSel) classSel.onchange = loadStudents;
  // students table element must exist
  // initial load no class until teacher selects
};

window.initAddStudentsPage = function () {
  if (!auth.currentUser) { setTimeout(window.initAddStudentsPage, 300); return; }
  loadTeacherProfile();
  // class dropdown id 'classSelectAdd' should be populated by loadTeacherProfile
};

window.initMarkAttendancePage = async function () {
  // Called on mark-attendance.html onload
  if (!auth.currentUser) { setTimeout(window.initMarkAttendancePage, 300); return; }
  // try to get selectedStudentId from localStorage or query param
  selectedStudentId = localStorage.getItem('selectedStudentId') || selectedStudentId;
  if (!selectedStudentId) {
    alert('No student selected. Go to dashboard and choose a student.');
    window.location.href = 'dashboard.html';
    return;
  }
  // load students cache then render
  const snap = await get(ref(db, 'students'));
  allStudents = snap.val() || {};
  // set label
  const student = allStudents[selectedStudentId];
  if (!student) { alert('Student not found'); window.location.href = 'dashboard.html'; return; }
  const label = document.getElementById('studentNameLabel');
  if (label) label.innerText = student.name;
  // set default month to current
  const mp = document.getElementById(