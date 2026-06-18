import { db } from "./firebase.js";
import { ref, get, push, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function norm(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export async function listAssignments(schoolId) {
  const snap = await get(ref(db, `schools/${schoolId}/teacherAssignments`));
  if (!snap.exists()) return [];
  return Object.entries(snap.val() || {}).map(([assignmentId, value]) => ({ assignmentId, ...(value || {}) }));
}

export async function createAssignment(schoolId, data) {
  const assignmentRef = push(ref(db, `schools/${schoolId}/teacherAssignments`));
  const assignmentId = assignmentRef.key;
  const teacherId = norm(data.teacherId);
  const classId = norm(data.classId);
  const subjectId = norm(data.subjectId);
  const ts = serverTimestamp();

  const updates = {};
  updates[`schools/${schoolId}/teacherAssignments/${assignmentId}`] = {
    assignmentId,
    teacherId,
    classId,
    subjectId,
    status: 'active',
    createdAt: ts,
    updatedAt: ts
  };
  updates[`schools/${schoolId}/teacherClassSubjects/${teacherId}/${classId}_${subjectId}`] = true;

  await update(ref(db), updates);
  return assignmentId;
}