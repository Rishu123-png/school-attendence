// ============================================================
// School Attendance System - script.js (Merged Final v2.0)
// Author: Rishu Jaswar
// ============================================================

import { app } from "./firebase.js";
import { studentsData } from "./students.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  push
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

window.addEventListener("DOMContentLoaded", () => {
  const auth = getAuth(app);
  const db = getDatabase(app);

  // UI Elements
  const loginBtn = document.getElementById("loginBtn");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const authMessage = document.getElementById("authMessage");

  const dashboard = document.getElementById("dashboard");
  const authLogin = document.getElementById("authLogin");
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

  // State
  let currentUser = null;
  let teacherProfile = null;
  let teacherSubject = null;
  let teacherUid = null;

  // Helpers
  function escapeId(str) {
    return (str || "").replace(/\s+/g, "").replace(/[^A-Za-z0-9-]/g, "");
  }

  function populateClassSubjectSelects() {
    if (!classSelect || !subjectSelect) return;

    classSelect.innerHTML = `<option value="">Select Class</option>`;
    subjectSelect.innerHTML = `<option value="">Select Subject</option>`;

    Object.keys(studentsData).forEach(cls => {
      const opt = document.createElement("option");
      opt.value = cls;
      opt.textContent = cls;
      classSelect.appendChild(opt);
    });

    const subjSet = new Set();
    Object.values(studentsData).forEach(clsObj => {
      Object.keys(clsObj).forEach(subj => subjSet.add(subj));
    });

    Array.from(subjSet).sort().forEach(subj => {
      const opt = document.createElement("option");
      opt.value = subj;
      opt.textContent = subj;
      subjectSelect.appendChild(opt);
    });
  }

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

  function renderStudentsFor(className, subjectName) {
    if (!studentListContainer) return;
    studentListContainer.innerHTML = "";

    if (!className || !subjectName) {
      studentListContainer.innerHTML = `<p class="msg">Please select class and subject.</p>`;
      updateSaveButtonState();
      return;
    }

    const list = studentsData[className]?.[subjectName] || [];
    if (!list.length) {
      studentListContainer.innerHTML = `<p class="msg">No students configured for ${className} / ${subjectName}.</p>`;
      updateSaveButtonState();
      return;
    }

    list.sort((a,b) => a.localeCompare(b, undefined, {sensitivity:"base"}));
    list.forEach(student => {
      const div = document.createElement("div");
      div.className = "student-row";
      const id = `status-${escapeId(className)}-${escapeId(subjectName)}-${escapeId(student)}`;
      const disabledAttr = teacherSubject && subjectName !== teacherSubject ? "disabled" : "";

      div.innerHTML = `
        <span>${student}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <select id="${id}" ${disabledAttr}>
            <option>Present</option>
            <option>Absent</option>
          </select>
        </div>`;
      studentListContainer.appendChild(div);
    });

    updateSaveButtonState();
  }

  // Event listeners for selects
  classSelect?.addEventListener("change", () => renderStudentsFor(classSelect.value, subjectSelect.value));
  subjectSelect?.addEventListener("change", () => {
    renderStudentsFor(classSelect.value, subjectSelect.value);
    updateSaveButtonState();
  });

  // Save attendance
  saveAll?.addEventListener("click", async () => {
    if (!currentUser) return alert("Please login first.");
    const className = classSelect?.value;
    const subjectName = subjectSelect?.value;
    if (!className || !subjectName) return alert("Select class and subject first.");
    if (!teacherSubject || subjectName !== teacherSubject) return alert(`You can only save for ${teacherSubject}`);

    const rows = studentListContainer.querySelectorAll(".student-row");
    if (!rows.length) return alert("No students to save.");

    const date = new Date().toISOString().split("T")[0];
    const ts = new Date().toISOString();

    try {
      for (const row of rows) {
        const name = row.querySelector("span").innerText;
        const status = row.querySelector("select").value;
        await push(ref(db, `attendance/${date}/${className}/${subjectName}`), {
          student: name,
          status,
          teacher: currentUser.email || "",
          teacherUid: teacherUid || "",
          timestamp: ts
        });
      }
      alert("✅ Attendance saved successfully for " + date);
    } catch (err) {
      console.error("Error saving attendance:", err);
      alert("Failed to save attendance. See console.");
    }
  });

  // History
  async function loadHistoryForDate(dateStr) {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = "";
    historyContainer.style.display = "none";
    if (!dateStr) return alert("Pick a date first.");

    try {
      const snap = await get(ref(db, `attendance/${dateStr}`));
      if (!snap.exists()) return alert("No attendance for " + dateStr);
      const all = snap.val();
      const rows = [];

      for (const cls of Object.keys(all)) {
        for (const subj of Object.keys(all[cls])) {
          for (const id of Object.keys(all[cls][subj])) {
            rows.push({date: dateStr, className: cls, subjectName: subj, ...all[cls][subj][id]});
          }
        }
      }

      rows.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${r.date}</td><td>${r.className}</td><td>${r.subjectName}</td><td>${r.student}</td><td>${r.status}</td><td>${r.teacher || r.teacherUid || ""}</td>`;
        historyTableBody.appendChild(tr);
      });

      historyContainer.style.display = "block";
      historyContainer.scrollIntoView({behavior:"smooth"});
    } catch(err) {
      console.error("History load error:", err);
      alert("Failed to load history.");
    }
  }

  viewHistory?.addEventListener("click", async () => {
    const today = new Date().toISOString().split("T")[0];
    await loadHistoryForDate(today);
  });

  loadDate?.addEventListener("click", async () => {
    const dateStr = historyDateInput?.value;
    if (!dateStr) return alert("Pick date.");
    await loadHistoryForDate(dateStr);
  });

  // LOGIN / LOGOUT
  loginBtn?.addEventListener("click", async () => {
    if (authMessage) authMessage.textContent = "";
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();
    if (!email || !password) return authMessage.textContent = "Enter email/password.";

    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch(err) { console.error("Login error:", err); authMessage.textContent = err.message || "Login failed"; }
  });

  logoutBtn?.addEventListener("click", async () => { try { await signOut(auth); } catch(err){ console.error(err); } });

  onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;

    if (!user) {
      dashboard.style.display = "none";
      authLogin.style.display = "block";
      studentListContainer.innerHTML = "";
      historyTableBody.innerHTML = "";
      historyContainer.style.display = "none";
      teacherProfile = null;
      teacherSubject = null;
      teacherUid = null;
      updateSaveButtonState();
      return;
    }

    // Read teacher profile
    try {
      const snap = await get(ref(db, "teachers/" + user.uid));
      teacherProfile = snap.exists() ? snap.val() : null;
    } catch(e){ console.warn(e); teacherProfile=null; }

    if (!teacherProfile || !teacherProfile.subject) {
      alert("Access denied. Contact admin."); await signOut(auth); return;
    }

    teacherUid = user.uid;
    teacherSubject = teacherProfile.subject;

    authLogin.style.display = "none";
    dashboard.style.display = "block";
    welcome.textContent = `Welcome, ${teacherProfile.name || user.email}`;
    teacherMeta.textContent = `${teacherProfile.subject} • ${teacherProfile.class || ""}`;
    if (teacherProfile.photoURL && teacherAvatar) teacherAvatar.src = teacherProfile.photoURL;

    populateClassSubjectSelects();
    if (teacherSubject) subjectSelect.value = teacherSubject;
    renderStudentsFor(classSelect?.value, subjectSelect?.value);
    updateSaveButtonState();
  });

  // Init flatpickr
  if (typeof flatpickr !== "undefined" && historyDateInput) {
    flatpickr(historyDateInput, {dateFormat:"Y-m-d", defaultDate:new Date(), allowInput:false});
  }

  populateClassSubjectSelects();
});