// add-student.js
import { app } from "./firebase.js";
import { studentsData } from "./students.js";

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

window.addEventListener("DOMContentLoaded", () => {
  const auth = getAuth(app);
  const db = getDatabase(app);

  const studentName = document.getElementById("studentName");
  const studentRoll = document.getElementById("studentRoll");
  const classSelectAdd = document.getElementById("classSelectAdd");
  const subjectSelectAdd = document.getElementById("subjectSelectAdd");
  const saveStudentBtn = document.getElementById("saveStudentBtn");
  const statusP = document.getElementById("status");
  const backBtn = document.getElementById("backBtn");

  // populate class & subject dropdowns from students.js
  function populateDropdowns() {
    classSelectAdd.innerHTML = `<option value="">Select Class</option>`;
    const classes = Object.keys(studentsData || {});
    classes.forEach(c => {
      const o = document.createElement("option");
      o.value = c; o.textContent = c;
      classSelectAdd.appendChild(o);
    });

    const subjects = ["Physics","chemistry","maths","english","biology","CS","AI","Data science"];
    // use user provided list (normalized): (capitalization optional)
    subjectSelectAdd.innerHTML = `<option value="">Select Subject</option>`;
    subjects.forEach(s=>{
      const o = document.createElement("option"); o.value = s; o.textContent = s;
      subjectSelectAdd.appendChild(o);
    });
  }
  populateDropdowns();

  // require login
  let currentUser = null, teacherProfile = null;
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      statusP.textContent = "You must be logged in on the main page. Please login there and open Add Student again.";
      saveStudentBtn.disabled = true;
      return;
    }
    currentUser = user;
    // optional: fetch teacher profile to check teacher's subject/class from teachers/<uid>
    try {
      const teacherSnap = await get(ref(db, `teachers/${user.uid}`));
      teacherProfile = teacherSnap.exists() ? teacherSnap.val() : null;
    } catch(e){ console.warn(e); teacherProfile = null; }
    saveStudentBtn.disabled = false;
    statusP.textContent = "Signed in as " + (user.email || user.uid);
    // preselect teacher's subject if present
    if (teacherProfile && teacherProfile.subject) {
      const opt = Array.from(subjectSelectAdd.options).find(o => o.value === teacherProfile.subject);
      if (opt) subjectSelectAdd.value = teacherProfile.subject;
    }
  });

  saveStudentBtn.addEventListener("click", async () => {
    statusP.textContent = "";
    const name = (studentName.value || "").trim();
    const roll = (studentRoll.value || "").trim();
    const cls = (classSelectAdd.value || "").trim();
    const subj = (subjectSelectAdd.value || "").trim();

    if (!currentUser) { statusP.textContent = "Please login first (on index)."; return; }
    if (!name || !roll || !cls || !subj) { statusP.textContent = "Fill all fields."; return; }

    // enforce teacher can only add students for their subject (if teacherProfile available)
    if (teacherProfile && teacherProfile.subject && teacherProfile.subject !== subj) {
      statusP.textContent = `You can add students only for your subject: ${teacherProfile.subject}`;
      return;
    }

    try {
      // path: students/<class>/<subject>/<roll>
      const nodeRef = ref(db, `students/${cls}/${subj}/${roll}`);
      await set(nodeRef, { name, roll });
      statusP.textContent = "Saved ✅";
      // keep fields for next entry
      studentName.value = ""; studentRoll.value = "";
    } catch (err) {
      console.error("Add student error", err);
      statusP.textContent = "Failed to save. See console.";
    }
  });

  backBtn.addEventListener("click", () => {
    window.close(); // if opened as popup; otherwise go back
    try { window.location.href = "index.html"; } catch(e){}
  });
});