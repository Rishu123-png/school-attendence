// script.js
import { getStudents } from "./students.js";
import {
  getDatabase,
  ref,
  set,
  get,
  child,
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  const classSelect = document.getElementById("classSelect");
  const subjectSelect = document.getElementById("subjectSelect");
  const studentListDiv = document.getElementById("studentList");
  const saveAttendanceBtn = document.getElementById("saveAttendance");

  const viewHistoryBtn = document.createElement("button");
  viewHistoryBtn.textContent = "View Attendance History";
  viewHistoryBtn.style.marginTop = "15px";
  viewHistoryBtn.style.display = "none";
  document.querySelector("#attendanceSection").appendChild(viewHistoryBtn);

  const db = getDatabase();
  let selectedClass = "";
  let selectedSubject = "";

  classSelect.addEventListener("change", () => {
    selectedClass = classSelect.value;
    updateStudentList();
  });

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
        saveAttendanceBtn.style.display = "none";
        viewHistoryBtn.style.display = "none";
        return;
      }

      students.forEach((student) => {
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
      viewHistoryBtn.style.display = "block";
    }
  }

  // ✅ Save Attendance
  saveAttendanceBtn.addEventListener("click", async () => {
    if (!selectedClass || !selectedSubject) {
      alert("Please select class and subject first!");
      return;
    }

    const students = getStudents(selectedClass, selectedSubject);
    const attendance = {};
    students.forEach((student) => {
      const status = document.getElementById(`status-${student}`).value;
      attendance[student] = status;
    });

    const date = new Date().toISOString().split("T")[0];
    try {
      await set(ref(db, `attendance/${selectedClass}/${selectedSubject}/${date}`), attendance);
      alert("✅ Attendance saved successfully!");
    } catch (error) {
      console.error(error);
      alert("❌ Error saving attendance. Check Firebase setup.");
    }
  });

  // ✅ View Attendance History
  viewHistoryBtn.addEventListener("click", async () => {
    if (!selectedClass || !selectedSubject) {
      alert("Please select class and subject first!");
      return;
    }

    const dbRef = ref(db);
    const path = `attendance/${selectedClass}/${selectedSubject}`;
    studentListDiv.innerHTML = "<h3>Loading attendance history...</h3>";

    try {
      const snapshot = await get(child(dbRef, path));

      if (snapshot.exists()) {
        const data = snapshot.val();
        studentListDiv.innerHTML = `<h3>Attendance History (${selectedClass} - ${selectedSubject})</h3>`;
        for (const date in data) {
          const recordDiv = document.createElement("div");
          recordDiv.className = "history-item";
          recordDiv.innerHTML = `<strong>${date}</strong><br>`;
          const students = data[date];
          for (const student in students) {
            recordDiv.innerHTML += `${student}: ${students[student]}<br>`;
          }
          studentListDiv.appendChild(recordDiv);
        }
      } else {
        studentListDiv.innerHTML = "<p>No attendance records found.</p>";
      }
    } catch (error) {
      console.error(error);
      studentListDiv.innerHTML = "<p>Error fetching records.</p>";
    }
  });
});
