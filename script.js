import { getStudents } from "./students.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  const classSelect = document.getElementById("classSelect");
  const subjectSelect = document.getElementById("subjectSelect");
  const studentListDiv = document.getElementById("studentList");
  const saveAttendanceBtn = document.getElementById("saveAttendance");

  let selectedClass = "";
  let selectedSubject = "";

  // Handle class change
  classSelect.addEventListener("change", () => {
    selectedClass = classSelect.value;
    updateStudentList();
  });

  // Handle subject change
  subjectSelect.addEventListener("change", () => {
    selectedSubject = subjectSelect.value;
    updateStudentList();
  });

  function updateStudentList() {
    studentListDiv.innerHTML = "";

    if (selectedClass && selectedSubject) {
      const students = getStudents(selectedClass, selectedSubject);

      if (students.length === 0) {
        studentListDiv.innerHTML = "<p>No students found for this class and subject.</p>";
        return;
      }

      students.forEach(student => {
        const studentDiv = document.createElement("div");
        studentDiv.className = "student-item";
        studentDiv.innerHTML = `
          <span>${student}</span>
          <select id="status-${student}">
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
          </select>
        `;
        studentListDiv.appendChild(studentDiv);
      });

      saveAttendanceBtn.style.display = "block";
    }
  }

  // Save attendance to Firebase
  saveAttendanceBtn.addEventListener("click", async () => {
    const db = getDatabase();
    const students = getStudents(selectedClass, selectedSubject);

    const attendance = {};
    students.forEach(student => {
      const status = document.getElementById(`status-${student}`).value;
      attendance[student] = status;
    });

    const date = new Date().toISOString().split("T")[0];

    await set(ref(db, `attendance/${selectedClass}/${selectedSubject}/${date}`), attendance);
    alert("Attendance saved successfully! ✅");
  });
});
