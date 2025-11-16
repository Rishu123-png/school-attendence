// ================= Firebase Import =================
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { ref, set, push, get, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// ================= Global Variables =================
let currentTeacher = null;
let allStudents = {};
let selectedClass = null;
let selectedStudentId = null;

// ================= Login =================
window.login = async function() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        currentTeacher = userCredential.user;
        document.getElementById("loginDiv").classList.add("hidden");
        document.getElementById("dashboard").classList.remove("hidden");
        loadTeacherInfo();
    } catch (error) {
        document.getElementById("loginMsg").innerText = error.message;
    }
}

// ================= Logout =================
window.logout = function() {
    signOut(auth).then(() => {
        currentTeacher = null;
        document.getElementById("dashboard").classList.add("hidden");
        document.getElementById("loginDiv").classList.remove("hidden");
    });
}

// ================= Load Teacher Info =================
function loadTeacherInfo() {
    const teacherRef = ref(db, `teachers/${currentTeacher.uid}`);
    onValue(teacherRef, (snapshot) => {
        const data = snapshot.val();
        document.getElementById("teacherName").innerText = data.name || "Teacher";
        document.getElementById("teacherSubject").innerText = data.subject || "Subject";
        populateClassDropdown(data.classes || {});
        loadStudents();
    });
}

// ================= Populate Class Dropdown =================
function populateClassDropdown(classes) {
    const select = document.getElementById("classFilter");
    select.innerHTML = "<option value=''>Select Class</option>";
    for (let key in classes) {
        const option = document.createElement("option");
        option.value = classes[key];
        option.innerText = classes[key];
        select.appendChild(option);
    }
}

// ================= Class Filter =================
window.loadStudents = function() {
    selectedClass = document.getElementById("classFilter").value;
    const studentsRef = ref(db, 'students');
    onValue(studentsRef, (snapshot) => {
        allStudents = snapshot.val() || {};
        displayStudents();
    });
}

// ================= Display Students Table =================
function displayStudents() {
    const tableDiv = document.getElementById("studentsTableDiv");
    tableDiv.classList.remove("hidden");
    const table = document.getElementById("studentsTable");
    table.innerHTML = `
        <tr>
            <th>Name</th>
            <th>Class</th>
            <th>Subject</th>
            <th>Edit</th>
            <th>Delete</th>
            <th>Mark Attendance</th>
        </tr>
    `;
    for (let id in allStudents) {
        const s = allStudents[id];
        if (s.teacher !== currentTeacher.uid) continue;
        if (selectedClass && s.class !== selectedClass) continue;

        const row = table.insertRow();
        row.insertCell(0).innerText = s.name;
        row.insertCell(1).innerText = s.class;
        row.insertCell(2).innerText = s.subject;

        // Edit button
        const editCell = row.insertCell(3);
        const editBtn = document.createElement("button");
        editBtn.innerText = "Edit";
        editBtn.classList.add("edit");
        editBtn.onclick = () => editStudentPrompt(id);
        editCell.appendChild(editBtn);

        // Delete button
        const delCell = row.insertCell(4);
        const delBtn = document.createElement("button");
        delBtn.innerText = "Delete";
        delBtn.classList.add("delete");
        delBtn.onclick = () => deleteStudent(id);
        delCell.appendChild(delBtn);

        // Mark Attendance button
        const markCell = row.insertCell(5);
        const markBtn = document.createElement("button");
        markBtn.innerText = "Mark Attendance";
        markBtn.onclick = () => openAttendanceModal(id);
        markCell.appendChild(markBtn);
    }
}

// ================= Show Add Student Form =================
window.showAddStudentForm = function() {
    document.getElementById("addStudentDiv").classList.remove("hidden");
}

// ================= Add Student =================
window.addStudent = function() {
    const name = document.getElementById("studentName").value.trim();
    if (!name || !selectedClass) { alert("Enter student name and select class."); return; }

    const newStudentRef = push(ref(db, 'students'));
    set(newStudentRef, {
        name: name,
        class: selectedClass,
        subject: document.getElementById("teacherSubject").innerText,
        teacher: currentTeacher.uid,
        attendance: {}
    });
    document.getElementById("studentName").value = "";
    document.getElementById("addStudentDiv").classList.add("hidden");
}

// ================= Edit/Delete Student =================
function editStudentPrompt(id) {
    const newName = prompt("Enter new name:", allStudents[id].name);
    if (!newName) return;
    update(ref(db, `students/${id}`), { name: newName });
}

function deleteStudent(id) {
    if (!confirm("Delete this student?")) return;
    remove(ref(db, `students/${id}`));
}

// ================= Open Attendance Modal =================
function openAttendanceModal(studentId) {
    selectedStudentId = studentId;
    const student = allStudents[studentId];
    document.getElementById("attendanceModal").classList.remove("hidden");
    document.getElementById("modalOverlay").classList.remove("hidden");
    document.getElementById("attendanceClassName").innerText = student.class;
    loadAttendanceMonth();
}

// ================= Close Modal =================
window.closeModal = function() {
    document.getElementById("attendanceModal").classList.add("hidden");
    document.getElementById("modalOverlay").classList.add("hidden");
}

// ================= Load Monthly Attendance =================
window.loadAttendanceMonth = function() {
    const month = document.getElementById("monthPicker").value;
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

// ================= Mark Attendance =================
function markAttendance(date, status) {
    if (!selectedStudentId) return;
    const path = `students/${selectedStudentId}/attendance/${date}`;
    set(ref(db, path), status);
}

// ================= Print Monthly Report =================
window.printReport = function() {
    const printContents = document.getElementById("attendanceModal").innerHTML;
    const w = window.open("", "", "width=800,height=600");
    w.document.write(printContents);
    w.document.close();
    w.print();
}

// ================= Top Bunkers =================
window.showTopBunkers = function() {
    const bunkersDiv = document.getElementById("bunkersDiv");
    bunkersDiv.classList.remove("hidden");
    const table = document.getElementById("bunkingTable");
    table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Subject</th><th>Absences</th></tr>`;

    const studentsArray = Object.values(allStudents).filter(s => s.teacher === currentTeacher.uid);
    const bunkerList = studentsArray.map(s => {
        const totalAbsent = Object.values(s.attendance || {}).filter(v => v==="absent").length;
        return { ...s, totalAbsent };
    }).filter(s => s.totalAbsent > 0);

    bunkerList.sort((a,b)=>b.totalAbsent - a.totalAbsent);

    bunkerList.forEach(s => {
        const row = table.insertRow();
        row.insertCell(0).innerText = s.name;
        row.insertCell(1).innerText = s.class;
        row.insertCell(2).innerText = s.subject;
        const cell = row.insertCell(3);
        cell.innerText = s.totalAbsent;
        if(s.totalAbsent >=3) cell.style.color="red";
    });
}

// ================= Show Mark Attendance Section =================
window.showMarkAttendance = function() {
    const classFilter = document.getElementById("classFilter").value;
    if(!classFilter){ alert("Select a class first"); return; }
    // Select first student of class to open modal as default
    const student = Object.values(allStudents).find(s=>s.teacher===currentTeacher.uid && s.class===classFilter);
    if(student) openAttendanceModal(Object.keys(allStudents).find(k=>allStudents[k]===student));
}