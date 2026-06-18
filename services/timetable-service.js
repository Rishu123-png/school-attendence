import { db } from "./firebase.js";
import { ref, get, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function norm(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

const DAY_ORDER = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7
};

export async function saveTimetableSlot(schoolId, data) {
  const classId = norm(data.classId);
  const dayKey = norm(data.dayKey).toLowerCase();
  const periodNo = norm(data.periodNo);
  const periodId = data.periodId ? norm(data.periodId) : `period_${periodNo}`;
  if (!schoolId || !classId || !dayKey || !periodId) {
    throw new Error("School, class, day and period are required");
  }

  const path = `schools/${schoolId}/timetables/${classId}/${dayKey}/${periodId}`;
  const existingSnap = await get(ref(db, path));
  const existing = existingSnap.exists() ? existingSnap.val() : {};

  const slotType = norm(data.slotType || existing.slotType || "subject") || "subject";
  const ts = serverTimestamp();

  const row = {
    ...existing,
    classId,
    dayKey,
    periodId,
    periodNo,
    slotType,
    label: norm(data.label || existing.label || `Period ${periodNo}`),
    startTime: norm(data.startTime || existing.startTime || ""),
    endTime: norm(data.endTime || existing.endTime || ""),
    subjectId: norm(data.subjectId || existing.subjectId || ""),
    subjectName: norm(data.subjectName || existing.subjectName || ""),
    teacherId: norm(data.teacherId || existing.teacherId || ""),
    teacherName: norm(data.teacherName || existing.teacherName || ""),
    roomNo: norm(data.roomNo || existing.roomNo || ""),
    status: "active",
    createdAt: existing.createdAt || ts,
    updatedAt: ts
  };

  await set(ref(db, path), row);
  return row;
}

export async function deleteTimetableSlot(schoolId, classId, dayKey, periodId) {
  await set(ref(db, `schools/${schoolId}/timetables/${classId}/${dayKey}/${periodId}`), null);
}

export async function listTimetableForClass(schoolId, classId = "") {
  const path = classId
    ? `schools/${schoolId}/timetables/${classId}`
    : `schools/${schoolId}/timetables`;
  const snap = await get(ref(db, path));
  if (!snap.exists()) return [];

  const source = snap.val() || {};
  const classBlocks = classId ? { [classId]: source } : source;
  const rows = [];

  for (const [resolvedClassId, days] of Object.entries(classBlocks)) {
    for (const [dayKey, periods] of Object.entries(days || {})) {
      for (const [periodId, value] of Object.entries(periods || {})) {
        rows.push({ classId: resolvedClassId, dayKey, periodId, ...(value || {}) });
      }
    }
  }

  return rows.sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.dayKey] || 99) - (DAY_ORDER[b.dayKey] || 99);
    if (dayDiff !== 0) return dayDiff;
    const aNum = parseInt(String(a.periodNo || a.periodId || "").replace(/\D/g, "")) || 999;
    const bNum = parseInt(String(b.periodNo || b.periodId || "").replace(/\D/g, "")) || 999;
    return aNum - bNum;
  });
}

export async function listTimetableForDay(schoolId, classId, dayKey) {
  const rows = await listTimetableForClass(schoolId, classId);
  return rows.filter(row => String(row.dayKey || "") === String(dayKey || "").toLowerCase());
}

export async function listTeacherScheduleForDate(schoolId, teacherId, dateStr) {
  if (!teacherId || !dateStr) return [];
  const date = new Date(`${dateStr}T00:00:00`);
  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayKey = dayKeys[date.getDay()] || "";
  const rows = await listTimetableForClass(schoolId, "");
  return rows.filter(row => String(row.dayKey || "") === dayKey && String(row.teacherId || "") === String(teacherId));
}