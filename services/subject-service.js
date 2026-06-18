import { db } from "./firebase.js";
import { ref, get, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function norm(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export async function listSubjects(schoolId) {
  const snap = await get(ref(db, `schools/${schoolId}/subjects`));
  if (!snap.exists()) return [];
  return Object.entries(snap.val() || {}).map(([subjectId, value]) => ({ subjectId, ...(value || {}) }));
}

export async function createSubject(schoolId, data) {
  const subjectRef = push(ref(db, `schools/${schoolId}/subjects`));
  const subjectId = subjectRef.key;
  const ts = serverTimestamp();

  const row = {
    subjectId,
    name: norm(data.name),
    code: norm(data.code),
    type: norm(data.type || 'core') || 'core',
    status: 'active',
    createdAt: ts,
    updatedAt: ts
  };

  await set(subjectRef, row);
  return row;
}