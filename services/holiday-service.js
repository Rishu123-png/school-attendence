/* ============================================================
   HOLIDAY SERVICE — NEW
   Admin sets holidays, teacher pages check before marking
   ============================================================ */

import { db } from "./firebase.js";
import { ref, get, set, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export async function listHolidays(schoolId) {
  const snap = await get(ref(db, `schools/${schoolId}/holidays`));
  if (!snap.exists()) return [];
  return Object.entries(snap.val() || {}).map(([date, value]) => ({
    date,
    reason: typeof value === "string" ? value : (value?.reason || "Holiday"),
    type:   typeof value === "object" ? (value?.type || "holiday") : "holiday"
  })).sort((a, b) => a.date.localeCompare(b.date));
}

export async function setHoliday(schoolId, date, reason, type = "holiday") {
  if (!date || !reason) throw new Error("Date and reason are required");
  await set(ref(db, `schools/${schoolId}/holidays/${date}`), {
    date, reason, type,
    createdAt: serverTimestamp()
  });
}

export async function deleteHoliday(schoolId, date) {
  await set(ref(db, `schools/${schoolId}/holidays/${date}`), null);
}

export async function isHoliday(schoolId, date) {
  const snap = await get(ref(db, `schools/${schoolId}/holidays/${date}`));
  return snap.exists();
}

export async function getHolidaysMap(schoolId) {
  const holidays = await listHolidays(schoolId);
  return new Map(holidays.map(h => [h.date, h]));
}
