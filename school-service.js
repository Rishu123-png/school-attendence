// school-service.js — phase 2 foundation for multi-school onboarding
import { auth, db } from "./firebase.js";
import {
  ref,
  get,
  update,
  set,
  push,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { normalizeWhitespace } from "./security.js";

export function requireAuth(cb) {
  if (auth.currentUser) {
    cb(auth.currentUser);
    return;
  }
  const unsub = onAuthStateChanged(auth, user => {
    if (user) {
      unsub();
      cb(user);
    } else {
      unsub();
      window.location.href = 'index.html';
    }
  });
}

export async function getCurrentUserProfile() {
  if (!auth.currentUser) return null;
  const snap = await get(ref(db, `userProfiles/${auth.currentUser.uid}`));
  return snap.exists() ? snap.val() : null;
}

export function makeSchoolId(schoolName, schoolCode = '') {
  const base = normalizeWhitespace(schoolCode || schoolName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'school';

  return `${base}-${Date.now()}`;
}

export async function createSchoolAndAdmin({
  schoolName,
  schoolCode,
  adminName,
  adminEmail,
  phone,
  city,
  state,
  website
}) {
  if (!auth.currentUser) throw new Error('Login required');

  const schoolId = makeSchoolId(schoolName, schoolCode);
  const createdAt = serverTimestamp();

  const updates = {};
  updates[`schools/${schoolId}/profile`] = {
    name: normalizeWhitespace(schoolName),
    code: normalizeWhitespace(schoolCode),
    email: normalizeWhitespace(adminEmail || auth.currentUser.email || ''),
    phone: normalizeWhitespace(phone),
    city: normalizeWhitespace(city),
    state: normalizeWhitespace(state),
    website: normalizeWhitespace(website),
    plan: 'starter',
    status: 'active',
    createdAt,
    updatedAt: createdAt
  };

  updates[`schools/${schoolId}/admins/${auth.currentUser.uid}`] = {
    uid: auth.currentUser.uid,
    displayName: normalizeWhitespace(adminName || auth.currentUser.displayName || 'School Admin'),
    email: normalizeWhitespace(adminEmail || auth.currentUser.email || ''),
    role: 'schoolAdmin',
    status: 'active',
    createdAt,
    updatedAt: createdAt
  };

  updates[`schools/${schoolId}/teachers/${auth.currentUser.uid}`] = {
    uid: auth.currentUser.uid,
    name: normalizeWhitespace(adminName || auth.currentUser.displayName || 'School Admin'),
    email: normalizeWhitespace(adminEmail || auth.currentUser.email || ''),
    subject: 'Administration',
    role: 'schoolAdmin',
    status: 'active',
    createdAt,
    updatedAt: createdAt
  };

  updates[`userProfiles/${auth.currentUser.uid}`] = {
    displayName: normalizeWhitespace(adminName || auth.currentUser.displayName || 'School Admin'),
    email: normalizeWhitespace(adminEmail || auth.currentUser.email || ''),
    role: 'schoolAdmin',
    schoolId,
    status: 'active',
    createdAt,
    updatedAt: createdAt
  };

  await update(ref(db), updates);
  return { schoolId };
}

function countChildren(node) {
  if (!node || typeof node !== 'object') return 0;
  return Object.keys(node).length;
}

export async function getSchoolDashboardData(schoolId) {
  const snap = await get(ref(db, `schools/${schoolId}`));
  if (!snap.exists()) return null;
  const school = snap.val();

  return {
    schoolId,
    profile: school.profile || {},
    counts: {
      admins: countChildren(school.admins),
      teachers: countChildren(school.teachers),
      students: countChildren(school.students),
      classes: countChildren(school.classes),
      subjects: countChildren(school.subjects),
      notices: countChildren(school.notices)
    }
  };
}

export async function resolveActiveSchoolId(explicitSchoolId = '') {
  if (explicitSchoolId) return explicitSchoolId;
  const querySchoolId = new URLSearchParams(window.location.search).get('schoolId');
  if (querySchoolId) return querySchoolId;
  const profile = await getCurrentUserProfile();
  return profile?.schoolId || '';
}

export function mapObjectToArray(obj = {}, idField = 'id') {
  return Object.entries(obj || {}).map(([id, value]) => ({
    [idField]: id,
    ...(value || {})
  }));
}

export async function listSchoolCollection(schoolId, collectionName, idField = 'id') {
  const snap = await get(ref(db, `schools/${schoolId}/${collectionName}`));
  return snap.exists() ? mapObjectToArray(snap.val(), idField) : [];
}

export async function createTeacherRecord(schoolId, data) {
  const teacherRef = push(ref(db, `schools/${schoolId}/teachers`));
  const teacherId = teacherRef.key;
  const createdAt = serverTimestamp();

  const record = {
    teacherId,
    authUid: normalizeWhitespace(data.authUid || ''),
    name: normalizeWhitespace(data.name || ''),
    email: normalizeWhitespace(data.email || ''),
    subject: normalizeWhitespace(data.subject || ''),
    classesText: normalizeWhitespace(data.classesText || ''),
    role: 'teacher',
    status: 'active',
    createdAt,
    updatedAt: createdAt
  };

  await set(teacherRef, record);
  return record;
}

export async function createClassRecord(schoolId, data) {
  const classRef = push(ref(db, `schools/${schoolId}/classes`));
  const classId = classRef.key;
  const createdAt = serverTimestamp();

  const record = {
    classId,
    name: normalizeWhitespace(data.name || ''),
    section: normalizeWhitespace(data.section || ''),
    roomNo: normalizeWhitespace(data.roomNo || ''),
    classTeacherId: normalizeWhitespace(data.classTeacherId || ''),
    displayName: normalizeWhitespace(`${data.name || ''} ${data.section || ''}`),
    status: 'active',
    createdAt,
    updatedAt: createdAt
  };

  await set(classRef, record);
  return record;
}

export async function createSubjectRecord(schoolId, data) {
  const subjectRef = push(ref(db, `schools/${schoolId}/subjects`));
  const subjectId = subjectRef.key;
  const createdAt = serverTimestamp();

  const record = {
    subjectId,
    name: normalizeWhitespace(data.name || ''),
    code: normalizeWhitespace(data.code || ''),
    type: normalizeWhitespace(data.type || 'core'),
    status: 'active',
    createdAt,
    updatedAt: createdAt
  };

  await set(subjectRef, record);
  return record;
}

export async function createTeacherAssignmentRecord(schoolId, data) {
  const assignmentRef = push(ref(db, `schools/${schoolId}/teacherAssignments`));
  const assignmentId = assignmentRef.key;
  const createdAt = serverTimestamp();
  const teacherId = normalizeWhitespace(data.teacherId || '');
  const classId = normalizeWhitespace(data.classId || '');
  const subjectId = normalizeWhitespace(data.subjectId || '');

  const updates = {};
  updates[`schools/${schoolId}/teacherAssignments/${assignmentId}`] = {
    assignmentId,
    teacherId,
    classId,
    subjectId,
    status: 'active',
    createdAt,
    updatedAt: createdAt
  };
  updates[`schools/${schoolId}/teacherClassSubjects/${teacherId}/${classId}_${subjectId}`] = true;

  await update(ref(db), updates);
  return { assignmentId, teacherId, classId, subjectId };
}