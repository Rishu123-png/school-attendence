// dashboard.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { waitForAuth } from "./script.js";

export let allStudents = {}; 
let teacherProfile = null;

// -------------------------
// INIT DASHBOARD PAGE
// -------------------------
export function initDashboardPage() {
  waitForAuth(async () => {
    loadTeacherProfile();
    
    const classSel = document.getElementById("classSelect");
    if (classSel) {
      classSel.onchange = () => loadStudents(classSel.value || "");
    }

    loadStudents();
  });
}

// expose function globally for HTML onload=""
window.initDashboardPage = initDashboardPage;


// -------------------------
// LOAD TEACHER PROFILE
// -------------------------
export function loadTeacherProfile() {
  const user = auth.currentUser;
  if (!user) return setTimeout(loadTeacherProfile, 200);

  const teacherRef = ref(db, `teachers/${user.uid}`);

  onValue(teacherRef, snap => {
    const data = snap.val() || {};
    teacherProfile = data;

    // Fill teacher name + subject
    const nameEl = document.getElementById("teacherName");
    if (nameEl) nameEl.innerText = data.name || "";

    const subjectEl = document.getElementById("teacherSubject");
    if (subjectEl) subjectEl.innerText = data.subject || "";

    // Fill class dropdowns
    const teacherClasses = data.classes || {};
    const classList = Array.isArray(teacherClasses)
      ? teacherClasses
      : Object.keys(teacherClasses).length
        ? Object.values(teacherClasses)
        : [];

    ["classSelect", "classSelectAdd", "analyticsClassSelect"].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;

      sel.innerHTML = '<option value="">-- Select class --</option>';
      classList.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.innerText = c;
        sel.appendChild(opt);
      });
    });
  });
}


// -------------------------
// LOAD STUDENTS
// -------------------------
export function loadStudents(filterClass = "") {
  const studentsRef = ref(db, "students");

  onValue(studentsRef, snap => {
    allStudents = snap.val() || {};
    renderStudentsTable(filterClass);
  });
}


// -------------------------
// RENDER STUDENT TABLE
// -------------------------
function renderStudentsTable(filterClass = "") {
  const table = document.getElementById("studentsTable");
  if (!table) return;

  table.innerHTML = `
    <tr>
      <th>Name</th>
      <th>Class</th>
      <th>Absences</th>
      <th>Actions</th>
    </tr>
  `;

  if (!allStudents) return;

  for (const id in allStudents) {
    const s = allStudents[id];
    if (!s) continue;

    // Only show students of selected class
    if (filterClass && s.class !== filterClass) continue;

    // Only show students owned by this teacher
    if (s.teacher && auth.currentUser && s.teacher !== auth.currentUser.uid) continue;

    const row = table.insertRow();
    row.insertCell(0).innerText = s.name || "";
    row.insertCell(1).innerText = s.class || "";

    // Absence count
    const absences = Object.values(s.attendance || {}).filter(v => v === "absent").length;
    row.insertCell(2).innerText = absences;

    const actionCell = row.insertCell(3);

    // CLAIM BUTTON
    if (!s.teacher) {
      const claimBtn = document.createElement("button");
      claimBtn.innerText = "Claim";
      claimBtn.onclick = () => claimStudent(id);
      actionCell.appendChild(claimBtn);
    }

    // EDIT BUTTON
    const editBtn = document.createElement("button");
    editBtn.innerText = "Edit";
    editBtn.disabled = !(s.teacher && auth.currentUser && s.teacher === auth.currentUser.uid);
    editBtn.onclick = async () => {
      const newName = prompt("Edit student name", s.name || "");
      if (!newName) return;
      await set(ref(db, `students/${id}/name`), newName);
    };
    actionCell.appendChild(editBtn);

    // DELETE BUTTON
    const delBtn = document.createElement("button");
    delBtn.innerText = "Delete";
    delBtn.disabled = !(s.teacher && auth.currentUser && s.teacher === auth.currentUser.uid);
    delBtn.onclick = async () => {
      if (!confirm("Delete this student?")) return;
      await set(ref(db, `students/${id}`), null);
    };
    actionCell.appendChild(delBtn);

    // MARK ATTENDANCE BUTTON
    const markBtn = document.createElement("button");
    markBtn.innerText = "Mark Attendance";
    markBtn.disabled = !(s.teacher && auth.currentUser && s.teacher === auth.currentUser.uid);
    markBtn.onclick = () => {
      localStorage.removeItem("selectedClass");
      localStorage.setItem("selectedStudentId", id);
      window.location.href = "mark-attendance.html";
    };
    actionCell.appendChild(markBtn);
  }
}


// -------------------------
// CLAIM STUDENT
// -------------------------
export async function claimStudent(studentId) {
  if (!auth.currentUser) return alert("Please login");

  if (!confirm("Claim this student?")) return;

  try {
    await set(ref(db, `students/${studentId}/teacher`), auth.currentUser.uid);
    alert("Student claimed");
    loadStudents();
  } catch (err) {
    console.error(err);
    alert("Failed to claim student");
  }
}