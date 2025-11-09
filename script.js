import { app } from "./firebase.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { 
  getDatabase, 
  ref, 
  push, 
  onValue 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const auth = getAuth(app);
const db = getDatabase(app);

// Elements
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginContainer = document.getElementById("login-container");
const attendanceContainer = document.getElementById("attendance-container");
const loginMessage = document.getElementById("loginMessage");
const teacherNameSpan = document.getElementById("teacherName");

// LOGIN
loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginMessage.textContent = "Login successful!";
  } catch (error) {
    loginMessage.textContent = "Invalid email or password!";
  }
});

// AUTH STATE LISTENER
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginContainer.style.display = "none";
    attendanceContainer.style.display = "block";
    teacherNameSpan.textContent = user.email;
  } else {
    loginContainer.style.display = "block";
    attendanceContainer.style.display = "none";
  }
});

// LOGOUT
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// SAVE ATTENDANCE
const saveBtn = document.getElementById("saveAttendanceBtn");
saveBtn.addEventListener("click", () => {
  const className = document.getElementById("classSelect").value;
  const subject = document.getElementById("subjectSelect").value;
  const studentName = document.getElementById("studentName").value.trim();
  const status = document.getElementById("attendanceStatus").value;
  const saveMessage = document.getElementById("saveMessage");

  if (!className || !subject || !studentName) {
    saveMessage.textContent = "⚠️ Please fill all fields!";
    return;
  }

  const attendanceRef = ref(db, "attendance");
  const newRecord = {
    className,
    subject,
    studentName,
    status,
    date: new Date().toLocaleString(),
    teacher: auth.currentUser ? auth.currentUser.email : "unknown"
  };

  push(attendanceRef, newRecord)
    .then(() => {
      saveMessage.textContent = "✅ Attendance saved!";
      document.getElementById("studentName").value = "";
    })
    .catch((error) => {
      console.error(error);
      saveMessage.textContent = "❌ Failed to save!";
    });
});

// VIEW ATTENDANCE HISTORY
const viewHistoryBtn = document.getElementById("viewHistoryBtn");
const historyBody = document.getElementById("historyBody");

viewHistoryBtn.addEventListener("click", () => {
  historyBody.innerHTML = "";
  const attendanceRef = ref(db, "attendance");

  onValue(attendanceRef, (snapshot) => {
    historyBody.innerHTML = "";
    if (snapshot.exists()) {
      const data = snapshot.val();
      Object.values(data).forEach((record) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${record.date}</td>
          <td>${record.className}</td>
          <td>${record.subject}</td>
          <td>${record.studentName}</td>
          <td>${record.status}</td>
        `;
        historyBody.appendChild(row);
      });
    } else {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="5">No attendance data found</td>`;
      historyBody.appendChild(row);
    }
  });
});
