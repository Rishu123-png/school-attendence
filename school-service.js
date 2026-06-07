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
    role: normalizeWhitespace(data.role || 'teacher') || 'teacher',
    status: normalizeWhitespace(data.status || 'active') || 'active',
    createdAt,
    updatedAt: createdAt
  };

  await set(teacherRef, record);
  return record;
}

export async function updateTeacherRecord(schoolId, teacherId, data) {
  const teacherPath = `schools/${schoolId}/teachers/${teacherId}`;
  const snap = await get(ref(db, teacherPath));
  if (!snap.exists()) throw new Error('Teacher record not found');

  const existing = snap.val() || {};
  const updatedAt = serverTimestamp();

  const record = {
    ...existing,
    teacherId,
    authUid: normalizeWhitespace(data.authUid ?? existing.authUid ?? ''),
    name: normalizeWhitespace(data.name ?? existing.name ?? ''),
    email: normalizeWhitespace(data.email ?? existing.email ?? ''),
    subject: normalizeWhitespace(data.subject ?? existing.subject ?? ''),
    classesText: normalizeWhitespace(data.classesText ?? existing.classesText ?? ''),
    role: normalizeWhitespace(data.role ?? existing.role ?? 'teacher') || 'teacher',
    status: normalizeWhitespace(data.status ?? existing.status ?? 'active') || 'active',
    updatedAt
  };

  await set(ref(db, teacherPath), record);
  return record;
}

export async function deleteTeacherRecord(schoolId, teacherId) {
  const updates = {};
  updates[`schools/${schoolId}/teachers/${teacherId}`] = null;
  updates[`schools/${schoolId}/teacherClassSubjects/${teacherId}`] = null;

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

export async function createStudentRecord(schoolId, data) {
  const studentRef = push(ref(db, `schools/${schoolId}/students`));
  const studentId = studentRef.key;
  const createdAt = serverTimestamp();

  const fullName = normalizeWhitespace(data.fullName || '');
  const classId = normalizeWhitespace(data.classId || '');
  const section = normalizeWhitespace(data.section || '');
  const rollNo = normalizeWhitespace(data.rollNo || '');
  const admissionNo = normalizeWhitespace(data.admissionNo || '');

  const record = {
    studentId,
    fullName,
    classId,
    section,
    rollNo,
    admissionNo,
    status: 'active',
    createdAt,
    updatedAt: createdAt
  };

  await set(studentRef, record);
  return record;
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

  const record = {
    ...existing,
    classId,
    dayKey,
    periodId,
    periodNo: normalizeWhitespace(data.periodNo || existing.periodNo || ''),
    label: normalizeWhitespace(data.label || existing.label || ''),
    startTime: normalizeWhitespace(data.startTime || existing.startTime || ''),
    endTime: normalizeWhitespace(data.endTime || existing.endTime || ''),
    subjectId: normalizeWhitespace(data.subjectId || existing.subjectId || ''),
    subjectName: normalizeWhitespace(data.subjectName || existing.subjectName || ''),
    teacherId: normalizeWhitespace(data.teacherId || existing.teacherId || ''),
    teacherName: normalizeWhitespace(data.teacherName || existing.teacherName || ''),
    roomNo: normalizeWhitespace(data.roomNo || existing.roomNo || ''),
    status: 'active',
    createdAt: existing.createdAt || createdAt,
    updatedAt: createdAt
  };

  await set(ref(db, path), record);
  return record;
}

export async function deleteTimetableEntry(schoolId, classId, dayKey, periodId) {
  await set(ref(db, `schools/${schoolId}/timetables/${classId}/${dayKey}/${periodId}`), null);
}

export async function listTimetableForClass(schoolId, classId = '') {
  const basePath = classId
    ? `schools/${schoolId}/timetables/${classId}`
    : `schools/${schoolId}/timetables`;

  const snap = await get(ref(db, basePath));
  if (!snap.exists()) return [];

  const order = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 7
  };

  const entries = [];
  const rootVal = snap.val() || {};

  const classBlocks = classId ? { [classId]: rootVal } : rootVal;
  for (const [resolvedClassId, days] of Object.entries(classBlocks || {})) {
    for (const [dayKey, periods] of Object.entries(days || {})) {
      for (const [periodId, value] of Object.entries(periods || {})) {
        entries.push({
          classId: resolvedClassId,
          dayKey,
          periodId,
          ...(value || {})
        });
      }
    }
  }

  return entries.sort((a, b) => {
    const dayDiff = (order[a.dayKey] || 99) - (order[b.dayKey] || 99);
    if (dayDiff !== 0) return dayDiff;
    const aNum = parseInt(String(a.periodNo || a.periodId || '').replace(/\D/g, '')) || 999;
    const bNum = parseInt(String(b.periodNo || b.periodId || '').replace(/\D/g, '')) || 999;
    return aNum - bNum;
  });
}

export async function listTimetableForDay(schoolId, classId, dayKey) {
  const rows = await listTimetableForClass(schoolId, classId);
  return rows.filter(row => String(row.dayKey || '') === String(dayKey || '').toLowerCase());
}

export async function getPeriodAttendanceRecords(schoolId, classId, date, periodId) {
  const snap = await get(ref(db, `schools/${schoolId}/attendance/${classId}/${date}/${periodId}`));
  return snap.exists() ? (snap.val() || {}) : {};
}

export async function savePeriodAttendanceBatch(schoolId, data) {
  const classId = normalizeWhitespace(data.classId || '');
  const date = normalizeWhitespace(data.date || '');
  const periodId = normalizeWhitespace(data.periodId || '');

  if (!classId || !date || !periodId) {
    throw new Error('classId, date and periodId are required');
  }

  const updates = {};
  const updatedAt = serverTimestamp();
  const rows = Array.isArray(data.rows) ? data.rows : [];

  rows.forEach(row => {
    const studentId = normalizeWhitespace(row.studentId || '');
    if (!studentId) return;
    updates[`schools/${schoolId}/attendance/${classId}/${date}/${periodId}/${studentId}`] = {
      studentId,
      studentName: normalizeWhitespace(row.studentName || ''),
      status: normalizeWhitespace(row.status || 'present') || 'present',
      teacherId: normalizeWhitespace(data.teacherId || ''),
      teacherName: normalizeWhitespace(data.teacherName || ''),
      subjectId: normalizeWhitespace(data.subjectId || ''),
      subjectName: normalizeWhitespace(data.subjectName || ''),
      date,
      classId,
      periodId,
      recordedAt: updatedAt,
      updatedAt,
      source: 'teacher-web'
    };
  });

  await update(ref(db), updates);
  return { saved: rows.length };
}

export async function resolveTeacherRecordForCurrentUser(schoolId) {
  if (!auth.currentUser) return null;
  const teachers = await listSchoolCollection(schoolId, 'teachers', 'teacherId');
  const uid = String(auth.currentUser.uid);
  return teachers.find(teacher =>
    String(teacher.teacherId || '') === uid ||
    String(teacher.uid || '') === uid ||
    String(teacher.authUid || '') === uid
  ) || null;
}

export async function listTeacherScheduleForDate(schoolId, teacherId, dateStr) {
  const dayInfo = (() => {
    if (!dateStr) return { key: '' };
    const d = new Date(`${dateStr}T00:00:00`);
    const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return { key: keys[d.getDay()] || '' };
  })();

  if (!teacherId || !dayInfo.key) return [];
  const allRows = await listTimetableForClass(schoolId, '');
  return allRows.filter(row =>
    String(row.dayKey || '') === String(dayInfo.key) &&
    String(row.teacherId || '') === String(teacherId)
  );
}
