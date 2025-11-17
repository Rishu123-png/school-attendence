import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  ref, onValue, get, set, push
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

/* ----------------------
   Global state
   ---------------------- */
let currentTeacherUser = null;    // firebase auth user
let teacherProfile = null;        // teacher info from RTDB
let allStudents = {};             // cached students
let selectedStudentId = null;     // selected for marking/history
let currentClassFilter = "";      // class selected in dashboard

/* ----------------------
   Keep auth state in sync
   ---------------------- */
onAuthStateChanged(auth, (user) => {
  currentTeacherUser = user;
});

/* ======================
   LOGIN / LOGOUT
   ====================== */

// Called from index.html (onclick="login()")
window.login = async function () {
  const email = (document.getElementById('email')?.value || '').trim();
  const password = document.getElementById('password')?.value || '';
  if (!email || !password) { alert('Enter email and password'); return; }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentTeacherUser = cred.user;
    // Redirect to dashboard after successful login
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Login failed', err);
    alert(err.message || 'Login failed');
  }
};

// Called from pages (onclick="logout()")
window.logout = async function () {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Sign out error', err);
  } finally {
    window.location.href = 'index.html';
  }
};

/* ======================
   Teacher profile & classes
   ====================== */

/*
  This function populates:
   - #teacherName
   - #teacherSubject
   - #teacherSubjectAdd
   - select#classSelect
   - select#classSelectAdd

  Call from dashboard.html onload: initDashboardPage()
  Call from add-students.html onload: initAddStudentsPage()
*/
export async function loadTeacherProfile() {
  if (!auth.currentUser) {
    // retry shortly if auth not ready yet
    setTimeout(loadTeacherProfile, 200);
    return;
  }

  const uid = auth.currentUser.uid;
  const teacherRef = ref(db, `teachers/${uid}`);

  // listen for teacher profile changes
  onValue(teacherRef, snapshot => {
    const data = snapshot.val() || {};
    teacherProfile = data;

    // set UI fields if present
    const nameEl = document.getElementById('teacherName');
    const subjectEl = document.getElementById('teacherSubject');
    const subjectAddEl = document.getElementById('teacherSubjectAdd');

    if (nameEl) nameEl.innerText = data.name || '';
    if (subjectEl) subjectEl.innerText = data.subject || '';
    if (subjectAddEl) subjectAddEl.innerText = data.subject || '';

    // populate class selects (supports object or array)
    const classes = data.classes || {};
    const ids = Array.isArray(classes) ? classes : Object.keys(classes).length ? Object.values(classes) : [];

    function fill(selectId) {
      const sel = document.getElementById(selectId);
      if (!sel) return;
      sel.innerHTML = '<option value="">-- Select class --</option>';
      ids.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.innerText = c;
        sel.appendChild(opt);
      });
    }

    fill('classSelect');
    fill('classSelectAdd');
  });
}

/* ======================
   Dashboard: students list
   ====================== */

// Called when dashboard.html loads
window.initDashboardPage = function () {
  if (!auth.currentUser) {
    // wait for auth to initialize
    setTimeout(window.initDashboardPage, 300);
    return;
  }

  // Load teacher profile and populate classes
  loadTeacherProfile();

  // Attach onchange to class selector
  const classSel = document.getElementById('classSelect');
  if (classSel) {
    classSel.onchange = () => {
      currentClassFilter = classSel.value || '';
      loadStudents(currentClassFilter);
    };
  }

  // initial students load (empty until class chosen)
  loadStudents();
};

// load all students and render (filtered by class and subject if provided)
export function loadStudents(selectedClass = '') {
  currentClassFilter = selectedClass || currentClassFilter || '';

  const studentsRef = ref(db, 'students');
  onValue(studentsRef, snap => {
    allStudents = snap.val() || {};
    renderStudentsTable();
  });
}

// Corrected: Now filtering by subject as well as teacher/class
function renderStudentsTable() {
  const table = document.getElementById('studentsTable');
  if (!table) return;

  // header
  table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Absences</th><th>Actions</th></tr>`;

  if (!allStudents || !auth.currentUser) return;

  for (const id in allStudents) {
    const s = allStudents[id];
    if (!s) continue;

    // teacher restriction — teacher sees only their students
    if (s.teacher !== auth.currentUser.uid) continue;

    // class filter
    if (currentClassFilter && s.class !== currentClassFilter) continue;

    // subject filter (NEW!)
    if (teacherProfile?.subject && s.subject !== teacherProfile.subject) continue;

    const row = table.insertRow();
    row.insertCell(0).innerText = s.name || '';
    row.insertCell(1).innerText = s.class || '';

    const absences = Object.values(s.attendance || {}).filter(v => v === 'absent').length;
    row.insertCell(2).innerText = absences;

    const actionCell = row.insertCell(3);

    // Edit button (only for teacher)
    const editBtn = document.createElement('button');
    editBtn.innerText = 'Edit';
    editBtn.onclick = async () => {
      const newName = prompt('Edit student name', s.name || '');
      if (!newName) return;
      try {
        await set(ref(db, `students/${id}/name`), newName);
      } catch (err) { alert('Failed to edit name'); console.error(err); }
    };
    actionCell.appendChild(editBtn);

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.innerText = 'Delete';
    delBtn.onclick = async () => {
      if (!confirm('Delete this student?')) return;
      try {
        await set(ref(db, `students/${id}`), null); // remove node
      } catch (err) { alert('Delete failed'); console.error(err); }
    };
    actionCell.appendChild(delBtn);

    // Mark Attendance button
    const markBtn = document.createElement('button');
    markBtn.innerText = 'Mark Attendance';
    markBtn.onclick = () => {
      localStorage.setItem('selectedStudentId', id);
      if (document.getElementById('attendanceModal')) {
        openAttendanceModal(id);
      } else {
        window.location.href = 'mark-attendance.html';
      }
    };
    actionCell.appendChild(markBtn);
  }
}

/* ...rest of your code remains unchanged as you've shared above, it all works as expected... */