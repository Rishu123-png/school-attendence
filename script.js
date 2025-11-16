// ======================= Firebase Setup =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, push, get, child, update, remove, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Replace with your Firebase config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DB_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_BUCKET",
    messagingSenderId: "YOUR_MSG_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase();

// ======================= Global Variables =======================
let currentTeacher = null;
let allStudents = {};
let selectedStudentId = null;

// ======================= Login/Signup =========================
window.signup = function() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const uid = userCredential.user.uid;
            // Save teacher in DB
            set(ref(db, 'teachers/' + uid), {
                email: email,
                name: "",
                subjects: []
            });
            alert("Signup successful! Please enter your name & subject in dashboard.");
        })
        .catch((error) => alert(error.message));
}

window.login = function() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            currentTeacher = userCredential.user;
            document.getElementById("loginDiv").classList.add("hidden");
            document.getElementById("dashboard").classList.remove("hidden");
            loadTeacherInfo();
        })
        .catch((error) => alert(error.message));
}

window.logout = function() {
    signOut(auth).then(() => {
        currentTeacher = null;
        document.getElementById("dashboard").classList.add("hidden");
        document.getElementById("loginDiv").classList.remove("hidden");
    });
}

// ======================= Load Teacher Info ======================
function loadTeacherInfo() {
    const teacherRef = ref(db, 'teachers/' + currentTeacher.uid);
    onValue(teacherRef, (snapshot) => {
        const data = snapshot.val();
        document.getElementById("teacherName").innerText = data.name || "Teacher";
        populateSubjectFilter(data.subjects || []);
        loadStudents();
    });
}

// ======================= Subject Filter =======================
function populateSubjectFilter(subjects) {
    const select = document.getElementById("subjectFilter");
    select.innerHTML = "<option value='all'>All Subjects</option>";
    subjects.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub;
        opt.innerText = sub;
        select.appendChild(opt);
    });
}

// ======================= Load Students ========================
function loadStudents() {
    const subjectFilter = document.getElementById("subjectFilter").value;
    const studentsRef = ref(db, 'students');
    onValue(studentsRef, (snapshot) => {
        allStudents = snapshot.val() || {};
        displayStudents(subjectFilter);
        displayBunkingReport();
    });
}

// ======================= Display Students Table =================
function displayStudents(filter) {
    const table = document.getElementById("studentsTable");
    table.innerHTML = `
        <tr>
          <th>Name</th>
          <th>Class</th>
          <th>Subject</th>
          <th>Attendance</th>
          <th>Edit</th>
          <th>Delete</th>
        </tr>
    `;

    for (let id in allStudents) {
        const student = allStudents[id];
        if (filter !== 'all' && student.subject !== filter) continue;

        const row = table.insertRow();
        row.insertCell(0).innerText = student.name;
        row.insertCell(1).innerText = student.class;
        row.insertCell(2).innerText = student.subject;

        // Attendance count
        const totalAbsent = Object.values(student.attendance || {}).filter(s => s === "absent").length;
        row.insertCell(3).innerText = totalAbsent;

        // Edit button
        const editCell = row.insertCell(4);
        const editBtn = document.createElement("button");
        editBtn.innerText = "Edit";
        if (student.teacher === currentTeacher.uid) {
            editBtn.onclick = () => editStudentPrompt(id);
        } else {
            editBtn.disabled = true;
        }
        editCell.appendChild(editBtn);

        // Delete button
        const delCell = row.insertCell(5);
        const delBtn = document.createElement("button");
        delBtn.innerText = "Delete";
        if (student.teacher === currentTeacher.uid) {
            delBtn.onclick = () => deleteStudent(id);
        } else {
            delBtn.disabled = true;
        }
        delCell.appendChild(delBtn);

        // Click row to view calendar
        row.onclick = () => openAttendanceModal(id);
    }
}

// ======================= Add/Edit/Delete Students ==================
window.addStudent = function() {
    const name = document.getElementById("studentName").value;
    const className = document.getElementById("studentClass").value;
    const subject = document.getElementById("subjectFilter").value;
    if (!name || !className || !subject) { alert("Enter all fields"); return; }

    const newStudentRef = push(ref(db, 'students'));
    set(newStudentRef, {
        name: name,
        class: className,
        subject: subject,
        teacher: currentTeacher.uid,
        attendance: {}
    });
    document.getElementById("studentName").value = "";
    document.getElementById("studentClass").value = "";
}

function editStudentPrompt(id) {
    const newName = prompt("Enter new name:", allStudents[id].name);
    if (!newName) return;
    update(ref(db, 'students/' + id), { name: newName });
}

function deleteStudent(id) {
    if (!confirm("Delete this student?")) return;
    remove(ref(db, 'students/' + id));
}

// ======================= Bunking Report =========================
function displayBunkingReport() {
    const table = document.getElementById("bunkingTable");
    table.innerHTML = `
        <tr>
          <th>Name</th>
          <th>Class</th>
          <th>Subject</th>
          <th>Absences</th>
        </tr>
    `;
    const bunkers = [];
    for (let id in allStudents) {
        const student = allStudents[id];
        const totalAbsent = Object.values(student.attendance || {}).filter(s => s === "absent").length;
        if (totalAbsent > 0) bunkers.push({ ...student, totalAbsent });

    }
    // Sort by most absent
    bunkers.sort((a, b) => b.totalAbsent - a.totalAbsent);

    bunkers.forEach(student => {
        const row = table.insertRow();
        row.insertCell(0).innerText = student.name;
        row.insertCell(1).innerText = student.class;
        row.insertCell(2).innerText = student.subject;
        const cell = row.insertCell(3);
        cell.innerText = student.totalAbsent;
        if (student.totalAbsent >= 3) {
            cell.style.color = "red"; // highlight top bunkers
        }
    });
}

// ======================= Attendance Modal ======================
function openAttendanceModal(id) {
    selectedStudentId = id;
    const student = allStudents[id];
    document.getElementById("modalStudentName").innerText = student.name;
    document.getElementById("attendanceModal").classList.remove("hidden");
    document.getElementById("modalOverlay").classList.remove("hidden");
    loadAttendanceMonth();
}

window.closeModal = function() {
    document.getElementById("attendanceModal").classList.add("hidden");
    document.getElementById("modalOverlay").classList.add("hidden");
}

// ======================= Load Monthly Attendance =================
window.loadAttendanceMonth = function() {
    const month = document.getElementById("monthPicker").value; // format YYYY-MM
    const table = document.getElementById("attendanceTable");
    table.innerHTML = `<tr><th>Date</th><th>Status</th><th>Mark Present</th><th>Mark Absent</th></tr>`;

    if (!selectedStudentId) return;
    const student = allStudents[selectedStudentId];
    const attendance = student.attendance || {};

    for (let date in attendance) {
        if (month && !date.startsWith(month)) continue;
        const row = table.insertRow();
        row.insertCell(0).innerText = date;
        row.insertCell(1).innerText = attendance[date];

        const presentBtn = row.insertCell(2).appendChild(document.createElement("button"));
        presentBtn.innerText = "Present";
        presentBtn.onclick = () => markAttendance(date, "present");

        const absentBtn = row.insertCell(3).appendChild(document.createElement("button"));
        absentBtn.innerText = "Absent";
        absentBtn.onclick = () => markAttendance(date, "absent");
    }
}

// ======================= Mark Attendance ======================
function markAttendance(date, status) {
    if (!selectedStudentId) return;
    const path = 'students/' + selectedStudentId + '/attendance/' + date;
    set(ref(db, path), status);
}

// ======================= Print Monthly Report ==================
window.printReport = function() {
    const printContents = document.getElementById("attendanceModal").innerHTML;
    const w = window.open("", "", "width=800,height=600");
    w.document.write(printContents);
    w.document.close();
    w.print();
}

// ======================= Tabs ================================
window.showTab = function(tabId) {
    document.getElementById("studentsTab").classList.add("hidden");
    document.getElementById("bunkingTab").classList.add("hidden");
    document.getElementById(tabId).classList.remove("hidden");
}