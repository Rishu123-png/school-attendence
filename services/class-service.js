import { db } from "./firebase.js";
import { ref, get, push, set, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function norm(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export async function listClasses(schoolId) {
  const snap = await get(ref(db, `schools/${schoolId}/classes`));
  if (!snap.exists()) return [];
  return Object.entries(snap.val() || {}).map(([classId, value]) => ({ classId, ...(value || {}) }));
}

export async function createClass(schoolId, data) {
  const classRef = push(ref(db, `schools/${schoolId}/classes`));
  const classId = classRef.key;
  const ts = serverTimestamp();
  const name = norm(data.name);
  const section = norm(data.section);
  const stream = norm(data.stream);
  const displayName = norm([name, section, stream].filter(Boolean).join(' '));

  const row = {
    classId,
    name,
    section,
    stream,
    classTeacherId: norm(data.classTeacherId),
    roomNo: norm(data.roomNo),
    displayName,
    status: 'active',
    createdAt: ts,
    updatedAt: ts
  };

  await set(classRef, row);
  return row;
}

export async function updateClass(schoolId, classId, data) {
  const path = `schools/${schoolId}/classes/${classId}`;
  const snap = await get(ref(db, path));
  if (!snap.exists()) throw new Error('Class not found');
  const existing = snap.val() || {};
  const name = norm(data.name ?? existing.name ?? '');
  const section = norm(data.section ?? existing.section ?? '');
  const stream = norm(data.stream ?? existing.stream ?? '');
  const displayName = norm([name, section, stream].filter(Boolean).join(' '));

  const row = {
    ...existing,
    classId,
    name,
    section,
    stream,
    classTeacherId: norm(data.classTeacherId ?? existing.classTeacherId ?? ''),
    roomNo: norm(data.roomNo ?? existing.roomNo ?? ''),
    displayName,
    updatedAt: serverTimestamp()
  };

  await set(ref(db, path), row);
  return row;
}

export async function deleteClass(schoolId, classId) {
  const updates = {};
  updates[`schools/${schoolId}/classes/${classId}`] = null;
  updates[`schools/${schoolId}/sectionStudents/${classId}`] = null;
  updates[`schools/${schoolId}/timetables/${classId}`] = null;

  const assignmentsSnap = await get(ref(db, `schools/${schoolId}/teacherAssignments`));
  if (assignmentsSnap.exists()) {
    for (const [assignmentId, value] of Object.entries(assignmentsSnap.val() || {})) {
      if (String(value?.classId || '') === String(classId)) {
        updates[`schools/${schoolId}/teacherAssignments/${assignmentId}`] = null;
      }
    }
  }

  await update(ref(db), updates);
}