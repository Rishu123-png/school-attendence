import { db } from "./firebase.js";
import { ref, get, set, push, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function norm(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export async function listTeachers(schoolId) {
  const snap = await get(ref(db, `schools/${schoolId}/teachers`));
  if (!snap.exists()) return [];
  return Object.entries(snap.val() || {}).map(([teacherId, value]) => ({ teacherId, ...(value || {}) }));
}

async function syncTeacherUserProfile(schoolId, teacher, previousAuthUid = "") {
  const authUid = norm(teacher.authUid || "");
  const previous = norm(previousAuthUid || "");
  const updates = {};

  if (previous && previous !== authUid) {
    updates[`userProfiles/${previous}/teacherId`] = null;
    updates[`userProfiles/${previous}/role`] = null;
    updates[`userProfiles/${previous}/schoolId`] = null;
  }

  if (authUid) {
    updates[`userProfiles/${authUid}`] = {
      displayName: teacher.name || "Teacher",
      email: teacher.email || "",
      role: "teacher",
      schoolId,
      teacherId: teacher.teacherId,
      status: teacher.status || "active",
      updatedAt: serverTimestamp()
    };
  }

  if (Object.keys(updates).length) {
    await update(ref(db), updates);
  }
}

export async function createTeacher(schoolId, data) {
  const teacherRef = push(ref(db, `schools/${schoolId}/teachers`));
  const teacherId = teacherRef.key;
  const ts = serverTimestamp();

  const teacher = {
    teacherId,
    authUid: norm(data.authUid),
    name: norm(data.name),
    email: norm(data.email),
    subject: norm(data.subject),
    role: "teacher",
    status: norm(data.status || "active") || "active",
    createdAt: ts,
    updatedAt: ts
  };

  await set(teacherRef, teacher);
  await syncTeacherUserProfile(schoolId, teacher);
  return teacher;
}

export async function updateTeacher(schoolId, teacherId, data) {
  const teacherPath = `schools/${schoolId}/teachers/${teacherId}`;
  const snap = await get(ref(db, teacherPath));
  if (!snap.exists()) throw new Error("Teacher not found");
  const existing = snap.val() || {};
  const ts = serverTimestamp();

  const teacher = {
    ...existing,
    teacherId,
    authUid: norm(data.authUid ?? existing.authUid ?? ""),
    name: norm(data.name ?? existing.name ?? ""),
    email: norm(data.email ?? existing.email ?? ""),
    subject: norm(data.subject ?? existing.subject ?? ""),
    role: existing.role === "schoolAdmin" ? "schoolAdmin" : "teacher",
    status: norm(data.status ?? existing.status ?? "active") || "active",
    updatedAt: ts
  };

  await set(ref(db, teacherPath), teacher);
  await syncTeacherUserProfile(schoolId, teacher, existing.authUid || "");
  return teacher;
}

export async function deleteTeacher(schoolId, teacherId) {
  const teacherSnap = await get(ref(db, `schools/${schoolId}/teachers/${teacherId}`));
  const teacher = teacherSnap.exists() ? (teacherSnap.val() || {}) : {};

  const updates = {};
  updates[`schools/${schoolId}/teachers/${teacherId}`] = null;
  updates[`schools/${schoolId}/teacherClassSubjects/${teacherId}`] = null;

  if (teacher.authUid) {
    updates[`userProfiles/${teacher.authUid}/teacherId`] = null;
    updates[`userProfiles/${teacher.authUid}/role`] = null;
    updates[`userProfiles/${teacher.authUid}/schoolId`] = null;
  }

  const assignmentsSnap = await get(ref(db, `schools/${schoolId}/teacherAssignments`));
  if (assignmentsSnap.exists()) {
    for (const [assignmentId, value] of Object.entries(assignmentsSnap.val() || {})) {
      if (String(value?.teacherId || "") === String(teacherId)) {
        updates[`schools/${schoolId}/teacherAssignments/${assignmentId}`] = null;
      }
    }
  }

  await update(ref(db), updates);
}