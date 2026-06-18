import { db } from "./firebase.js";
import { ref, get, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await get(ref(db, `userProfiles/${uid}`));
  return snap.exists() ? snap.val() : null;
}

export function isSchoolAdmin(profile) {
  return profile?.role === "schoolAdmin" && !profile?.teacherId;
}

export function isTeacher(profile) {
  return profile?.role === "teacher" || !!profile?.teacherId;
}

export function getRouteForProfile(profile) {
  if (!profile) return "./school-setup.html";
  if (isSchoolAdmin(profile)) {
    return `./school-admin.html?schoolId=${encodeURIComponent(profile.schoolId || "")}`;
  }
  if (isTeacher(profile)) {
    return `./teacher-home.html?schoolId=${encodeURIComponent(profile.schoolId || "")}`;
  }
  return "./school-setup.html";
}

export async function upsertUserProfile(uid, profile) {
  const payload = {
    ...profile,
    updatedAt: serverTimestamp()
  };
  await update(ref(db, `userProfiles/${uid}`), payload);
}