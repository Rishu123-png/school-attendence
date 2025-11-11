// script.js (module)
import { app } from "./firebase.js";
import { studentsData } from "./students.js"; // keep your students.js exported as `export const studentsData = {...}`

// Firebase
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  push,
  set,
  get,
  child
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";

import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-storage.js";

const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

// UI elements
const authLogin = document.getElementById("authLogin");
const authSignup = document.getElementById("authSignup");
const showSignup = document.getElementById("showSignup");
const showLogin = document.getElementById("showLogin");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const authMessage = document.getElementById("authMessage");

const fullName = document.getElementById("fullName");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupClass = document.getElementById("signupClass");
const signupSubject = document.getElementById("signupSubject");
const avatarUpload = document.getElementById("avatarUpload");
const avatarPreview = document.getElementById("avatarPreview");
const signupBtn = document.getElementById("signupBtn");
const signupMessage = document.getElementById("signupMessage");

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
const historyTableBody = document.querySelector("#historyTable tbody");

// toggle login/signup
showSignup.addEventListener("click", () => {
  authLogin.style.display = "none";
  authSignup.style.display = "block";
  authMessage.textContent = "";
});
showLogin.addEventListener("click", () => {
  authSignup.style.display = "none";
  authLogin.style.display = "block";
  signupMessage.textContent = "";
});

// preview selected avatar image
avatarUpload?.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  avatarPreview.src = url;
});

// helper escape id
function escapeId(str) {
  return str.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_\-]/g, "");
}

// populate class & subject selects (from studentsData keys)
function populateClassSubjectSelects() {
  // classes from studentsData
  const classes = Object.keys(studentsData || {});
  classSelect.innerHTML = `<option value="">-- Select Class --</option>`;
  classes.forEach(c => classSelect.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`));

  // subjects (collect unique)
  const subjSet = new Set();
  classes.forEach(c => {
    Object.keys(studentsData[c] || {}).forEach(s => subjSet.add(s));
  });
  subjectSelect.innerHTML = `<option value="">-- Select Subject --</option>`;
  Array.from(subjSet).sort().forEach(s => subjectSelect.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`));
}
populateClassSubjectSelects();

// --- SIGNUP: create user, upload avatar, save profile
signupBtn.addEventListener("click", async () => {
  const name = fullName.value.trim();
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const cls = signupClass.value.trim();
  const subj = signupSubject.value.trim();

  signupMessage.textContent = "";
  if (!name || !email || !password || password.length < 6 || !cls || !subj) {
    signupMessage.textContent = "Please complete all fields (password min 6 chars).";
    return;
  }

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;

    // upload avatar if present
    let photoURL = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    const file = avatarUpload?.files?.[0];
    if (file) {
      const fileRef = sRef(storage, `avatars/${uid}/${file.name}`);
      await uploadBytes(fileRef, file);
      photoURL = await getDownloadURL(fileRef);
      // set auth profile photo too
      try { await updateProfile(userCred.user, { displayName: name, photoURL }); } catch(e){ console.warn("updateProfile failed", e); }
    } else {
      try { await updateProfile(userCred.user, { displayName: name }); } catch(e){ /*ignore*/ }
    }

    // save teacher profile
    await set(ref(db, `teachers/${uid}`), {
      name,
      email,
      class: cls,
      subject: subj,
      photoURL,
      createdAt: new Date().toISOString()
    });

    signupMessage.textContent = "Account created — please login.";
    authSignup.style.display = "none";
    authLogin.style.display = "block";
    loginEmail.value = email;
    loginPassword.value = "";

  } catch (err) {
    console.error(err);
    signupMessage.textContent = "Error: " + (err.message || "Sign up failed");
  }
});

// --- LOGIN
loginBtn.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  authMessage.textContent = "";
  if (!email || !password) { authMessage.textContent = "Enter email & password."; return; }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // UI updated by onAuthStateChanged
  } catch (err) {
    console.error(err);
    authMessage.textContent = "Login failed: " + (err.message || "");
  }
});

// --- AUTH STATE: show dashboard when logged in
onAuthStateChanged(auth, async (user) => {
  if (user) {
    dashboard.style.display = "block";
    authLogin.style.display = "none";
    authSignup.style.display = "none";

    // load profile from DB
    try {
      const snap = await get(child(ref(db), `teachers/${user.uid}`));
      const profile = snap.exists() ? snap.val() : null;
      welcome.innerText = `Welcome, ${profile?.name || user.email}`;
      teacherMeta.innerText = profile ? `${profile.subject} • ${profile.class}` : user.email;
      teacherAvatar.src = profile?.photoURL || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    } catch (e) {
      console.warn("profile load failed", e);
      welcome.innerText = `Welcome, ${user.email}`;
      teacherMeta.innerText = "";
      teacherAvatar.src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    }

  } else {
    dashboard.style.display = "none";
    authLogin.style.display = "block";
  }
});

// LOGOUT
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  // clear UI
  studentListContainer.innerHTML = "";
  historyTableBody.innerHTML = "";
  historyContainer.style.display = "none";
});

// --- students load when selects change
classSelect.addEventListener("change", () => renderStudentsFor(classSelect.value, subjectSelect.value));
subjectSelect.addEventListener("change", () => renderStudentsFor(classSelect.value, subjectSelect.value));

function renderStudentsFor(className, subjectName) {
  studentListContainer.innerHTML = "";
  if (!className || !subjectName) return;

  const list = (studentsData[className] && studentsData[className][subjectName]) ? [...studentsData[className][subjectName]] : [];
  list.sort((a,b)=> a.localeCompare(b, undefined, {sensitivity:'base'}));

  if (list.length === 0) {
    studentListContainer.innerHTML = `<p class="muted">No students configured for ${className} / ${subjectName}.</p>`;
    return;
  }

  list.forEach(student => {
    const div = document.createElement("div");
    div.className = "student-row";
    div.innerHTML = `<span>${student}</span>
      <div style="display:flex;gap:8px">
        <select id="status-${escapeId(student)}">
          <option>Present</option>
          <option>Absent</option>
        </select>
      </div>`;
    studentListContainer.appendChild(div);
  });
}

// --- Save attendance for all students shown
saveAll.addEventListener("click", async () => {
  const className = classSelect.value;
  const subjectName = subjectSelect.value;
  const user = auth.currentUser;
  if (!user) { alert("Please login."); return; }
  if (!className || !subjectName) { alert("Select class and subject."); return; }

  const rows = studentListContainer.querySelectorAll(".student-row");
  if (rows.length === 0) { alert("No students to save."); return; }

  const date = new Date().toISOString().split("T")[0];
  const ts = new Date().toISOString();

  try {
    for (const row of rows) {
      const name = row.querySelector("span").innerText;
      const status = row.querySelector("select").value;
      await push(ref(db, `attendance/${date}/${className}/${subjectName}`), {
        student: name,
        status,
        teacher: user.email,
        timestamp: ts
      });
    }
    alert("✅ Attendance saved for all listed students.");
  } catch (err) {
    console.error(err);
    alert("Error saving attendance.");
  }
});

// --- View history
viewHistory.addEventListener("click", async () => {
  historyContainer.style.display = "none";
  historyTableBody.innerHTML = "";

  const className = classSelect.value;
  const subjectName = subjectSelect.value;
  if (!className || !subjectName) { alert("Select class & subject to view history."); return; }

  try {
    const snapshot = await get(child(ref(db), `attendance`));
    if (!snapshot.exists()) { alert("No attendance records."); return; }
    const all = snapshot.val();

    const rows = [];
    for (const dateKey of Object.keys(all).sort().reverse()) {
      const byClass = all[dateKey];
      if (!byClass[className] || !byClass[className][subjectName]) continue;
      const group = byClass[className][subjectName];
      for (const pushId of Object.keys(group)) {
        const rec = group[pushId];
        rows.push({ date: dateKey, student: rec.student, status: rec.status, teacher: rec.teacher, time: rec.timestamp });
      }
    }

    if (rows.length === 0) { alert("No records for this class & subject."); return; }

    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.date}</td><td>${className}</td><td>${subjectName}</td><td>${r.student}</td><td>${r.status}</td><td>${r.teacher}</td>`;
      historyTableBody.appendChild(tr);
    });

    historyContainer.style.display = "block";
    historyContainer.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error(err);
    alert("Failed to load history.");
  }
});
