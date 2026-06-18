import { auth, db } from "./firebase.js";
import { ref, get, update, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function norm(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function makeSchoolId(name, code = "") {
  const base = norm(code || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "school";
  return `${base}-${Date.now()}`;
}

export async function createSchoolWorkspace(data) {
  if (!auth.currentUser) throw new Error("Login required");

  const schoolId = makeSchoolId(data.schoolName, data.schoolCode);
  const ts = serverTimestamp();
  const uid = auth.currentUser.uid;
  const adminName = norm(data.adminName || auth.currentUser.displayName || "School Admin");
  const adminEmail = norm(data.adminEmail || auth.currentUser.email || "");

  const updates = {};
  updates[`schools/${schoolId}/profile`] = {
    name: norm(data.schoolName),
    code: norm(data.schoolCode),
    email: adminEmail,
    phone: norm(data.phone),
    city: norm(data.city),
    state: norm(data.state),
    website: norm(data.website),
    plan: "starter",
    status: "active",
    createdAt: ts,
    updatedAt: ts
  };

  updates[`schools/${schoolId}/admins/${uid}`] = {
    uid,
    displayName: adminName,
    email: adminEmail,
    role: "schoolAdmin",
    status: "active",
    createdAt: ts,
    updatedAt: ts
  };

  updates[`schools/${schoolId}/teachers/${uid}`] = {
    teacherId: uid,
    uid,
    authUid: uid,
    name: adminName,
    email: adminEmail,
    subject: "Administration",
    role: "schoolAdmin",
    status: "active",
    createdAt: ts,
    updatedAt: ts
  };

  updates[`userProfiles/${uid}`] = {
    displayName: adminName,
    email: adminEmail,
    role: "schoolAdmin",
    schoolId,
    status: "active",
    updatedAt: ts
  };

  await update(ref(db), updates);
  return { schoolId };
}

function countChildren(node) {
  return node && typeof node === "object" ? Object.keys(node).length : 0;
}

export async function getSchoolSummary(schoolId) {
  const snap = await get(ref(db, `schools/${schoolId}`));
  if (!snap.exists()) return null;
  const school = snap.val() || {};
  return {
    profile: school.profile || {},
    counts: {
      admins: countChildren(school.admins),
      teachers: countChildren(school.teachers),
      students: countChildren(school.students),
      classes: countChildren(school.classes),
      subjects: countChildren(school.subjects),
      timetables: countChildren(school.timetables)
    }
  };
}

export async function listSchoolCollection(schoolId, collectionName, idField = "id") {
  const snap = await get(ref(db, `schools/${schoolId}/${collectionName}`));
  if (!snap.exists()) return [];
  return Object.entries(snap.val() || {}).map(([id, value]) => ({
    [idField]: id,
    ...(value || {})
  }));
}

export async function createTeacherStub(schoolId, teacher) {
  const teacherRef = push(ref(db, `schools/${schoolId}/teachers`));
  const teacherId = teacherRef.key;
  const ts = serverTimestamp();
  await update(ref(db), {
    [`schools/${schoolId}/teachers/${teacherId}`]: {
      teacherId,
      authUid: norm(teacher.authUid),
      name: norm(teacher.name),
      email: norm(teacher.email),
      subject: norm(teacher.subject),
      role: "teacher",
      status: "active",
      createdAt: ts,
      updatedAt: ts
    }
  });
  return teacherId;
}