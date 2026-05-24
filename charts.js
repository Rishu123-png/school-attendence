import { db, auth } from "../firebase.js";

import {
  ref,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

async function loadDashboard() {

  const studentsRef = ref(db, "students");
  const attendanceRef = ref(db, "attendance");

  const studentsSnap = await get(studentsRef);
  const attendanceSnap = await get(attendanceRef);

  let totalStudents = 0;
  let presentToday = 0;
  let absentToday = 0;

  if (studentsSnap.exists()) {
    const students = studentsSnap.val();

    Object.values(students).forEach(student => {
      if (student.teacher === auth.currentUser.uid) {
        totalStudents++;
      }
    });
  }

  const today = new Date().toISOString().split("T")[0];

  if (attendanceSnap.exists()) {

    const attendance = attendanceSnap.val();

    if (attendance[today]) {

      Object.values(attendance[today]).forEach(record => {

        if (record.status === "present") {
          presentToday++;
        } else {
          absentToday++;
        }

      });

    }

  }

  const attendanceRate =
    totalStudents > 0
      ? ((presentToday / totalStudents) * 100).toFixed(1)
      : 0;

  document.getElementById("totalStudents").innerText = totalStudents;

  document.getElementById("presentToday").innerText = presentToday;

  document.getElementById("absentToday").innerText = absentToday;

  document.getElementById("attendanceRate").innerText =
    attendanceRate + "%";

  loadChart(presentToday, absentToday);
}

function loadChart(present, absent) {

  const ctx = document
    .getElementById("attendanceChart")
    .getContext("2d");

  new Chart(ctx, {
    type: "doughnut",

    data: {
      labels: ["Present", "Absent"],

      datasets: [{
        data: [present, absent]
      }]
    }
  });

}

auth.onAuthStateChanged(user => {

  if (user) {
    loadDashboard();
  }

});