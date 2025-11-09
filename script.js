// script.js

document.getElementById("loginBtn").addEventListener("click", () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const teacher = teacherAccounts[username];
  if (teacher && teacher.password === password) {
    document.getElementById("login-section").style.display = "none";
    document.getElementById("attendance-section").style.display = "block";
    document.getElementById("teacherName").textContent = username;

    // Auto-select teacher's class and subject
    document.getElementById("classSelect").value = teacher.class;
    document.getElementById("subjectSelect").value = teacher.subject;
  } else {
    alert("Invalid username or password!");
  }
});

document.getElementById("loadStudents").addEventListener("click", () => {
  const selectedClass = document.getElementById("classSelect").value;
  const selectedSubject = document.getElementById("subjectSelect").value;
  const studentList = studentsData[selectedClass]?.[selectedSubject] || [];

  const container = document.getElementById("studentList");
  container.innerHTML = "";

  if (studentList.length === 0) {
    container.innerHTML = "<p>No students found for this class and subject.</p>";
    return;
  }

  studentList.forEach(name => {
    const div = document.createElement("div");
    div.innerHTML = `<label><input type="checkbox" value="${name}"> ${name}</label>`;
    container.appendChild(div);
  });
});

document.getElementById("saveAttendance").addEventListener("click", () => {
  const checked = document.querySelectorAll("#studentList input:checked");
  const presentNames = Array.from(checked).map(cb => cb.value);
  alert("Attendance saved for: " + presentNames.join(", "));
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  document.getElementById("attendance-section").style.display = "none";
  document.getElementById("login-section").style.display = "block";
});
