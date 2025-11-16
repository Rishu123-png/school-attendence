// ======================= Imports and Firebase =======================
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { ref, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// ======================= Global Variables =======================
let currentTeacher = null;  // Holds current logged-in teacher
let allStudents = {};        // All students from RTDB
let selectedStudentId = null; // Student selected for attendance modal

// ======================= Login / Signup =========================
window.signup = function() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!email || !password) { alert("Please enter both email and password"); return; }

    createUserWithEmailAndPassword(auth, email, password)
        .then(userCredential => {
            const uid = userCredential.user.uid;
            // Create teacher node in RTDB
            set(ref(db, 'teachers/' + uid), {
                email: email,
                name: "",
                subjects: []
            });
            alert("Signup successful! Please login now.");
        })
        .catch(error => alert(error.message));
}

window.login = function() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!email || !password) { alert("Please enter both email and password"); return; }

    signInWithEmailAndPassword(auth, email, password)
        .then(userCredential => {
            currentTeacher = userCredential.user;
            // Hide login page, show dashboard
            document.getElementById("loginPage").classList.add("hidden");
            document.getElementById("dashboardPage").classList.remove("hidden");
            loadTeacherInfo();
        })
        .catch(error => alert(error.message));
}

window.logout = function() {
    signOut(auth).then(() => {
        currentTeacher = null;
        document.getElementById("dashboardPage").classList.add("hidden");
        document.getElementById("loginPage").classList.remove("hidden");
    });
}

// ======================= Load Teacher Info =======================
function loadTeacherInfo() {
    const teacherRef = ref(db, 'teachers/' + currentTeacher.uid);
    onValue(teacherRef, snapshot => {
        const data = snapshot.val();
        document.getElementById("teacherName").innerText = data.name || "Teacher";
        populateSubjects(data.subjects || []);
        populateAddStudentSubjects(data.subjects || []);
        loadStudents();
    });
}

// Populate dropdown to filter subjects
function populateSubjects(subjects) {
    const select = document.getElementById("subjectFilter");
    select.innerHTML = "<option value='all'>All Subjects</option>";
    subjects.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub;
        opt.innerText = sub;
        select.appendChild(opt);
    });
}

// Populate dropdown for adding students
function populateAddStudentSubjects(subjects) {
    const select = document.getElementById("subjectFilterAdd");
    select.innerHTML = "";
    subjects.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub;
        opt.innerText = sub;
        select.appendChild(opt);
    });
}

// ======================= Load Students =======================
function loadStudents() {
    const filter = document.getElementById("subjectFilter").value;
    const studentsRef = ref(db, 'students');
    onValue(studentsRef, snapshot => {
        allStudents = snapshot.val() || {};
        displayStudents(filter);
        displayBunkers();
    });
}

// ======================= Display Students Table =======================
function displayStudents(filter) {
    const table = document.getElementById("studentsTable");
    table.innerHTML = `
        <tr>
            <th>Name</th>
            <th>Class</th>
            <th>Subject</th>
            <th>Absences</th>
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
        const absentCount = Object.values(student.attendance || {}).filter(a => a === 'absent').length;
        row.insertCell(3).innerText = absentCount;

        // Edit Button
        const editCell = row.insertCell(4);
        const editBtn = document.createElement("button");
        editBtn.innerText = "Edit";
        editBtn.disabled = student.teacher !== currentTeacher.uid;
        editBtn.onclick = () => editStudentPrompt(id);
        editCell.appendChild(editBtn);

        // Delete Button
        const delCell = row.insertCell(5);
        const delBtn = document.createElement("button");
        delBtn.innerText = "Delete";
        delBtn.disabled = student.teacher !== currentTeacher.uid;
        delBtn.onclick = () => deleteStudent(id);
        delCell.appendChild(delBtn);

        // Click row to open attendance modal
        row.onclick = () => openAttendanceModal(id);
    }
}

// ======================= Add/Edit/Delete Student =======================
window.addStudent = function() {
    const name = document.getElementById("studentName").value;
    const cls = document.getElementById("studentClass").value;
    const subj = document.getElementById("subjectFilterAdd").value;

    if (!name || !cls || !subj) { alert("Enter all fields"); return; }

    const newStudentRef = push(ref(db, 'students'));
    set(newStudentRef, {
        name: name,
        class: cls,
        subject: subj,
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

// ======================= Attendance Modal =======================
function openAttendanceModal(id) {
    selectedStudentId = id;
    const student = allStudents[id];
    document.getElementById("modalStudentName").innerText = student.name;
    document.getElementById("attendanceModal").classList.remove("hidden");
    loadAttendanceMonth();
}

window.closeModal = function() {
    document.getElementById("attendanceModal").classList.add("hidden");
}

// ======================= Calendar & Monthly Attendance =======================
function createCalendar(year, month) {
    const container = document.getElementById("calendarContainer");
    container.innerHTML = '';
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const div = document.createElement("div");
        div.innerText = day;
        div.style.cssText = "width:40px;height:40px;margin:2px;display:flex;align-items:center;justify-content:center;border:1px solid #ccc;cursor:pointer";
        
        const status = allStudents[selectedStudentId]?.attendance?.[dateStr];
        div.style.backgroundColor = status === 'present' ? 'green' : status === 'absent' ? 'red' : '#eee';
        div.style.color = status ? '#fff' : '#000';

        div.onclick = () => {
            const newStatus = status === 'present' ? 'absent' : 'present';
            markAttendance(dateStr, newStatus);
            createCalendar(year, month);  // Refresh calendar
            loadAttendanceMonth();        // Refresh table
        };

        container.appendChild(div);
    }
}

window.loadAttendanceMonth = function() {
    const monthVal = document.getElementById("monthPicker").value;
    if (!monthVal || !selectedStudentId) return;

    const [year, month] = monthVal.split('-').map(Number);
    createCalendar(year, month);

    const table = document.getElementById("attendanceTable");
    table.innerHTML = `<tr><th>Date</th><th>Status</th><th>Mark Present</th><th>Mark Absent</th></tr>`;
    const attendance = allStudents[selectedStudentId].attendance || {};

    for (let date in attendance) {
        if (!date.startsWith(monthVal)) continue;
        const row = table.insertRow();
        row.insertCell(0).innerText = date;
        row.insertCell(1).innerText = attendance[date];

        const pBtn = document.createElement("button");
        pBtn.innerText = "Present";
        pBtn.onclick = () => markAttendance(date, "present");
        row.insertCell(2).appendChild(pBtn);

        const aBtn = document.createElement("button");
        aBtn.innerText = "Absent";
        aBtn.onclick = () => markAttendance(date, "absent");
        row.insertCell(3).appendChild(aBtn);
    }
}

function markAttendance(date, status) {
    if (!selectedStudentId) return;
    set(ref(db, `students/${selectedStudentId}/attendance/${date}`), status);
}

// ======================= Print Report ======================
window.printReport = function() {
    const w = window.open("", "", "width=800,height=600");
    w.document.write(document.getElementById("attendanceModal").innerHTML);
    w.document.close();
    w.print();
}

// ======================= Top Bunkers ======================
function displayBunkers() {
    const table = document.getElementById("bunkingTable");
    table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Subject</th><th>Absences</th></tr>`;

    const bunkers = [];
    for (let id in allStudents) {
        const s = allStudents[id];
        const absences = Object.values(s.attendance || {}).filter(a => a === 'absent').length;
        if (absences > 0) bunkers.push({ ...s, absences });
    }

    bunkers.sort((a, b) => b.absences - a.absences);

    bunkers.forEach(student => {
        const row = table.insertRow();
        row.insertCell(0).innerText = student.name;
        row.insertCell(1).innerText = student.class;
        row.insertCell(2).innerText = student.subject;
        const cell = row.insertCell(3);
        cell.innerText = student.absences;
        if (student.absences >= 3) cell.style.color = "red";
    });
}

// ======================= Tabs ======================
window.showTab = function(tabId) {
    document.getElementById("studentsTab").classList.add("hidden");
    document.getElementById("bunkingTab").classList.add("hidden");
    document.getElementById(tabId).classList.remove("hidden");
}