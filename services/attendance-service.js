import { db } from "./firebase.js";
import { ref, get, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { listStudents } from "./student-service.js";
import { listTimetableForDay } from "./timetable-service.js";

function norm(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeSubjectIds(values) {
  const list = Array.isArray(values) ? values : String(values || "").split(',');
  return Array.from(new Set(list.map(item => norm(item)).filter(Boolean)));
}

export async function listStudentsForAttendanceScope(schoolId, classId, slotType = "class", subjectId = "") {
  const students = await listStudents(schoolId);
  const classStudents = students.filter(student => String(student.classId || "") === String(classId || ""));
  if (slotType !== "subject") return classStudents;
  const normalizedSubjectId = norm(subjectId);
  return classStudents.filter(student => normalizeSubjectIds(student.selectedSubjectIds || []).includes(normalizedSubjectId));
}

export async function getAttendanceRecords(schoolId, classId, date, periodId) {
  const snap = await get(ref(db, `schools/${schoolId}/attendance/${classId}/${date}/${periodId}`));
  return snap.exists() ? (snap.val() || {}) : {};
}

export async function savePeriodAttendance(schoolId, payload) {
  const classId = norm(payload.classId);
  const date = norm(payload.date);
  const periodId = norm(payload.periodId);
  if (!classId || !date || !periodId) {
    throw new Error("Class, date and period are required");
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const slotType = norm(payload.slotType || "class") || "class";
  const ts = serverTimestamp();
  const updates = {};

  rows.forEach(row => {
    const studentId = norm(row.studentId);
    if (!studentId) return;
    const status = norm(row.status || "present") || "present";
    updates[`schools/${schoolId}/attendance/${classId}/${date}/${periodId}/${studentId}`] = {
      studentId,
      studentName: norm(row.studentName),
      status,
      teacherId: norm(payload.teacherId),
      teacherName: norm(payload.teacherName),
      subjectId: norm(payload.subjectId),
      subjectName: norm(payload.subjectName),
      slotType,
      date,
      classId,
      periodId,
      updatedAt: ts
    };
  });

  updates[`schools/${schoolId}/attendanceMeta/${classId}/${date}/${periodId}`] = {
    classId,
    date,
    periodId,
    teacherId: norm(payload.teacherId),
    teacherName: norm(payload.teacherName),
    subjectId: norm(payload.subjectId),
    subjectName: norm(payload.subjectName),
    slotType,
    savedCount: rows.length,
    updatedAt: ts
  };

  await update(ref(db), updates);
  return { saved: rows.length };
}

export async function getTodayTeacherPeriodContext(schoolId, teacherId, dateStr) {
  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const date = new Date(`${dateStr}T00:00:00`);
  const dayKey = dayKeys[date.getDay()] || "";
  const rows = await listTimetableForDay(schoolId, "", dayKey);
  return rows.filter(row => String(row.teacherId || "") === String(teacherId));
}