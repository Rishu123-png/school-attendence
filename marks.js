// marks.js
// Marks & Prediction page logic 

import { auth, db } from "./firebase.js";
import {
  ref,
  onValue,
  get,
  update
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

/* ----------------- TensorFlow AI मॉडल ------------------ */

let tfModel = null;

async function initAIModel() {
  if (tfModel) return;

  tfModel = tf.sequential();

  tfModel.add(tf.layers.dense({
    units: 8,
    inputShape: [4],
    activation: 'relu'
  }));

  tfModel.add(tf.layers.dense({ units: 1 }));

  tfModel.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError'
  });

  await trainAIModel();
}

/* ----------------- Training Data ------------------ */
async function trainAIModel() {
  const trainingData = [
    { input: [0.8, 0.85, 0.9, 0.5], output: [0.8] },
    { input: [0.6, 0.7, 0.75, 0.4], output: [0.65] },
    { input: [0.4, 0.5, 0.6, 0.3], output: [0.5] },
    { input: [0.3, 0.4, 0.5, 0.2], output: [0.4] },
    { input: [0.9, 0.95, 0.95, 0.6], output: [0.9] }
  ];

  const inputs = tf.tensor2d(trainingData.map(d => d.input));
  const outputs = tf.tensor2d(trainingData.map(d => d.output));

  await tfModel.fit(inputs, outputs, {
    epochs: 200,
    shuffle: true
  });

  console.log("✅ AI Model Trained");
}

/* ----------------- Prediction ------------------ */
function predictWithAI(ut1, hy, attendance, hours) {
  if (!tfModel) return null;

  const input = tf.tensor2d([[
    ut1,
    hy,
    attendance,
    hours
  ]]);

  const output = tfModel.predict(input);
  return output.dataSync()[0]; // 0–1 range
}

/* ----------------- Utilities ------------------ */
function $(id) { return document.getElementById(id); }

function safeText(el, text) {
  if (!el) return;
  el.innerText = text ?? "";
}

function tryGet(fn, fallback = null) {
  try { return fn(); } catch (e) { return fallback; }
}


/* ----------------- DOM refs ------------------ */
const studentSelect = $("marksStudentSelect");
const marksForm = $("marksForm");
const marksStudentName = $("marksStudentName");

const ut1Score = $("ut1Score");
const ut1Max = $("ut1Max");
const hyScore = $("hyScore");
const hyMax = $("hyMax");
const ut2Score = $("ut2Score");
const ut2Max = $("ut2Max");
const annualScore = $("annualScore");
const annualMax = $("annualMax");

const saveMarksBtn = $("saveMarksBtn");
const predictBtn = $("predictBtn");
const clearMarksBtn = $("clearMarksBtn");
const studyHoursInput = $("studyHours");
const studyPredictBtn = null;

const predictionSummary = $("predictionSummary");
const studyHourPrediction = $("studyHourPrediction");
const performanceCanvas = $("performanceChart");

/* Chart instance */
let chartInstance = null;

/* ----------------- Auth helper ------------------ */
function waitForUserReady(cb, tries = 30) {
  if (auth && auth.currentUser) return cb();
  if (tries <= 0) return console.warn("User not available yet.");
  setTimeout(() => waitForUserReady(cb, tries - 1), 200);
}

/* ----------------- Main init ------------------ */
export function initMarksPage() {
  if (!studentSelect) {
    console.warn("marks.js: marksStudentSelect not found — page likely not marks.html");
    return;
  }

  waitForUserReady(async () => {
    const user = auth.currentUser;
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    studentSelect.innerHTML = `<option value="">-- Loading students --</option>`;
    studentSelect.onchange = handleStudentSelectChange;

    if (saveMarksBtn) saveMarksBtn.onclick = handleSaveMarks;
    if (predictBtn) predictBtn.onclick = recomputePrediction;
    if (clearMarksBtn) clearMarksBtn.onclick = clearMarks;

    window.predictStudyHourMarks = predictStudyHourMarks;

    await loadTeacherStudents(user.uid);
  });
}

/* ----------------- Load students ------------------ */
async function loadTeacherStudents(teacherUid) {
  try {
    const snap = await get(ref(db, "students"));
    const data = snap.val() || {};

    const arr = [];

    for (const id in data) {
      const s = data[id];
      if (!s) continue;

console.log("Logged UID:", teacherUid);
console.log("Student teacher:", s.teacher);

      // 🔥 FIXED: safer teacher filter
      if (!s.teacher || s.teacher === teacherUid) {
        arr.push({ id, name: s.name || "(no name)" });
      }
    }

    if (!studentSelect) return;

    studentSelect.innerHTML = `<option value="">-- Select student --</option>`;

    if (arr.length === 0) {
      studentSelect.innerHTML += `<option value="">(No students found)</option>`;
      if (marksForm) marksForm.style.display = "none";
      safeText(marksStudentName, "");
      return;
    }

    arr.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.innerText = s.name;
      studentSelect.appendChild(opt);
    });

  } catch (err) {
    console.error("loadTeacherStudents error", err);
    alert("Failed to load students.");
  }
}

/* ----------------- Student select ------------------ */
function handleStudentSelectChange(e) {
  const id = studentSelect.value;
  if (!id) {
    if (marksForm) marksForm.style.display = "none";
    return;
  }
  if (marksForm) marksForm.style.display = "block";
  loadStudentMarks(id);
}

/* ----------------- Load marks ------------------ */
async function loadStudentMarks(studentId) {
  if (!studentId) return;
  try {
    const snap = await get(ref(db, `students/${studentId}`));
    if (!snap.exists()) {
      alert("Student not found in database.");
      return;
    }
    const stu = snap.val() || {};
    safeText(marksStudentName, stu.name || "(Student)");

    const marks = (stu.marks) ? stu.marks : (stu.marks === undefined ? {} : stu.marks);
    const d = marks || {};

    if (ut1Score) ut1Score.value = tryGet(() => d.ut1Score ?? "", "");
    if (ut1Max) ut1Max.value = tryGet(() => d.ut1Max ?? "25", "25");
    if (hyScore) hyScore.value = tryGet(() => d.hyScore ?? "", "");
    if (hyMax) hyMax.value = tryGet(() => d.hyMax ?? "100", "100");
    if (ut2Score) ut2Score.value = tryGet(() => d.ut2Score ?? "", "");
    if (ut2Max) ut2Max.value = tryGet(() => (d.ut2Max ?? "25"), "25");
    if (annualScore) annualScore.value = tryGet(() => d.annualScore ?? "", "");
    if (annualMax) annualMax.value = tryGet(() => (d.annualMax ?? "100"), "100");

    drawPerformanceChart({
      ut1Score: Number(d.ut1Score || 0),
      hyScore: Number(d.hyScore || 0),
      ut2Score: Number(d.ut2Score || 0),
      annualScore: Number(d.annualScore || 0)
    });
  } catch (err) {
    console.error("loadStudentMarks error", err);
    alert("Failed to load student marks.");
  }
}

/* ----------------- Save marks ------------------ */
async function handleSaveMarks() {
  const studentId = studentSelect.value;
  if (!studentId) return alert("Select a student first.");

  const payload = {
    ut1Score: (ut1Score?.value || "").toString(),
    ut1Max: (ut1Max?.value || "25").toString(),
    hyScore: (hyScore?.value || "").toString(),
    hyMax: (hyMax?.value || "100").toString(),
    ut2Score: (ut2Score?.value || "").toString(),
    ut2Max: (ut2Max?.value || "25").toString(),
    annualScore: (annualScore?.value || "").toString(),
    annualMax: (annualMax?.value || "100").toString()
  };

  try {
    await update(ref(db, `students/${studentId}/marks`), payload);
    alert("Marks saved successfully.");
  } catch (err) {
    console.error("saveMarks error", err);
    alert("Failed to save marks — check console.");
  }
}

/* ----------------- Clear ------------------ */
function clearMarks() {
  if (ut1Score) ut1Score.value = "";
  if (ut1Max) ut1Max.value = "25";
  if (hyScore) hyScore.value = "";
  if (hyMax) hyMax.value = "100";
  if (ut2Score) ut2Score.value = "";
  if (ut2Max) ut2Max.value = "25";
  if (annualScore) annualScore.value = "";
  if (annualMax) annualMax.value = "100";
  if (predictionSummary) predictionSummary.innerText = "";
  if (studyHourPrediction) studyHourPrediction.innerText = "";
  drawPerformanceChart({ ut1Score:0, hyScore:0, ut2Score:0, annualScore:0 });
}
/* ----------------- AI + ATTENDANCE CORRELATION ------------------ */
async function recomputePrediction() {
  const ut1 = Number(ut1Score?.value || 0);
  const hy = Number(hyScore?.value || 0);
  const hours = Number(studyHoursInput?.value || 0);

  const ut1MaxVal = Number(ut1Max?.value || 25);
  const hyMaxVal = Number(hyMax?.value || 100);
  const ut2MaxVal = Number(ut2Max?.value || 25);
  const annualMaxVal = Number(annualMax?.value || 100);

  if (ut1 <= 0 || hy <= 0) {
    predictionSummary.innerText = "Enter UT-1 & Half-Yearly first.";
    return;
  }

  // 🔹 STEP 1: Academic performance
  const ut1_ratio = ut1 / ut1MaxVal;
  const hy_ratio = hy / hyMaxVal;
  const base = (ut1_ratio * 0.4) + (hy_ratio * 0.6);

  // 🔹 STEP 2: Study hours
  const studyFactor = Math.min(hours / 10, 1);

  // 🔹 STEP 3: Trend
  const trend = hy_ratio - ut1_ratio;

  // 🔹 STEP 4: ATTENDANCE FETCH
  const studentId = studentSelect.value;
  const snap = await get(ref(db, `students/${studentId}/attendance`));
  const attendanceData = snap.val() || {};

  let totalDays = 0;
  let presentDays = 0;

  for (const date in attendanceData) {
    totalDays++;
    if (attendanceData[date] === "present") presentDays++;
  }

  let attendancePercent = totalDays > 0 ? presentDays / totalDays : 1;

const attendanceInfoEl = document.getElementById("attendanceInfo");
if (attendanceInfoEl) {
  attendanceInfoEl.innerText =
    `Attendance Used: ${(attendancePercent * 100).toFixed(1)}%`;
}

  // 🔻 Attendance penalty
  let attendancePenalty = 0;
  if (attendancePercent < 0.5) attendancePenalty = 0.4;
  else if (attendancePercent < 0.7) attendancePenalty = 0.25;
  else if (attendancePercent < 0.85) attendancePenalty = 0.1;

  // 🔹 STEP 5: Final AI performance
  let finalPerformance =
      base
    + (studyFactor * 0.2)
    + (trend * 0.2)
    - attendancePenalty;

  finalPerformance = Math.max(0, Math.min(1, finalPerformance));

  // 🔹 STEP 6: Predictions
  const predictedUT2 = Math.round(finalPerformance * ut2MaxVal);
  const predictedAnnual = Math.round(finalPerformance * annualMaxVal);

  ut2Score.value = predictedUT2;
  annualScore.value = predictedAnnual;

  // 🔹 EXTRA ANALYSIS
  const confidence = Math.round((1 - Math.abs(ut1_ratio - hy_ratio)) * 100);

  let risk = "LOW";
  if (finalPerformance < 0.4) risk = "HIGH";
  else if (finalPerformance < 0.7) risk = "MEDIUM";

  let remark = "";
  if (attendancePercent < 0.5) {
    remark = "Very low attendance is severely affecting performance.";
  } else if (attendancePercent < 0.7) {
    remark = "Attendance is low. Improvement needed.";
  } else if (trend < 0) {
    remark = "Performance is declining. Focus required.";
  } else {
    remark = "Good performance and attendance.";
  }

  // 🧾 OUTPUT
  predictionSummary.innerText =
    `Predicted UT-2: ${predictedUT2}\n` +
    `Predicted Annual: ${predictedAnnual}\n\n` +
    `Performance: ${(finalPerformance*100).toFixed(1)}%\n` +
    `Attendance: ${(attendancePercent*100).toFixed(1)}%\n` +
    `Confidence: ${confidence}%\n` +
    `Risk Level: ${risk}\n\n` +
    `AI Remark:\n${remark}`;

  // Chart update
  drawPerformanceChart({
    ut1Score: ut1,
    hyScore: hy,
    ut2Score: predictedUT2,
    annualScore: predictedAnnual
  });
}
/* ----------------- Chart ------------------ */
function drawPerformanceChart(marks) {
  if (!performanceCanvas) return;
  const ctx = performanceCanvas.getContext("2d");
  const dataArr = [
    Number(marks.ut1Score || 0),
    Number(marks.hyScore || 0),
    Number(marks.ut2Score || 0),
    Number(marks.annualScore || 0)
  ];

  try { if (chartInstance) chartInstance.destroy(); } catch (e) {}

  if (typeof Chart === "undefined") {
    console.warn("Chart.js not loaded — skipping chart draw.");
    return;
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["UT-1", "Half-Yearly", "UT-2", "Annual"],
      datasets: [{
        label: "Performance Trend",
        data: dataArr,
        fill: false,
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 4
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 100
        }
      }
    }
  });
}


function predictStudyHourMarks() {
  const hours = Number(studyHoursInput?.value || 0);

  if (!hours || hours <= 0) {
    if (studyHourPrediction) {
      studyHourPrediction.innerText = "Enter valid study hours.";
    }
    return;
  }

  let predicted = Math.round((hours / 10) * 100);
  predicted = Math.min(100, predicted);

  let category = "";
  if (predicted >= 80) category = "Topper";
  else if (predicted >= 50) category = "Average";
  else category = "Failer";

  if (studyHourPrediction) {
    studyHourPrediction.innerText =
      `Estimated Score: ${predicted}/100\nStatus: ${category}`;
  }
}

window.predictStudyHourMarks = predictStudyHourMarks;
window.initMarksPage = initMarksPage;