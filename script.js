// ================= Firebase imports =================
import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { ref, set, push, get, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// ================= Global Variables =================
let currentTeacher = null;
let allStudents = {};
let selectedClass = null;
let selectedStudentId = null;

// ================= Helper: Show / Hide Pages =================
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(pageId).classList.remove("hidden");
  // Show logout button except on login page
  document.getElementById("logoutBtn").style.display = pageId === "loginPage" ? "none" : "block";
}

// ================= Login =================
window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) return document.getElementById("loginMsg").innerText = "Enter email and password";

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    currentTeacher = userCredential.user;
    loadTeacherData();
  } catch (error) {
    document.getElementById("loginMsg").innerText = error.message;
  }
}

// ================= Logout =================
window.logout = function () {
  signOut(auth).then(() => {
    currentTeacher = null;
    showPage("loginPage");
  });
}

// ================= Load Teacher Data =================
function loadTeacherData() {
  const teacherRef = ref(db, "teachers/" + currentTeacher.uid);
  onValue(teacherRef, (snapshot) => {
    const data = snapshot.val();
    document.getElementById("teacherName").innerText = data.name || "Teacher";
    document.getElementById("teacherSubject").innerText = data.subject || "";
    populateClasses(data.classes || {});
    showPage("dashboardPage");
  });
}

// ================= Populate Classes =================
function populateClasses(classesObj) {
  const select = document.getElementById("classFilter");
  select.innerHTML = "<option value=''>Select Class</option>";
  for (let key in classesObj) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.innerText = classesObj[key];
    select.appendChild(opt);
  }
}

// ================= Load Students =================
window.loadStudents = function () {
  selectedClass = document.getElementById("classFilter").value;
  if (!selectedClass) return;

  const studentsRef = ref(db, "students");
  onValue(studentsRef, (snapshot) => {
    allStudents = snapshot.val() || {};
    displayStudents();
  });
}

// ================= Display Students =================
function displayStudents() {
  const tableDiv = document.getElementById("studentsTableDiv");
  tableDiv.classList.remove("hidden");

  const table = document.getElementById("studentsTable");
  table.innerHTML = "<tr><th>Name</th><th>Actions</th></tr>";

  for (let id in allStudents) {
    const student = allStudents[id];
    if (student.class === selectedClass && student.subject === document.getElementById("teacherSubject").innerText) {
      const row = table.insertRow();
      row.insertCell(0).innerText = student.name;

      const actionCell = row.insertCell(1);
      const markBtn = document.createElement("button");
      markBtn.innerText = "Mark Attendance";
      markBtn.onclick = () => openAttendancePage(selectedClass);
      actionCell.appendChild(markBtn);
    }
  }
}

// ================= Show Add Student Form =================
window.showAddStudentForm = function () {
  document.getElementById("addStudentClass").innerText = selectedClass || "";
  document.getElementById("addStudentSubject").innerText = document.getElementById("teacherSubject").innerText;
  document.getElementById("studentName").value = "";
  showPage("addStudentPage");
}

// ================= Add Student =================
window.addStudent = function () {
  const name = document.getElementById("studentName").value.trim();
  if (!name || !selectedClass) return alert("Enter student name and select class");

  const newStudentRef = push(ref(db, "students"));
  set(newStudentRef, {
    name: name,
    class: selectedClass,
    subject: document.getElementById("teacherSubject").innerText,
    teacher: currentTeacher.uid,
    attendance: {}
  });
  alert("Student added successfully!");
  backToDashboard();
}

// ================= Back to Dashboard =================
window.backToDashboard = function () {
  showPage("dashboardPage");
  loadStudents();
}

// ================= Mark Attendance =================
window.showMarkAttendance = function () {
  if (!selectedClass) return alert("Select a class first");
  openAttendancePage(selectedClass);
}

function openAttendancePage(className) {
  document.getElementById("attendanceClassName").innerText = className;
  const table = document.getElementById("attendanceTable");
  table.innerHTML = "<tr><th>Name</th><th>Present</th><th>Absent</th></tr>";

  for (let id in allStudents) {
    const student = allStudents[id];
    if (student.class === className && student.subject === document.getElementById("teacherSubject").innerText) {
      const row = table.insertRow();
      row.insertCell(0).innerText = student.name;

      const presentCell = row.insertCell(1);
      const presentBtn = document.createElement("button");
      presentBtn.innerText = "Present";
      presentBtn.onclick = () => markAttendance(id, new Date().toISOString().slice(0,10), "present");
      presentCell.appendChild(presentBtn);

      const absentCell = row.insertCell(2);
      const absentBtn = document.createElement("button");
      absentBtn.innerText = "Absent";
      absentBtn.onclick = () => markAttendance(id, new Date().toISOString().slice(0,10), "absent");
      absentCell.appendChild(absentBtn);
    }
  }
  showPage("attendancePage");
}

// ================= Mark Attendance =================
function markAttendance(studentId, date, status) {
  const path = "students/" + studentId + "/attendance/" + date;
  set(ref(db, path), status);
  alert("Attendance saved!");
}

// ================= Attendance Modal =================
window.openAttendanceModal = function () {
  document.getElementById("modalStudentName").innerText = selectedClass;
  document.getElementById("attendanceModal").classList.remove("hidden");
  document.getElementById("modalOverlay").classList.remove("hidden");

  loadAttendanceMonth();
}

window.closeModal = function () {
  document.getElementById("attendanceModal").classList.add("hidden");
  document.getElementById("modalOverlay").classList.add("hidden");
}

// ================= Load Month Attendance =================
window.loadAttendanceMonth = function () {
  const month = document.getElementById("monthPicker").value; // YYYY-MM
  const table = document.getElementById("attendanceMonthTable");
  table.innerHTML = "<tr><th>Date</th><th>Status</th></tr>";

  for (let id in allStudents) {
    const student = allStudents[id];
    if (student.class === selectedClass && student.subject === document.getElementById("teacherSubject").innerText) {
      const attendance = student.attendance || {};
      for (let date in attendance) {
        if (month && !date.startsWith(month)) continue;
        const row = table.insertRow();
        row.insertCell(0).innerText = date;
        row.insertCell(1).innerText = attendance[date];
      }
    }
  }
}

// ================= Print Report =================
window.printReport = function () {
  const printContents = document.getElementById("attendanceModal").innerHTML;
  const w = window.open("", "", "width=800,height=600");
  w.document.write(printContents);
  w.document.close();
  w.print();
}

// ================= Top Bunkers =================
window.showTopBunkers = function () {
  const table = document.getElementById("bunkingTable");
  table.innerHTML = "<tr><th>Name</th><th>Class</th><th>Subject</th><th>Absences</th></tr>";
  const bunkers = [];

  for (let id in allStudents) {
    const student = allStudents[id];
    if (student.subject !== document.getElementById("teacherSubject").innerText) continue;
    const totalAbsent = Object.values(student.attendance || {}).filter(s => s === "absent").length;
    if (totalAbsent > 0) bunkers.push({ ...student, totalAbsent });
  }

  bunkers.sort((a,b) => b.totalAbsent - a.totalAbsent);

  bunkers.forEach(student => {
    const row = table.insertRow();
    row.insertCell(0).innerText = student.name;
    row.insertCell(1).innerText = student.class;
    row.insertCell(2).innerText = student.subject;
    const cell = row.insertCell(3);
    cell.innerText = student.totalAbsent;
    if (student.totalAbsent >= 3) cell.style.color = "red";
  });

  showPage("bunkersPage");
}