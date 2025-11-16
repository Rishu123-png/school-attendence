// script.js
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { ref, set, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

let currentTeacher = null;

// ---------- LOGIN PAGE ----------
export async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    currentTeacher = userCredential.user;
    window.location.href = "dashboard.html";
  } catch(e) {
    alert(e.message);
  }
}

// ---------- LOGOUT ----------
export function logout() {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
}

// ---------- DASHBOARD ----------
export function loadTeacherProfile() {
  const nameEl = document.getElementById('teacherName');
  const subjectEl = document.getElementById('teacherSubject');
  const classSelect = document.getElementById('classSelect');

  const teacherRef = ref(db, 'teachers/' + currentTeacher.uid);
  onValue(teacherRef, (snapshot) => {
    const data = snapshot.val();
    nameEl.innerText = data.name || "Teacher";
    subjectEl.innerText = data.subject || "Subject not assigned";

    // Populate classes dropdown
    classSelect.innerHTML = "";
    if (data.classes) {
      for (let cls in data.classes) {
        const opt = document.createElement('option');
        opt.value = data.classes[cls];
        opt.innerText = data.classes[cls];
        classSelect.appendChild(opt);
      }
    }
  });
}

// ---------- ADD STUDENTS ----------
export function addStudent() {
  const name = document.getElementById('studentName').value;
  const cls = document.getElementById('classSelectAdd').value;
  if (!name || !cls) return alert("Enter all fields");
  const newRef = push(ref(db, 'students'));
  set(newRef, {
    name,
    class: cls,
    subject: document.getElementById('teacherSubjectAdd').innerText,
    teacher: currentTeacher.uid,
    attendance: {}
  });
  alert("Student added!");
  document.getElementById('studentName').value = "";
}

// ---------- LOAD STUDENTS ----------
export function loadStudents(className) {
  const table = document.getElementById('studentsTable');
  table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Attendance</th><th>Actions</th></tr>`;
  const studentsRef = ref(db, 'students');
  onValue(studentsRef, (snapshot) => {
    const data = snapshot.val() || {};
    for (let id in data) {
      const s = data[id];
      if (s.class !== className || s.teacher !== currentTeacher.uid) continue;
      const row = table.insertRow();
      row.insertCell(0).innerText = s.name;
      row.insertCell(1).innerText = s.class;
      const totalAbsent = Object.values(s.attendance || {}).filter(a => a==="absent").length;
      row.insertCell(2).innerText = totalAbsent;
      const actions = row.insertCell(3);
      const markBtn = document.createElement('button');
      markBtn.innerText = "Mark Attendance";
      markBtn.onclick = () => { localStorage.setItem("selectedClass", className); localStorage.setItem("selectedStudentId", id); window.location.href = "mark-attendance.html"; };
      actions.appendChild(markBtn);
    }
  });
}

// ---------- MARK ATTENDANCE ----------
export function loadAttendance() {
  const studentId = localStorage.getItem("selectedStudentId");
  const table = document.getElementById('attendanceTable');
  table.innerHTML = `<tr><th>Date</th><th>Status</th><th>Present</th><th>Absent</th></tr>`;
  if (!studentId) return;
  const studentRef = ref(db, 'students/' + studentId);
  onValue(studentRef, (snapshot) => {
    const s = snapshot.val();
    const attendance = s.attendance || {};
    for (let date in attendance) {
      const row = table.insertRow();
      row.insertCell(0).innerText = date;
      row.insertCell(1).innerText = attendance[date];
      const pBtn = row.insertCell(2).appendChild(document.createElement('button'));
      pBtn.innerText = "Present";
      pBtn.onclick = () => set(ref(db, 'students/' + studentId + '/attendance/' + date), 'present');
      const aBtn = row.insertCell(3).appendChild(document.createElement('button'));
      aBtn.innerText = "Absent";
      aBtn.onclick = () => set(ref(db, 'students/' + studentId + '/attendance/' + date), 'absent');
    }
  });
}

// ---------- TOP BUNKERS ----------
export function loadTopBunkers() {
  const table = document.getElementById('bunkersTable');
  table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Subject</th><th>Absences</th></tr>`;
  const studentsRef = ref(db, 'students');
  onValue(studentsRef, (snapshot) => {
    const data = snapshot.val() || {};
    const bunkers = [];
    for (let id in data) {
      const s = data[id];
      if (s.teacher !== currentTeacher.uid) continue;
      const totalAbsent = Object.values(s.attendance || {}).filter(a => a==="absent").length;
      if (totalAbsent>0) bunkers.push({name:s.name, class:s.class, subject:s.subject, totalAbsent});
    }
    bunkers.sort((a,b)=>b.totalAbsent - a.totalAbsent);
    for (let s of bunkers) {
      const row = table.insertRow();
      row.insertCell(0).innerText = s.name;
      row.insertCell(1).innerText = s.class;
      row.insertCell(2).innerText = s.subject;
      const cell = row.insertCell(3);
      cell.innerText = s.totalAbsent;
      if (s.totalAbsent>=3) cell.classList.add("top-bunker");
    }
  });
}