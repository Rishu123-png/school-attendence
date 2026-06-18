/* ============================================================
   PROFILE SERVICE — UPGRADED
   Added: isStudent(), isParent() roles for future mobile app
   Fixed: schoolId NEVER trusted from URL for auth decisions
   ============================================================ */

import { db } from "./firebase.js";
import { ref, get, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await get(ref(db, `userProfiles/${uid}`));
  return snap.exists() ? snap.val() : null;
}

export function isSchoolAdmin(profile) {
  return profile?.role === "schoolAdmin";
}

export function isTeacher(profile) {
  return profile?.role === "teacher" || (profile?.role === "schoolAdmin" && !!profile?.teacherId);
}

/* NEW: Student and Parent roles for mobile app */
export function isStudent(profile) {
  return profile?.role === "student";
}

export function isParent(profile) {
  return profile?.role === "parent";
}

export function getRouteForProfile(profile) {
  if (!profile) return "./school-setup.html";
  if (isSchoolAdmin(profile)) {
    return `./school-admin.html?schoolId=${encodeURIComponent(profile.schoolId || "")}`;
  }
  if (isTeacher(profile)) {
    return `./teacher-home.html?schoolId=${encodeURIComponent(profile.schoolId || "")}`;
  }
  if (isStudent(profile)) {
    return `./student-home.html?schoolId=${encodeURIComponent(profile.schoolId || "")}`;
  }
  if (isParent(profile)) {
    return `./parent-home.html?schoolId=${encodeURIComponent(profile.schoolId || "")}`;
  }
  return "./school-setup.html";
}

/* Get schoolId from profile only — NEVER trust URL for auth/write decisions */
export function getSchoolIdFromProfile(profile) {
  return profile?.schoolId || "";
}

export async function upsertUserProfile(uid, profile) {
  const payload = { ...profile, updatedAt: serverTimestamp() };
  await update(ref(db, `userProfiles/${uid}`), payload);
}
