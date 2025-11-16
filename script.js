// ================= Firebase =================
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { ref, onValue, set, push, update } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

let currentTeacher = null;
let allStudents = {};
let selectedClass = null;
let selectedStudentId = null;

// ================== PAGE NAV ==================
function showPage(pageId){
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(pageId).classList.remove('hidden');
}

// ================== LOGIN ==================
window.login = async function(){
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try{
    const userCredential = await signInWithEmailAndPassword(auth,email,password);
    currentTeacher = userCredential.user;
    loadTeacherInfo();
  }catch(e){
    alert(e.message);
  }
}

// ================== LOGOUT ==================
window.logout = function(){
  auth.signOut();
  currentTeacher = null;
  showPage('loginPage');
}

// ================== LOAD TEACHER INFO ==================
function loadTeacherInfo(){
  const teacherRef = ref(db, 'teachers/' + currentTeacher.uid);
  onValue(teacherRef, (snapshot)=>{
    const data = snapshot.val();
    document.getElementById('teacherName').innerText = data.name;
    document.getElementById('teacherSubject').innerText = data.subject;
    populateClasses(data.classes); // classes as object keys
    showPage('dashboardPage');
  });
}

// ================== POPULATE CLASSES ==================
function populateClasses(classes){
  const select = document.getElementById('classFilter');
  select.innerHTML = '';
  for(let cls in classes){
    const opt = document.createElement('option');
    opt.value = cls;
    opt.text = cls;
    select.appendChild(opt);
  }
  selectedClass = select.value;
}

// ================== DASHBOARD BUTTONS ==================
window.showAddStudentPage = function(){
  document.getElementById('addStudentClass').innerText = selectedClass;
  document.getElementById('addStudentSubject').innerText = document.getElementById('teacherSubject').innerText;
  showPage('addStudentPage');
}

window.showAttendancePage = function(){
  selectedClass = document.getElementById('classFilter').value;
  document.getElementById('attendanceClass').innerText = selectedClass;
  loadStudents();
  showPage('attendancePage');
}

window.showTopBunkers = function(){
  loadTopBunkers();
  showPage('bunkersPage');
}

window.backToDashboard = function(){
  showPage('dashboardPage');
}

// ================== ADD STUDENT ==================
window.addStudent = function(){
  const name = document.getElementById('studentName').value;
  if(!name){ alert("Enter student name"); return; }
  const studentRef = push(ref(db,'students'));
  set(studentRef,{
    name: name,
    class: selectedClass,
    subject: document.getElementById('teacherSubject').innerText,
    teacher: currentTeacher.uid,
    attendance: {}
  });
  document.getElementById('studentName').value = '';
  alert('Student added');
}

// ================== LOAD STUDENTS ==================
function loadStudents(){
  const studentsRef = ref(db,'students');
  onValue(studentsRef,(snapshot)=>{
    allStudents = snapshot.val() || {};
    renderAttendanceTable();
  });
}

// ================== RENDER ATTENDANCE TABLE ==================
function renderAttendanceTable(){
  const table = document.getElementById('attendanceTable');
  table.innerHTML = `
    <tr>
      <th>Name</th><th>Present</th><th>Absent</th><th>History</th>
    </tr>`;
  for(let id in allStudents){
    const s = allStudents[id];
    if(s.class !== selectedClass || s.subject !== document.getElementById('teacherSubject').innerText) continue;
    const row = table.insertRow();
    row.insertCell(0).innerText = s.name;
    const presentBtn = row.insertCell(1).appendChild(document.createElement('button'));
    presentBtn.innerText = 'Present';
    presentBtn.onclick = ()=>markAttendance(id,'present');
    const absentBtn = row.insertCell(2).appendChild(document.createElement('button'));
    absentBtn.innerText = 'Absent';
    absentBtn.onclick = ()=>markAttendance(id,'absent');
    const historyBtn = row.insertCell(3).appendChild(document.createElement('button'));
    historyBtn.innerText = 'History';
    historyBtn.onclick = ()=>openAttendanceModal(id);
  }
}

// ================== MARK ATTENDANCE ==================
function markAttendance(studentId,status){
  const today = new Date().toISOString().slice(0,10);
  set(ref(db, 'students/' + studentId + '/attendance/' + today), status);
}

// ================== ATTENDANCE HISTORY MODAL ==================
function openAttendanceModal(studentId){
  selectedStudentId = studentId;
  document.getElementById('modalStudentName').innerText = allStudents[studentId].name;
  document.getElementById('attendanceModal').classList.remove('hidden');
  document.getElementById('modalOverlay').classList.remove('hidden');
  loadAttendanceMonth();
}

window.closeModal = function(){
  document.getElementById('attendanceModal').classList.add('hidden');
  document.getElementById('modalOverlay').classList.add('hidden');
}

window.loadAttendanceMonth = function(){
  if(!selectedStudentId) return;
  const month = document.getElementById('monthPicker').value;
  const attendance = allStudents[selectedStudentId].attendance || {};
  const table = document.getElementById('attendanceMonthTable');
  table.innerHTML = `<tr><th>Date</th><th>Status</th></tr>`;
  for(let date in attendance){
    if(month && !date.startsWith(month)) continue;
    const row = table.insertRow();
    row.insertCell(0).innerText = date;
    row.insertCell(1).innerText = attendance[date];
  }
}

// ================== PRINT REPORT ==================
window.printReport = function(){
  const w = window.open("","Print","width=800,height=600");
  w.document.write(document.getElementById('attendanceModal').innerHTML);
  w.document.close();
  w.print();
}

// ================== TOP BUNKERS ==================
function loadTopBunkers(){
  const table = document.getElementById('bunkersTable');
  table.innerHTML = `<tr><th>Name</th><th>Class</th><th>Absences</th></tr>`;
  const bunkers = [];
  for(let id in allStudents){
    const s = allStudents[id];
    if(s.subject !== document.getElementById('teacherSubject').innerText) continue;
    const absentCount = Object.values(s.attendance||{}).filter(a=>a==='absent').length;
    if(absentCount>0) bunkers.push({...s,totalAbsent: absentCount});
  }
  bunkers.sort((a,b)=>b.totalAbsent-a.totalAbsent);
  bunkers.forEach(s=>{
    const row = table.insertRow();
    row.insertCell(0).innerText = s.name;
    row.insertCell(1).innerText = s.class;
    row.insertCell(2).innerText = s.totalAbsent;
  });
}