import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  ref,
  get,
  set,
  push,
  update
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

/* ======================================================
   GLOBAL STATE
====================================================== */
let currentUser = null;
let allStudents = {};
let selectedStudentId = null;

/* ======================================================
   AUTH
====================================================== */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

/* LOGIN */
window.login = async function () {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  } catch (e) {
    alert(e.message);
  }
};

/* LOGOUT */
window.logout = async function () {
  await signOut(auth);
  window.location.href = "index.html";
};

/* ======================================================
   DASHBOARD
====================================================== */

window.initDashboardPage = async function () {
  if (!auth.currentUser) return setTimeout(initDashboardPage, 300);
  await loadStudents();
};

async function loadStudents() {
  const snap = await get(ref(db, "students"));
  allStudents = snap.val() || {};
  renderStudents();
}

function renderStudents() {
  const table = document.getElementById("studentsTable");
  if (!table) return;

  table.innerHTML = `
    <tr>
      <th>Name</th>
      <th>Class</th>
      <th>Actions</th>
    </tr>
  `;

  for (const id in allStudents) {
    const s = allStudents[id];

    const row = table.insertRow();
    row.insertCell(0).innerText = s.name;
    row.insertCell(1).innerText = s.class;

    const actionCell = row.insertCell(2);

    // DELETE
    const delBtn = document.createElement("button");
    delBtn.innerText = "Delete";
    delBtn.onclick = async () => {
      await set(ref(db, `students/${id}`), null);
      loadStudents();
    };
    actionCell.appendChild(delBtn);

    // EDIT
    const editBtn = document.createElement("button");
    editBtn.innerText = "Edit";
    editBtn.onclick = async () => {
      const newName = prompt("Edit name", s.name);
      if (!newName) return;
      await update(ref(db, `students/${id}`), { name: newName });
      loadStudents();
    };
    actionCell.appendChild(editBtn);

    // MARK ATTENDANCE
    const markBtn = document.createElement("button");
    markBtn.innerText = "Attendance";
    markBtn.onclick = () => {
      localStorage.setItem("selectedStudentId", id);
      window.location.href = "mark-attendance.html";
    };
    actionCell.appendChild(markBtn);

    // MARKS
    const marksBtn = document.createElement("button");
    marksBtn.innerText = "Marks";
    marksBtn.onclick = () => {
      localStorage.setItem("selectedStudentId", id);
      window.location.href = "marks.html";
    };
    actionCell.appendChild(marksBtn);
  }
}

/* ======================================================
   ADD STUDENT
====================================================== */
window.addStudent = async function () {
  const name = studentName.value.trim();
  const cls = classSelectAdd.value;

  if (!name || !cls) return alert("Fill all fields");

  const newRef = push(ref(db, "students"));
  await set(newRef, {
    name,
    class: cls,
    attendance: {}
  });

  alert("Student added");
  window.location.href = "dashboard.html";
};

/* ======================================================
   ATTENDANCE
====================================================== */
window.initMarkAttendancePage = async function () {
  const id = localStorage.getItem("selectedStudentId");
  if (!id) return alert("No student selected");

  const snap = await get(ref(db, `students/${id}`));
  const data = snap.val();

  studentNameLabel.innerText = data.name;

  renderAttendance(id, data.attendance || {});
};

function renderAttendance(id, attendance) {
  const table = document.getElementById("markAttendanceTable");
  table.innerHTML = `
    <tr><th>Date</th><th>Status</th><th>Present</th><th>Absent</th></tr>
  `;

  const today = new Date();
  const days = 30;

  for (let i = 1; i <= days; i++) {
    const date = `2024-01-${String(i).padStart(2, "0")}`;

    const row = table.insertRow();
    row.insertCell(0).innerText = date;
    row.insertCell(1).innerText = attendance[date] || "-";

    const pBtn = document.createElement("button");
    pBtn.innerText = "Present";
    pBtn.onclick = () => updateAttendance(id, date, "present");

    const aBtn = document.createElement("button");
    aBtn.innerText = "Absent";
    aBtn.onclick = () => updateAttendance(id, date, "absent");

    row.insertCell(2).appendChild(pBtn);
    row.insertCell(3).appendChild(aBtn);
  }
}

async function updateAttendance(id, date, status) {
  await set(ref(db, `students/${id}/attendance/${date}`), status);
  initMarkAttendancePage();
}

/* ======================================================
   MARKS & PREDICTION
====================================================== */

window.initMarksPage = async function () {
  const id = localStorage.getItem("selectedStudentId");
  if (!id) return alert("No student selected");

  const snap = await get(ref(db, `students/${id}`));
  const data = snap.val();

  marksStudentName.innerText = data.name;

  const m = data.marks || {};

  ut1Score.value = m.ut1Score || "";
  ut1Max.value = m.ut1Max || 25;

  hyScore.value = m.hyScore || "";
  hyMax.value = m.hyMax || 100;

  ut2Score.value = m.ut2Score || "";
  ut2Max.value = m.ut2Max || 25;

  annualScore.value = m.annualScore || "";
  annualMax.value = m.annualMax || 100;

  drawChart(m);
};

/* SAVE MARKS */
window.saveMarks = async function () {
  const id = localStorage.getItem("selectedStudentId");

  await update(ref(db, `students/${id}/marks`), {
    ut1Score: ut1Score.value,
    ut1Max: ut1Max.value,
    hyScore: hyScore.value,
    hyMax: hyMax.value,
    ut2Score: ut2Score.value,
    ut2Max: ut2Max.value,
    annualScore: annualScore.value,
    annualMax: annualMax.value
  });

  alert("Saved!");
};

/* FIXED PREDICTION */
window.recomputePrediction = function () {
  const ut1 = ut1Score.value / ut1Max.value;
  const hy = hyScore.value / hyMax.value;

  const avg = (ut1 + hy) / 2;

  const ut2 = Math.round(avg * ut2Max.value);
  const annual = Math.round(avg * annualMax.value);

  ut2Score.value = ut2;
  annualScore.value = annual;

  predictionSummary.innerText =
    `UT-2: ${ut2}\nAnnual: ${annual}`;
};

/* STUDY HOURS */
window.predictStudyHourMarks = function () {
  const hours = studyHours.value;
  const score = Math.min(100, hours * 7);

  studyHourPrediction.innerText =
    `Predicted: ${score}`;
};

/* CHART */
let chart;
function drawChart(m) {
  const ctx = document.getElementById("performanceChart");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["UT1", "HY", "UT2", "Annual"],
      datasets: [{
        label: "Marks",
        data: [
          m.ut1Score || 0,
          m.hyScore || 0,
          m.ut2Score || 0,
          m.annualScore || 0
        ]
      }]
    }
  });
}