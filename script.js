// ============================================================
//  School Attendance System - script.js (FINAL HYBRID v2.0)
//  - Option B: students are stored in RTDB under `students/<class>/<subject>/`
//  - Teachers can add / delete students (for their class or if no class restriction).
//  - Print monthly attendance report (new window -> print).
//  - Keeps all previous features: auth, attendance save, history view.
//  Author: merged/extended for Rishu Jaswar
// ============================================================

import { app } from "./firebase.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  push,
  set,
  remove,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

window.addEventListener("DOMContentLoaded", () => {
  // Firebase
  const auth = getAuth(app);
  const db = getDatabase(app);

  // UI (must match HTML)
  const authLogin = document.getElementById("authLogin");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginBtn = document.getElementById("loginBtn");
  const authMessage = document.getElementById("authMessage");

  const dashboard = document.getElementById("dashboard");
  const welcome = document.getElementById("welcome");
  const teacherMeta = document.getElementById("teacherMeta");
  const teacherAvatar = document.getElementById("teacherAvatar");
  const logoutBtn = document.getElementById("logoutBtn");

  const classSelect = document.getElementById("classSelect");
  const subjectSelect = document.getElementById("subjectSelect");
  const studentListContainer = document.getElementById("studentListContainer");
  const saveAll = document.getElementById("saveAll");
  const viewHistory = document.getElementById("viewHistory");

  const historyContainer = document.getElementById("historyContainer");
  const historyTableBody = document.getElementById("historyTableBody");
  const historyDateInput = document.getElementById("historyDate");
  const loadDate = document.getElementById("loadDate");

  // New UI buttons we create (Add Student + Print Report)
  let addStudentBtn = null;
  let printReportBtn = null;

  // Local state
  let currentUser = null;
  let teacherProfile = null;
  let teacherSubject = null;
  let teacherUid = null;

  // --- Helpers ---
  function q(sel) {
    return document.querySelector(sel);
  }
  function escapeId(str) {
    return (str || "").replace(/\s+/g, "_").replace(/[^A-Za-z0-9_\-]/g, "");
  }

  // Populate class & subject dropdowns from DB (students tree).
  // Because Option B was chosen, we expect `students/` in DB to contain classes & subjects.
  async function populateClassSubjectSelects() {
    if (!classSelect || !subjectSelect) return;

    classSelect.innerHTML = `<option value="">Select Class</option>`;
    subjectSelect.innerHTML = `<option value="">Select Subject</option>`;

    try {
      const snap = await get(ref(db, "students"));
      const data = snap.exists() ? snap.val() : null;

      if (data) {
        const classes = Object.keys(data).sort();
        classes.forEach((c) => {
          const opt = document.createElement("option");
          opt.value = c;
          opt.textContent = c;
          classSelect.appendChild(opt);
        });

        // gather unique subjects across classes
        const subjSet = new Set();
        classes.forEach((c) => {
          Object.keys(data[c] || {}).forEach((s) => subjSet.add(s));
        });
        Array.from(subjSet)
          .sort()
          .forEach((s) => {
            const opt = document.createElement("option");
            opt.value = s;
            opt.textContent = s;
            subjectSelect.appendChild(opt);
          });
        return;
      }
    } catch (err) {
      console.warn("populateClassSubjectSelects read error:", err);
    }

    // fallback: if students path doesn't exist yet, offer common classes/subjects (light fallback)
    const fallbackClasses = ["11A", "11B", "12A", "12B"];
    fallbackClasses.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      classSelect.appendChild(opt);
    });
    const fallbackSubjects = [
      "Physics",
      "Chemistry",
      "Maths",
      "English",
      "Biology",
      "CS",
      "AI",
      "Data Science",
    ];
    fallbackSubjects.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      subjectSelect.appendChild(opt);
    });
  }

  // call populate initially
  populateClassSubjectSelects();

  // flatpickr if available
  if (typeof flatpickr !== "undefined" && historyDateInput) {
    flatpickr(historyDateInput, { dateFormat: "Y-m-d", defaultDate: new Date(), allowInput: false });
  }

  // Update save button state
  function updateSaveButtonState() {
    if (!saveAll) return;
    saveAll.disabled = true;
    saveAll.style.opacity = "0.6";
    saveAll.title = "Sign in and select a subject.";

    if (!teacherSubject) {
      saveAll.title = "Not authorized to save attendance.";
      return;
    }
    const selectedSubject = subjectSelect?.value || "";
    if (!selectedSubject) {
      saveAll.title = "Select a subject to enable saving.";
      return;
    }
    if (selectedSubject !== teacherSubject) {
      saveAll.title = `You can only save attendance for your subject: ${teacherSubject}`;
      return;
    }
    saveAll.disabled = false;
    saveAll.style.opacity = "1";
    saveAll.title = "Save attendance for displayed students";
  }

  // Load students for chosen class+subject from DB (students/<class>/<subject>/)
  // Returns array of student objects: { id, name }
  async function loadStudentsFromDB(className, subjectName) {
    if (!className || !subjectName) return [];
    try {
      const snap = await get(ref(db, `students/${className}/${subjectName}`));
      if (!snap.exists()) return [];
      const raw = snap.val(); // object keyed by pushId → { name: "..." } OR maybe { studentName: true }
      const list = [];
      // support both {id: {name}} and {name: true} forms
      for (const k of Object.keys(raw)) {
        const v = raw[k];
        if (v && typeof v === "object" && "name" in v) {
          list.push({ id: k, name: v.name });
        } else if (typeof v === "string") {
          list.push({ id: k, name: v });
        } else if (v === true) {
          list.push({ id: k, name: k });
        } else if (v && typeof v === "string") {
          list.push({ id: k, name: v });
        } else {
          // fallback: store JSON-stringified
          list.push({ id: k, name: String(v) });
        }
      }
      // sort by name
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      return list;
    } catch (err) {
      console.error("loadStudentsFromDB error:", err);
      return [];
    }
  }

  // Render students (reads from DB)
  async function renderStudentsFor(className, subjectName) {
    if (!studentListContainer) return;
    studentListContainer.innerHTML = "";

    if (!className || !subjectName) {
      studentListContainer.innerHTML = `<p class="msg">Please select class and subject.</p>`;
      updateSaveButtonState();
      return;
    }

    // load students dynamically
    const students = await loadStudentsFromDB(className, subjectName);

    if (!students.length) {
      studentListContainer.innerHTML = `<p class="msg">No students configured for ${className} / ${subjectName}. Use "Add Student" to create.</p>`;
      updateSaveButtonState();
      return;
    }

    // create rows with delete button
    students.forEach((s) => {
      const row = document.createElement("div");
      row.className = "student-row";
      row.dataset.studentId = s.id;

      // allow editing delete if teacher is allowed for this class (teacherProfile.class matches OR no teacherProfile.class)
      const canEditClass =
        !teacherProfile || !teacherProfile.class || teacherProfile.class === className;

      // if teacher is not of this subject then disable select (read-only) — as before
      const disabledSelectAttr = teacherSubject && subjectName !== teacherSubject ? "disabled" : "";

      row.innerHTML = `
        <span class="student-name">${s.name}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <select class="att-status" ${disabledSelectAttr}>
            <option>Present</option>
            <option>Absent</option>
          </select>
          ${canEditClass ? `<button class="delete-student small-btn" title="Delete student">✖</button>` : ""}
        </div>
      `;

      // delete handler
      const delBtn = row.querySelector(".delete-student");
      if (delBtn) {
        delBtn.addEventListener("click", async () => {
          if (!confirm(`Delete student "${s.name}" from ${className}/${subjectName}?`)) return;
          try {
            await remove(ref(db, `students/${className}/${subjectName}/${s.id}`));
            // refresh UI
            renderStudentsFor(className, subjectName);
            // repopulate classes/subjects in case deletion removed a subject/class
            await populateClassSubjectSelects();
          } catch (err) {
            console.error("delete student error:", err);
            alert("Failed to delete student. See console.");
          }
        });
      }

      studentListContainer.appendChild(row);
    });

    updateSaveButtonState();
  }

  // wire select changes
  classSelect?.addEventListener("change", () => renderStudentsFor(classSelect.value, subjectSelect.value));
  subjectSelect?.addEventListener("change", () => {
    renderStudentsFor(classSelect.value, subjectSelect.value);
    updateSaveButtonState();
  });

  // ------------------------------
  // Add Student modal (dynamic)
  // ------------------------------
  function ensureAddStudentControls() {
    // Only create once
    if (addStudentBtn) return;
    // Add buttons to controls area (we assume there is a .controls container in HTML)
    const controls = document.querySelector(".controls");
    if (!controls) return;

    // create container for extra actions
    const extra = document.createElement("div");
    extra.className = "extra-actions";
    extra.style.display = "flex";
    extra.style.gap = "8px";
    extra.style.marginTop = "8px";

    addStudentBtn = document.createElement("button");
    addStudentBtn.id = "addStudentBtn";
    addStudentBtn.textContent = "Add Student";
    addStudentBtn.className = "btn";

    printReportBtn = document.createElement("button");
    printReportBtn.id = "printReportBtn";
    printReportBtn.textContent = "Print Monthly Report";
    printReportBtn.className = "btn";

    extra.appendChild(addStudentBtn);
    extra.appendChild(printReportBtn);
    controls.appendChild(extra);

    // add handlers
    addStudentBtn.addEventListener("click", () => showAddStudentModal());
    printReportBtn.addEventListener("click", () => showPrintMonthlyModal());
  }

  // modal builder (simple)
  function showAddStudentModal() {
    const selectedClass = classSelect?.value;
    const selectedSubject = subjectSelect?.value;

    // teacher edit restriction: only allow adding to teacher's class (if teacherProfile.class set)
    if (teacherProfile && teacherProfile.class && selectedClass !== teacherProfile.class) {
      alert(`You can add students only for your class (${teacherProfile.class}).`);
      return;
    }

    // Create modal DOM
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;";

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style = "background:#fff;padding:18px;border-radius:8px;min-width:300px;max-width:480px;";

    modal.innerHTML = `
      <h3 style="margin-top:0">Add Student</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        <label>Class
          <select id="modalClassSelect">${classSelect.innerHTML}</select>
        </label>
        <label>Subject
          <select id="modalSubjectSelect">${subjectSelect.innerHTML}</select>
        </label>
        <label>Student Name
          <input id="modalStudentName" placeholder="e.g. Rohan Sharma" />
        </label>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button id="modalCancel" class="btn">Cancel</button>
          <button id="modalSave" class="btn">Save</button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // pre-select current values
    const modalClassSelect = overlay.querySelector("#modalClassSelect");
    const modalSubjectSelect = overlay.querySelector("#modalSubjectSelect");
    const modalStudentName = overlay.querySelector("#modalStudentName");
    const modalCancel = overlay.querySelector("#modalCancel");
    const modalSave = overlay.querySelector("#modalSave");

    if (selectedClass) modalClassSelect.value = selectedClass;
    if (selectedSubject) modalSubjectSelect.value = selectedSubject;

    modalCancel.addEventListener("click", () => overlay.remove());

    modalSave.addEventListener("click", async () => {
      const cls = modalClassSelect.value;
      const subj = modalSubjectSelect.value;
      const name = modalStudentName.value && modalStudentName.value.trim();
      if (!cls || !subj || !name) {
        alert("Please provide class, subject and student name.");
        return;
      }

      // teacher class restriction
      if (teacherProfile && teacherProfile.class && cls !== teacherProfile.class) {
        alert(`You can add students only for your class (${teacherProfile.class}).`);
        return;
      }

      try {
        // push new student object under students/<class>/<subject> with { name }
        const newRef = push(ref(db, `students/${cls}/${subj}`));
        await set(newRef, { name });
        alert(`Student "${name}" added to ${cls} / ${subj}.`);
        overlay.remove();
        // refresh UI
        await populateClassSubjectSelects();
        // ensure selects select the class/subj just used
        classSelect.value = cls;
        subjectSelect.value = subj;
        await renderStudentsFor(cls, subj);
      } catch (err) {
        console.error("Add student error:", err);
        alert("Failed to add student. See console.");
      }
    });
  }

  // Print monthly modal (choose class/subject/month)
  function showPrintMonthlyModal() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;";

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style = "background:#fff;padding:18px;border-radius:8px;min-width:320px;max-width:520px;";

    modal.innerHTML = `
      <h3 style="margin-top:0">Print Monthly Attendance Report</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        <label>Class
          <select id="reportClassSelect">${classSelect.innerHTML}</select>
        </label>
        <label>Subject
          <select id="reportSubjectSelect">${subjectSelect.innerHTML}</select>
        </label>
        <label>Month (YYYY-MM)
          <input id="reportMonth" placeholder="e.g. 2025-11" />
        </label>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button id="reportCancel" class="btn">Cancel</button>
          <button id="reportGenerate" class="btn">Generate & Print</button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const reportClassSelect = overlay.querySelector("#reportClassSelect");
    const reportSubjectSelect = overlay.querySelector("#reportSubjectSelect");
    const reportMonth = overlay.querySelector("#reportMonth");
    const reportCancel = overlay.querySelector("#reportCancel");
    const reportGenerate = overlay.querySelector("#reportGenerate");

    // default to current selections
    if (classSelect.value) reportClassSelect.value = classSelect.value;
    if (subjectSelect.value) reportSubjectSelect.value = subjectSelect.value;

    reportCancel.addEventListener("click", () => overlay.remove());

    reportGenerate.addEventListener("click", async () => {
      const cls = reportClassSelect.value;
      const subj = reportSubjectSelect.value;
      const month = reportMonth.value && reportMonth.value.trim();
      if (!cls || !subj || !month || !/^\d{4}-\d{2}$/.test(month)) {
        alert("Please select class, subject and enter month as YYYY-MM.");
        return;
      }
      overlay.remove();
      await generateAndPrintMonthlyReport(cls, subj, month);
    });
  }

  // Generate monthly report for class+subject for given month (YYYY-MM)
  // This reads attendance/* (all dates) and filters those that startWith month.
  async function generateAndPrintMonthlyReport(className, subjectName, month) {
    try {
      const snap = await get(ref(db, "attendance"));
      if (!snap.exists()) {
        alert("No attendance records found.");
        return;
      }
      const allDates = snap.val(); // attendance: { '2025-11-01': { class: { subj: {...} } }, ... }

      // Build an attendance map per-student: { name: { present: n, absent: m, days: { 'YYYY-MM-DD': 'Present' } } }
      const report = {};
      for (const dateKey of Object.keys(allDates)) {
        if (!dateKey.startsWith(month)) continue;
        const byClass = allDates[dateKey][className];
        if (!byClass) continue;
        const bySubject = byClass[subjectName];
        if (!bySubject) continue;
        for (const entryId of Object.keys(bySubject)) {
          const rec = bySubject[entryId]; // { student, status, teacher, ... }
          if (!rec || !rec.student) continue;
          const name = rec.student;
          if (!report[name]) report[name] = { present: 0, absent: 0, days: {} };
          const stat = (rec.status || "").toLowerCase();
          if (stat === "present") report[name].present++;
          else report[name].absent++;
          report[name].days[dateKey] = rec.status || "";
        }
      }

      // Make printable HTML
      const rows = Object.keys(report)
        .sort()
        .map((name) => {
          const r = report[name];
          return `<tr>
            <td>${name}</td>
            <td style="text-align:center">${r.present}</td>
            <td style="text-align:center">${r.absent}</td>
          </tr>`;
        })
        .join("");

      const html = `
        <html>
        <head>
          <title>Attendance Report - ${className} / ${subjectName} - ${month}</title>
          <style>
            body { font-family: Arial, sans-serif; padding:20px; color:#111 }
            h1,h2 { margin: 0 0 8px 0; }
            table { width:100%; border-collapse: collapse; margin-top:12px; }
            th, td { border:1px solid #ccc; padding:8px; }
            th { background:#f0f0f0; text-align:left }
          </style>
        </head>
        <body>
          <h1>Attendance Report</h1>
          <h2>${className} • ${subjectName} • ${month}</h2>
          <table>
            <thead>
              <tr><th>Student</th><th>Present</th><th>Absent</th></tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="3">No records for this month.</td></tr>`}
            </tbody>
          </table>
          <p style="margin-top:18px;">Generated: ${new Date().toLocaleString()}</p>
        </body>
        </html>
      `;

      const w = window.open("", "_blank");
      w