import { db } from "./firebase.js";
import { ref, get, push, set, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function norm(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeSelected(values) {
  const list = Array.isArray(values) ? values : String(values || '').split(',');
  return Array.from(new Set(list.map(item => norm(item)).filter(Boolean)));
}

async function syncStudentIndexes(schoolId, student, previous = null) {
  const updates = {};
  const studentId = student.studentId;
  const oldClassId = norm(previous?.classId || '');
  const newClassId = norm(student.classId || '');
  const oldSubjects = normalizeSelected(previous?.selectedSubjectIds || []);
  const newSubjects = normalizeSelected(student.selectedSubjectIds || []);

  if (oldClassId && oldClassId !== newClassId) {
    updates[`schools/${schoolId}/sectionStudents/${oldClassId}/${studentId}`] = null;
    oldSubjects.forEach(subjectId => {
      updates[`schools/${schoolId}/sectionSubjectRosters/${oldClassId}/${subjectId}/${studentId}`] = null;
    });
  }

  if (newClassId) updates[`schools/${schoolId}/sectionStudents/${newClassId}/${studentId}`] = true;

  oldSubjects.forEach(subjectId => {
    if (!newSubjects.includes(subjectId) || oldClassId !== newClassId) {
      updates[`schools/${schoolId}/sectionSubjectRosters/${oldClassId || newClassId}/${subjectId}/${studentId}`] = null;
    }
  });

  newSubjects.forEach(subjectId => {
    if (newClassId) updates[`schools/${schoolId}/sectionSubjectRosters/${newClassId}/${subjectId}/${studentId}`] = true;
  });

  if (Object.keys(updates).length) {
    await update(ref(db), updates);
  }
}

export async function listStudents(schoolId) {
  const snap = await get(ref(db, `schools/${schoolId}/students`));
  if (!snap.exists()) return [];
  return Object.entries(snap.val() || {}).map(([studentId, value]) => ({ studentId, ...(value || {}) }));
}

export async function createStudent(schoolId, data) {
  const studentRef = push(ref(db, `schools/${schoolId}/students`));
  const studentId = studentRef.key;
  const ts = serverTimestamp();

  const row = {
    studentId,
    fullName: norm(data.fullName),
    classId: norm(data.classId),
    section: norm(data.section),
    stream: norm(data.stream),
    rollNo: norm(data.rollNo),
    admissionNo: norm(data.admissionNo),
    selectedSubjectIds: normalizeSelected(data.selectedSubjectIds || []),
    status: 'active',
    createdAt: ts,
    updatedAt: ts
  };

  await set(studentRef, row);
  await syncStudentIndexes(schoolId, row, null);
  return row;
}

export async function updateStudent(schoolId, studentId, data) {
  const path = `schools/${schoolId}/students/${studentId}`;
  const snap = await get(ref(db, path));
  if (!snap.exists()) throw new Error('Student not found');
  const existing = snap.val() || {};

  const row = {
    ...existing,
    studentId,
    fullName: norm(data.fullName ?? existing.fullName ?? ''),
    classId: norm(data.classId ?? existing.classId ?? ''),
    section: norm(data.section ?? existing.section ?? ''),
    stream: norm(data.stream ?? existing.stream ?? ''),
    rollNo: norm(data.rollNo ?? existing.rollNo ?? ''),
    admissionNo: norm(data.admissionNo ?? existing.admissionNo ?? ''),
    selectedSubjectIds: normalizeSelected(data.selectedSubjectIds ?? existing.selectedSubjectIds ?? []),
    status: 'active',
    updatedAt: serverTimestamp()
  };

  await set(ref(db, path), row);
  await syncStudentIndexes(schoolId, row, existing);
  return row;
}

export async function deleteStudent(schoolId, studentId) {
  const snap = await get(ref(db, `schools/${schoolId}/students/${studentId}`));
  const existing = snap.exists() ? (snap.val() || {}) : null;
  if (existing) {
    await syncStudentIndexes(schoolId, { studentId, classId: '', selectedSubjectIds: [] }, existing);
  }
  await set(ref(db, `schools/${schoolId}/students/${studentId}`), null);
}