import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { ref, set, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

let currentTeacher = null;
let allStudents = {};
let selectedStudentId = null;

// ================= LOGIN / SIGNUP =================
window.signup = function(){
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if(!email || !password){ alert("Enter email & password"); return;}

    createUserWithEmailAndPassword(auth,email,password)
    .then(res=>{
        const uid = res.user.uid;
        set(ref(db,'teachers/'+uid),{email:email,name:"",subjects:[]});
        alert("Signup success! Enter name & subjects in DB.");
    }).catch(err=>alert(err.message));
}

window.login = function(){
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if(!email || !password){ alert("Enter email & password"); return;}

    signInWithEmailAndPassword(auth,email,password)
    .then(res=>{
        currentTeacher = res.user;
        document.getElementById("loginPage").classList.add("hidden");
        document.getElementById("dashboardPage").classList.remove("hidden");
        loadTeacherInfo();
    }).catch(err=>alert(err.message));
}

window.logout = function(){
    signOut(auth).then(()=>{
        currentTeacher=null;
        document.getElementById("dashboardPage").classList.add("hidden");
        document.getElementById("loginPage").classList.remove("hidden");
    });
}

// ================= LOAD TEACHER =================
function loadTeacherInfo(){
    const teacherRef = ref(db,'teachers/'+currentTeacher.uid);
    onValue(teacherRef, snapshot=>{
        const data = snapshot.val();
        document.getElementById("teacherName").innerText = data.name || "Teacher";
        populateSubjectFilter(data.subjects || []);
        loadStudents();
    });
}

// ================= SUBJECT DROPDOWN =================
function populateSubjectFilter(subjects){
    const select = document.getElementById("subjectFilter");
    const selectAdd = document.getElementById("subjectFilterAdd");

    select.innerHTML="<option value='all'>All Subjects</option>";
    selectAdd.innerHTML="<option value=''>Select Subject</option>";

    subjects.forEach(sub=>{
        const o = document.createElement("option");
        o.value=sub; o.innerText=sub; select.appendChild(o);

        const o2 = document.createElement("option");
        o2.value=sub; o2.innerText=sub; selectAdd.appendChild(o2);
    });
}

// ================= LOAD STUDENTS =================
function loadStudents(){
    const filter = document.getElementById("subjectFilter").value;
    onValue(ref(db,'students'), snapshot=>{
        allStudents = snapshot.val()||{};
        displayStudents(filter);
        displayBunkers();
    });
}

// ================= DISPLAY STUDENTS =================
function displayStudents(filter){
    const table = document.getElementById("studentsTable");
    table.innerHTML=`<tr>
        <th>Name</th><th>Class</th><th>Subject</th><th>Absences</th>
        <th>Edit</th><th>Delete</th><th>Attendance</th>
    </tr>`;
    for(let id in allStudents){
        const s = allStudents[id];
        if(filter!=='all' && s.subject!==filter) continue;

        const row = table.insertRow();
        row.insertCell(0).innerText = s.name;
        row.insertCell(1).innerText = s.class;
        row.insertCell(2).innerText = s.subject;
        const totalAbsent = Object.values(s.attendance||{}).filter(v=>v==="absent").length;
        row.insertCell(3).innerText = totalAbsent;

        // Edit
        const editCell=row.insertCell(4);
        const editBtn=document.createElement("button");
        editBtn.innerText="Edit";
        if(s.teacher===currentTeacher.uid) editBtn.onclick=()=>editStudent(id); else editBtn.disabled=true;
        editCell.appendChild(editBtn);

        // Delete
        const delCell=row.insertCell(5);
        const delBtn=document.createElement("button");
        delBtn.innerText="Delete";
        if(s.teacher===currentTeacher.uid) delBtn.onclick=()=>deleteStudent(id); else delBtn.disabled=true;
        delCell.appendChild(delBtn);

        // Attendance button
        const attCell=row.insertCell(6);
        const attBtn=document.createElement("button");
        attBtn.innerText="Attendance";
        attBtn.onclick=()=>openAttendanceModal(id);
        attCell.appendChild(attBtn);
    }
}

// ================= ADD / EDIT / DELETE =================
window.addStudent=function(){
    const name=document.getElementById("studentName").value;
    const cls=document.getElementById("studentClass").value;
    const sub=document.getElementById("subjectFilterAdd").value;
    if(!name||!cls||!sub){alert("Enter all fields"); return;}
    const nref=push(ref(db,'students'));
    set(nref,{name:name,class:cls,subject:sub,teacher:currentTeacher.uid,attendance:{}});
    document.getElementById("studentName").value=""; document.getElementById("studentClass").value="";
}

function editStudent(id){
    const newName=prompt("New name:",allStudents[id].name);
    if(newName) update(ref(db,'students/'+id),{name:newName});
}

function deleteStudent(id){ if(confirm("Delete student?")) remove(ref(db,'students/'+id)); }

// ================= ATTENDANCE =================
function openAttendanceModal(id){
    selectedStudentId=id;
    const s=allStudents[id];
    document.getElementById("modalStudentName").innerText=s.name;
    document.getElementById("attendanceModal").classList.remove("hidden");
    document.getElementById("modalOverlay").classList.remove("hidden");
    loadAttendanceMonth();
}

window.closeModal=function(){
    document.getElementById("attendanceModal").classList.add("hidden");
    document.getElementById("modalOverlay").classList.add("hidden");
}

window.loadAttendanceMonth=function(){
    const month=document.getElementById("monthPicker").value;
    const table=document.getElementById("attendanceTable");
    table.innerHTML="<tr><th>Date</th><th>Status</th><th>Mark Present</th><th>Mark Absent</th></tr>";
    if(!selectedStudentId) return;
    const s=allStudents[selectedStudentId];
    const att=s.attendance||{};
    for(let d in att){
        if(month && !d.startsWith(month)) continue;
        const row=table.insertRow();
        row.insertCell(0).innerText=d;
        row.insertCell(1).innerText=att[d];
        const p=row.insertCell(2).appendChild(document.createElement("button"));
        p.innerText="Present"; p.onclick=()=>markAttendance(d,"present");
        const a=row.insertCell(3).appendChild(document.createElement("button"));
        a.innerText="Absent"; a.onclick=()=>markAttendance(d,"absent");
    }
    renderCalendar(att,month);
}

function markAttendance(date,status){
    if(!selectedStudentId) return;
    set(ref(db,'students/'+selectedStudentId+'/attendance/'+date),status);
}

// ================= CALENDAR =================
function renderCalendar(att,month){
    const c=document.getElementById("calendarContainer");
    c.innerHTML="";
    for(let d in att){
        if(month && !d.startsWith(month)) continue;
        const div=document.createElement("div");
        div.innerText=d.split('-')[2];
        div.className=att[d];
        c.appendChild(div);
    }
}

// ================= PRINT =================
window.printReport=function(){
    const w=window.open("","", "width=800,height=600");
    w.document.write(document.getElementById("attendanceModal").innerHTML);
    w.document.close(); w.print();
}

// ================= BUNKERS =================
function displayBunkers(){
    const table=document.getElementById("bunkingTable");
    table.innerHTML="<tr><th>Name</th><th>Class</th><th>Subject</th><th>Absences</th></tr>";
    const bunkers=[];
    for(let id in allStudents){
        const s=allStudents[id];
        const totalAbsent=Object.values(s.attendance||{}).filter(v=>v==="absent").length;
        if(totalAbsent>0) bunkers.push({...s,totalAbsent});
    }
    bunkers.sort((a,b)=>b.totalAbsent-a.totalAbsent);
    bunkers.forEach(s=>{
        const row=table.insertRow();
        row.insertCell(0).innerText=s.name;
        row.insertCell(1).innerText=s.class;
        row.insertCell(2).innerText=s.subject;
        const cell=row.insertCell(3); cell.innerText=s.totalAbsent;
        if(s.totalAbsent>=3) cell.style.color="red";
    });
}

// ================= TABS =================
window.showTab=function(tabId){
    document.getElementById("studentsTab").classList.add("hidden");
    document.getElementById("bunkingTab").classList.add("hidden");
    document.getElementById(tabId).classList.remove("hidden");
}