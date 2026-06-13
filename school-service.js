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
    teacherId: auth.currentUser.uid,
    uid: auth.currentUser.uid,
    authUid: auth.currentUser.uid,
    name: normalizeWhitespace(adminName || auth.currentUser.displayName || 'School Admin'),
    email: normalizeWhitespace(adminEmail || auth.currentUser.email || ''),
    subject: 'Administration',
    classesText: '',
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
      notices: countChildren(school.notices),
      timetableClasses: countChildren(school.timetables)
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

function parseClassesText(classesText = '') {
  return normalizeWhitespace(classesText)
    .split(',')
    .map(item => normalizeWhitespace(item))
    .filter(Boolean);
}

async function syncTeacherAuthLinks(schoolId, record, previousAuthUid = '') {
  const authUid = normalizeWhitespace(record.authUid || '');
  const previousUid = normalizeWhitespace(previousAuthUid || '');
  const updates = {};

  if (previousUid && previousUid !== authUid) {
    updates[`teachers/${previousUid}`] = null;
  }

  if (authUid) {
    updates[`userProfiles/${authUid}`] = {
      displayName: record.name || 'Teacher',
      email: record.email || '',
      role: record.role || 'teacher',
      schoolId,
      status: record.status || 'active',
      teacherId: record.teacherId,
      updatedAt: serverTimestamp()
    };

    updates[`teachers/${authUid}`] = {
      name: record.name || 'Teacher',
      email: record.email || '',
      subject: record.subject || '',
      classes: parseClassesText(record.classesText || ''),
      schoolId,
      linkedTeacherId: record.teacherId,
      status: record.status || 'active'
    };
  }

  if (Object.keys(updates).length) {
    await update(ref(db), updates);
  }
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
    status: normalizeWhitespace(data.status || 'active') || 'active',
    createdAt,
    updatedAt: createdAt
  };

  await set(teacherRef, record);
  await syncTeacherAuthLinks(schoolId, record);
  return record;
}

export async function updateTeacherRecord(schoolId, teacherId, data) {
  const teacherPath = `schools/${schoolId}/teachers/${teacherId}`;
  const snap = await get(ref(db, teacherPath));
  if (!snap.exists()) throw new Error('Teacher record not found');

  const existing = snap.val() || {};
  const updatedAt = serverTimestamp();
  const isOwnAdminRecord = String(existing.authUid || existing.uid || '') === String(auth.currentUser?.uid || '') && String(existing.role || '') === 'schoolAdmin';

  const record = {
    ...existing,
    teacherId,
    authUid: normalizeWhitespace(data.authUid ?? existing.authUid ?? ''),
    name: normalizeWhitespace(data.name ?? existing.name ?? ''),
    email: normalizeWhitespace(data.email ?? existing.email ?? ''),
    subject: normalizeWhitespace(data.subject ?? existing.subject ?? ''),
    classesText: normalizeWhitespace(data.classesText ?? existing.classesText ?? ''),
    role: isOwnAdminRecord ? 'schoolAdmin' : 'teacher',
    status: normalizeWhitespace(data.status ?? existing.status ?? 'active') || 'active',
    updatedAt
  };

  await set(ref(db, teacherPath), record);
  await syncTeacherAuthLinks(schoolId, record, existing.authUid || '');
  return record;
}

export async function deleteTeacherRecord(schoolId, teacherId) {
  const teacherSnap = await get(ref(db, `schools/${schoolId}/teachers/${teacherId}`));
  const teacherRecord = teacherSnap.exists() ? (teacherSnap.val() || {}) : {};

  const updates = {};
  updates[`schools/${schoolId}/teachers/${teacherId}`] = null;
  updates[`schools/${schoolId}/teacherClassSubjects/${teacherId}`] = null;
  if (teacherRecord.authUid) {
    updates[`teachers/${teacherRecord.authUid}`] = null;
  }

  const [assignmentsSnap, classesSnap] = await Promise.all([
    get(ref(db, `schools/${schoolId}/teacherAssignments`)),
    get(ref(db, `schools/${schoolId}/classes`))
  ]);

  if (assignmentsSnap.exists()) {
    for (const [assignmentId, value] of Object.entries(assignmentsSnap.val() || {})) {
      if (String(value?.teacherId || '') === String(teacherId)) {
        updates[`schools/${schoolId}/teacherAssignments/${assignmentId}`] = null;
      }
    }
  }

  if (classesSnap.exists()) {
    for (const [classId, value] of Object.entries(classesSnap.val() || {})) {
      if (String(value?.classTeacherId || '') === String(teacherId)) {
        updates[`schools/${schoolId}/classes/${classId}/classTeacherId`] = '';
      }
    }
  }

  const timetableSnap = await get(ref(db, `schools/${schoolId}/timetables`));
  if (timetableSnap.exists()) {
    for (const [classId, days] of Object.entries(timetableSnap.val() || {})) {
      for (const [dayKey, periods] of Object.entries(days || {})) {
        for (const [periodId, period] of Object.entries(periods || {})) {
          if (String(period?.teacherId || '') === String(teacherId)) {
            updates[`schools/${schoolId}/timetables/${classId}/${dayKey}/${periodId}/teacherId`] = '';
            updates[`schools/${schoolId}/timetables/${classId}/${dayKey}/${periodId}/teacherName`] = '';
          }
        }
      }
    }
  }

  await update(ref(db), updates);
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

function normalizeSelectedSubjectIds(raw) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || '').split(',');
  return Array.from(new Set(list.map(item => normalizeWhitespace(item)).filter(Boolean)));
}

function normalizeSelectedSubjectNames(raw) {
  const list = Array.isArray(raw)
    ? raw
    : String(raw || '').split(',');
  return Array.from(new Set(list.map(item => normalizeWhitespace(item)).filter(Boolean)));
}

async function syncStudentRosterIndexes(schoolId, studentRecord, previousRecord = null) {
  const updates = {};
  const studentId = studentRecord.studentId;
  const oldClassId = normalizeWhitespace(previousRecord?.classId || '');
  const newClassId = normalizeWhitespace(studentRecord.classId || '');
  const oldSubjectIds = normalizeSelectedSubjectIds(previousRecord?.selectedSubjectIds || []);
  const newSubjectIds = normalizeSelectedSubjectIds(studentRecord.selectedSubjectIds || []);

  if (oldClassId && oldClassId !== newClassId) {
    updates[`schools/${schoolId}/sectionStudents/${oldClassId}/${studentId}`] = null;
    oldSubjectIds.forEach(subjectId => {
      updates[`schools/${schoolId}/sectionSubjectRosters/${oldClassId}/${subjectId}/${studentId}`] = null;
    });
  }

  if (newClassId) {
    updates[`schools/${schoolId}/sectionStudents/${newClassId}/${studentId}`] = true;
  }

  oldSubjectIds.forEach(subjectId => {
    if (!newSubjectIds.includes(subjectId) || oldClassId !== newClassId) {
      updates[`schools/${schoolId}/sectionSubjectRosters/${oldClassId || newClassId}/${subjectId}/${studentId}`] = null;
    }
  });

  newSubjectIds.forEach(subjectId => {
    if (newClassId) {
      updates[`schools/${schoolId}/sectionSubjectRosters/${newClassId}/${subjectId}/${studentId}`] = true;
    }
  });

  if (Object.keys(updates).length) {
    await update(ref(db), updates);
  }
}

export async function createStudentRecord(schoolId, data) {
  const studentRef = push(ref(db, `schools/${schoolId}/students`));
  const studentId = studentRef.key;
  const createdAt = serverTimestamp();

  const fullName = normalizeWhitespace(data.fullName || '');
  const classId = normalizeWhitespace(data.classId || '');
  const section = normalizeWhitespace(data.section || '');
  const rollNo = normalizeWhitespace(data.rollNo || '');
  const admissionNo = normalizeWhitespace(data.admissionNo || '');
  const subjectGroup = normalizeWhitespace(data.subjectGroup || '');
  const selectedSubjectIds = normalizeSelectedSubjectIds(data.selectedSubjectIds || []);
  const selectedSubjectNames = normalizeSelectedSubjectNames(data.selectedSubjectNames || []);

  const record = {
    studentId,
    fullName,
    classId,
    section,
    rollNo,
    admissionNo,
    subjectGroup,
    selectedSubjectIds,
    selectedSubjectNames,
    status: 'active',
    createdAt,
    updatedAt: createdAt
  };

  await set(studentRef, record);
  await syncStudentRosterIndexes(schoolId, record, null);
  return record;
}

export async function updateStudentRecord(schoolId, studentId, data) {
  const path = `schools/${schoolId}/students/${studentId}`;
  const snap = await get(ref(db, path));
  if (!snap.exists()) throw new Error('Student record not found');
  const existing = snap.val() || {};
  const updatedAt = serverTimestamp();

  const record = {
    ...existing,
    studentId,
    fullName: normalizeWhitespace(data.fullName ?? existing.fullName ?? existing.name ?? ''),
    classId: normalizeWhitespace(data.classId ?? existing.classId ?? ''),
    section: normalizeWhitespace(data.section ?? existing.section ?? ''),
    rollNo: normalizeWhitespace(data.rollNo ?? existing.rollNo ?? ''),
    admissionNo: normalizeWhitespace(data.admissionNo ?? existing.admissionNo ?? ''),
    subjectGroup: normalizeWhitespace(data.subjectGroup ?? existing.subjectGroup ?? ''),
    selectedSubjectIds: normalizeSelectedSubjectIds(data.selectedSubjectIds ?? existing.selectedSubjectIds ?? []),
    selectedSubjectNames: normalizeSelectedSubjectNames(data.selectedSubjectNames ?? existing.selectedSubjectNames ?? []),
    status: normalizeWhitespace(data.status ?? existing.status ?? 'active') || 'active',
    updatedAt
  };

  await set(ref(db, path), record);
  await syncStudentRosterIndexes(schoolId, record, existing);
  return record;
}

export async function deleteStudentRecord(schoolId, studentId) {
  const snap = await get(ref(db, `schools/${schoolId}/students/${studentId}`));
  const existing = snap.exists() ? (snap.val() || {}) : null;
  if (existing) {
    await syncStudentRosterIndexes(schoolId, { studentId, classId: '', selectedSubjectIds: [] }, existing);
  }
  await set(ref(db, `schools/${schoolId}/students/${studentId}`), null);
}

export async function listVisibleSchoolStudents(schoolId) {
  const [schoolStudentsSnap, schoolTeachersSnap, legacyStudentsSnap] = await Promise.all([
    get(ref(db, `schools/${schoolId}/students`)),
    get(ref(db, `schools/${schoolId}/teachers`)),
    get(ref(db, 'students'))
  ]);

  const result = [];
  const seen = new Set();

  if (schoolStudentsSnap.exists()) {
    for (const [studentId, value] of Object.entries(schoolStudentsSnap.val() || {})) {
      seen.add(studentId);
      result.push({
        studentId,
        fullName: value?.fullName || value?.name || 'Unknown',
        classId: value?.classId || '',
        section: value?.section || '',
        rollNo: value?.rollNo || '',
        admissionNo: value?.admissionNo || '',
        subjectGroup: value?.subjectGroup || '',
        selectedSubjectIds: normalizeSelectedSubjectIds(value?.selectedSubjectIds || []),
        selectedSubjectNames: normalizeSelectedSubjectNames(value?.selectedSubjectNames || []),
        status: value?.status || 'active',
        source: 'school'
      });
    }
  }

  const teacherIds = new Set();
  if (schoolTeachersSnap.exists()) {
    for (const [teacherId, value] of Object.entries(schoolTeachersSnap.val() || {})) {
      teacherIds.add(teacherId);
      if (value?.uid) teacherIds.add(String(value.uid));
      if (value?.authUid) teacherIds.add(String(value.authUid));
    }
  }

  if (legacyStudentsSnap.exists()) {
    for (const [studentId, value] of Object.entries(legacyStudentsSnap.val() || {})) {
      if (seen.has(studentId)) continue;
      if (!teacherIds.has(String(value?.teacher || ''))) continue;
      result.push({
        studentId,
        fullName: value?.fullName || value?.name || 'Unknown',
        classId: value?.classId || value?.class || '',
        section: value?.section || '',
        rollNo: value?.rollNo || '',
        admissionNo: value?.admissionNo || '',
        subjectGroup: value?.subjectGroup || '',
        selectedSubjectIds: normalizeSelectedSubjectIds(value?.selectedSubjectIds || value?.subject || []),
        selectedSubjectNames: normalizeSelectedSubjectNames(value?.selectedSubjectNames || value?.subject || []),
        status: value?.status || 'legacy',
        source: 'legacy'
      });
    }
  }

  return result.sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));
}

export async function upsertTimetableEntry(schoolId, data) {
  const classId = normalizeWhitespace(data.classId || '');
  const dayKey = normalizeWhitespace(data.dayKey || '').toLowerCase();
  const periodId = normalizeWhitespace(data.periodId || '');

  if (!classId || !dayKey || !periodId) {
    throw new Error('classId, dayKey and periodId are required');
  }

  const createdAt = serverTimestamp();
  const path = `schools/${schoolId}/timetables/${classId}/${dayKey}/${periodId}`;
  const existingSnap = await get(ref(db, path));
  const existing = existingSnap.exists() ? existingSnap.val() : {};

  const slotType = normalizeWhitespace(data.slotType || existing.slotType || 'subject') || 'subject';

  const record = {
    ...existing,
    classId,
    dayKey,
    periodId,
    slotType,
    periodNo: normalizeWhitespace(data.periodNo || existing.periodNo || ''),
    label: normalizeWhitespace(data.label || existing.label || ''),
    startTime: normalizeWhitespace(data.startTime || existing.startTime || ''),
    endTime: normalizeWhitespace(data.endTime || existing.endTime || ''),
    subjectId: normalizeWhitespace(data.subjectId || existing.subjectId || ''),
    subjectName: normalizeWhitespace(data.su