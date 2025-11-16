import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { 
  ref, set, push, get, onValue, update, remove 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

let currentTeacher = null;
let allStudents = {};
let selectedStudentId = null;

// =================== LOGIN / SIGNUP ===================
window.signup = async function() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try{
    const userCredential = await createUserWithEmailAndPassword(auth,email,password);
    const uid = userCredential.user.uid;
    await set(ref(db,'teachers/'+uid),{email, name:"", subjects:[]});
    document.getElementById("loginMsg").innerText="Signup successful! Please login.";
  }catch(err){alert(err.message);}
}

window.login = async function(){
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try{
    const userCredential = await signInWithEmailAndPassword(auth,email,password);
    currentTeacher = userCredential.user;
    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("dashboardPage").classList.remove("hidden");
    loadTeacherInfo();
  }catch(err){alert(err.message);}
}

window.logout = function(){
  signOut(auth);
  currentTeacher=null;
  document.getElementById("dashboardPage").classList.add("hidden");
  document.getElementById("loginPage").classList.remove("hidden");
}

// =================== LOAD TEACHER INFO ===================
function loadTeacherInfo(){
  const teacherRef = ref(db,'teachers/'+currentTeacher.uid);
  onValue(teacherRef,(snap)=>{
    const data = snap.val();
    document.getElementById("teacherName").innerText=data.name||"Teacher";
    populateSubjectFilter(data.subjects||[]);
    loadStudents();
  });
}

// =================== POPULATE SUBJECTS ===================
function populateSubjectFilter(subjects){
  const filter = document.getElementById("subjectFilter");
  const add = document.getElementById("subjectFilterAdd");
  filter.innerHTML="<option value='all'>All Subjects</option>";
  add.innerHTML="<option value=''>Select Subject</option>";
  subjects.forEach(sub=>{
    const o=document.createElement("option"); o.value=sub; o.innerText=sub; filter.appendChild(o);
    const o2=document.createElement("option"); o2.value=sub; o2.innerText=sub; add.appendChild(o2);
  });
}

// =================== LOAD STUDENTS ===================
function loadStudents(){
  const selectedSub = document.getElementById("subjectFilter").value;
  const studentsRef = ref(db,'students');
  onValue(studentsRef,(snap)=>{
    allStudents = snap.val()||{};
    displayStudents(selectedSub);
    displayBunkers();
  });
}

// =================== DISPLAY STUDENTS ===================
function displayStudents(filter){
  const table=document.getElementById("studentsTable");
  table.innerHTML="<tr><th>Name</th><th>Class</th><th>Subject</th><th>Attendance</th><th>Edit</th><th>Delete</th></tr>";
  for(let id in allStudents){
    const s=allStudents[id];
    if(filter!=='all' && s.subject!==filter) continue;
    const row=table.insertRow();
    row.insertCell(0).innerText=s.name;
    row.insertCell(1).innerText=s.class;
    row.insertCell(2).innerText=s.subject;
    const absentCount=Object.values(s.attendance||{}).filter(v=>v==='absent').length;
    row.insertCell(3).innerText=absentCount;
    const edit= row.insertCell(4).appendChild(document.createElement("button"));
    edit.innerText="Edit"; edit.disabled=s.teacher!==currentTeacher.uid; edit.onclick=()=>editStudentPrompt(id);
    const del= row.insertCell(5).appendChild(document.createElement("button"));
    del.innerText="Delete"; del.disabled=s.teacher!==currentTeacher.uid; del.onclick=()=>deleteStudent(id);
  }
}

// =================== ADD / EDIT / DELETE STUDENT ===================
window.addStudent=function(){
  const name=document.getElementById("studentName").value;
  const cls=document.getElementById("studentClass").value;
  const sub=document.getElementById("subjectFilterAdd").value;
  if(!name||!cls||!sub){alert("Enter all fields"); return;}
  const nref=push(ref(db,'students'));
  set(nref,{name:name,class:cls,subject:sub,teacher:currentTeacher.uid,attendance:{}});
  document.getElementById("studentName").value="";
  document.getElementById("studentClass").value="";
  document.getElementById("subjectFilterAdd").value="";
}

function editStudentPrompt(id){
  const n=prompt("Enter new name",allStudents[id].name);
  if(!n) return;
  update(ref(db,'students/'+id),{name:n});
}

function deleteStudent(id){
  if(!confirm("Delete this student?")) return;
  remove(ref(db,'students/'+id));
}

// =================== DISPLAY BUNKERS ===================
function displayBunkers(){
  const table=document.getElementById("bunkingTable");
  table.innerHTML="<tr><th>Name</th><th>Class</th><th>Subject</th><th>Absences</th></tr>";
  const arr=[];
  for(let id in allStudents){
    const s=allStudents[id];
    const count=Object.values(s.attendance||{}).filter(v=>v==='absent').length;
    if(count>0) arr.push({...s,totalAbsent:count});
  }
  arr.sort((a,b)=>b.totalAbsent-a.totalAbsent);
  arr.forEach(s=>{
    const r=table.insertRow();
    r.insertCell(0).innerText=s.name;
    r.insertCell(1).innerText=s.class;
    r.insertCell(2).innerText=s.subject;
    const c=r.insertCell(3); c.innerText=s.totalAbsent;
    if(s.totalAbsent>=3)c.style.color="red";
  });
}

// =================== TABS ===================
window.showTab=function(id){
  document.querySelectorAll('.tabContent').forEach(t=>t.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

// =================== ATTENDANCE HISTORY & PRINT ===================
window.loadAttendanceMonth=function(){
  if(!selectedStudentId) return;
  const month=document.getElementById("monthPicker").value;
  const table=document.getElementById("attendanceTable");
  table.innerHTML="<tr><th>Date</th><th>Status</th><th>Mark Present</th><th>Mark Absent</th></tr>";
  const s=allStudents[selectedStudentId];
  const att=s.attendance||{};
  for(let d in att){
    if(month && !d.startsWith(month)) continue;
    const r=table.insertRow();
    r.insertCell(0).innerText=d;
    r.insertCell(1).innerText=att[d];
    const p=r.insertCell(2).appendChild(document.createElement("button"));
    p.innerText="Present"; p.onclick=()=>markAttendance(d,'present');
    const a=r.insertCell(3).appendChild(document.createElement("button"));
    a.innerText="Absent"; a.onclick=()=>markAttendance(d,'absent');
  }
}

function markAttendance(date,status){
  if(!selectedStudentId) return;
  set(ref(db,'students/'+selectedStudentId+'/attendance/'+date),status);
}

window.printReport=function(){
  const c=document.getElementById("attendanceTab").innerHTML;
  const w=window.open("","Print","width=800,height=600");
  w.document.write(c); w.document.close(); w.print();
}