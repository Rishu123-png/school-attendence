/* ============================================================
   ATTENDANCE SERVICE — v3 UPGRADED
   NEW: Auto attendance % calculator after every save
        bunkEvent cleanup on re-mark (absent→present fix)
        attendanceSummary cache written per student per subject
        getAttendanceSummary() for marks auto-fill
        getAtRiskStudents() for 75% alert
        listAttendanceForDateRange() for export/print
   ============================================================ */

import { db } from "./firebase.js";
import {
  ref, get, update, set, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { listStudents } from "./student-service.js";

function norm(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}
function normalizeSubjectIds(values) {
  const list = Array.isArray(values) ? values : String(values || "").split(",");
  return Array.from(new Set(list.map(i => norm(i)).filter(Boolean)));
}

/* ─── List students for attendance scope ─────────────────────── */
export async function listStudentsForAttendanceScope(schoolId, classId, slotType = "class", subjectId = "") {
  const students = await listStudents(schoolId);
  const classStudents = students.filter(s => String(s.classId || "") === String(classId || ""));
  if (slotType !== "subject") return classStudents;
  const normSubId = norm(subjectId);
  return classStudents.filter(s => normalizeSubjectIds(s.selectedSubjectIds || []).includes(normSubId));
}

/* ─── Get attendance records for a period ────────────────────── */
export async function getAttendanceRecords(schoolId, classId, date, periodId) {
  const snap = await get(ref(db, `schools/${schoolId}/attendance/${classId}/${date}/${periodId}`));
  return snap.exists() ? (snap.val() || {}) : {};
}

/* ─── Get attendance summary for a student (for marks auto-fill) */
export async function getAttendanceSummary(schoolId, studentId, subjectId) {
  const snap = await get(ref(db, `schools/${schoolId}/attendanceSummary/${studentId}/${subjectId}`));
  return snap.exists() ? (snap.val() || {}) : { presentCount: 0, totalCount: 0, pct: 0 };
}

/* ─── Get overall attendance summary for a student ───────────── */
export async function getStudentOverallSummary(schoolId, studentId) {
  const snap = await get(ref(db, `schools/${schoolId}/attendanceSummary/${studentId}`));
  return snap.exists() ? (snap.val() || {}) : {};
}

/* ─── Get at-risk students (below threshold %) ───────────────── */
export async function getAtRiskStudents(schoolId, threshold = 75) {
  const snap = await get(ref(db, `schools/${schoolId}/attendanceSummary`));
  if (!snap.exists()) return [];
  const result = [];
  for (const [studentId, subjects] of Object.entries(snap.val() || {})) {
    for (const [subjectId, summary] of Object.entries(subjects || {})) {
      if (summary && typeof summary.pct === "number" && summary.pct < threshold && summary.totalCount >= 3) {
        result.push({ studentId, subjectId, ...summary });
      }
    }
  }
  return result.sort((a, b) => a.pct - b.pct);
}

/* ─── List attendance for a date range (for export/print) ───── */
export async function listAttendanceForDateRange(schoolId, classId, fromDate, toDate) {
  const snap = await get(ref(db, `schools/${schoolId}/attendance/${classId}`));
  if (!snap.exists()) return [];
  const result = [];
  for (const [date, periods] of Object.entries(snap.val() || {})) {
    if (date < fromDate || date > toDate) continue;
    for (const [periodId, students] of Object.entries(periods || {})) {
      for (const [studentId, record] of Object.entries(students || {})) {
        result.push({ date, periodId, studentId, ...record });
      }
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.periodId.localeCompare(b.periodId));
}

/* ─── Auto-compute and cache attendance % ────────────────────── */
async function recomputeAttendanceSummary(schoolId, classId, subjectId, studentIds, updates) {
  for (const studentId of studentIds) {
    /* Read ALL attendance records for this student in this school for this subject */
    const allClassSnap = await get(ref(db, `schools/${schoolId}/attendance/${classId}`));
    let presentCount = 0, totalCount = 0;
    if (allClassSnap.exists()) {
      for (const [, periods] of Object.entries(allClassSnap.val() || {})) {
        for (const [, students] of Object.entries(periods || {})) {
          const rec = students[studentId];
          if (!rec) continue;
          if (subjectId && norm(rec.subjectId || "") !== norm(subjectId)) continue;
          totalCount++;
          if (rec.status === "present" || rec.status === "late") presentCount++;
        }
      }
    }
    const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
    const summaryPath = `schools/${schoolId}/attendanceSummary/${studentId}/${subjectId || "_class"}`;
    updates[summaryPath] = {
      studentId, subjectId: subjectId || "_class", classId,
      presentCount, totalCount, pct,
      atRisk: pct < 75 && totalCount >= 3,
      updatedAt: serverTimestamp()
    };
  }
}

/* ─── MAIN: Save period attendance ───────────────────────────── */
export async function savePeriodAttendance(schoolId, payload) {
  const classId  = norm(payload.classId);
  const date     = norm(payload.date);
  const periodId = norm(payload.periodId);
  if (!classId || !date || !periodId) throw new Error("Class, date and period are required");

  const rows     = Array.isArray(payload.rows) ? payload.rows : [];
  const slotType = norm(payload.slotType || "class") || "class";
  const ts       = serverTimestamp();
  const updates  = {};

  rows.forEach(row => {
    const studentId = norm(row.studentId);
    if (!studentId) return;
    const status = norm(row.status || "present") || "present";

    /* Core attendance record */
    updates[`schools/${schoolId}/attendance/${classId}/${date}/${periodId}/${studentId}`] = {
      studentId,
      studentName:  norm(row.studentName),
      status,
      teacherId:    norm(payload.teacherId),
      teacherName:  norm(payload.teacherName),
      subjectId:    norm(payload.subjectId),
      subjectName:  norm(payload.subjectName),
      slotType, date, classId, periodId,
      updatedAt: ts
    };

    const bunkKey = `${date}_${periodId}`;

    /* ── BUG FIX: Always clean bunkEvent first, then re-create if absent ── */
    updates[`schools/${schoolId}/bunkEvents/${studentId}/${bunkKey}`] = null;
    updates[`schools/${schoolId}/parentNotifications/${studentId}/${bunkKey}`] = null;

    /* Only create bunk event if subject slot AND absent */
    if (slotType === "subject" && status === "absent") {
      updates[`schools/${schoolId}/bunkEvents/${studentId}/${bunkKey}`] = {
        studentId,
        studentName:  norm(row.studentName),
        classId,
        subjectId:    norm(payload.subjectId),
        subjectName:  norm(payload.subjectName),
        teacherId:    norm(payload.teacherId),
        teacherName:  norm(payload.teacherName),
        date, periodId,
        status: "bunk",
        createdAt: ts
      };
      updates[`schools/${schoolId}/parentNotifications/${studentId}/${bunkKey}`] = {
        notificationId: bunkKey, studentId,
        studentName:  norm(row.studentName), classId,
        subjectId:    norm(payload.subjectId),
        subjectName:  norm(payload.subjectName),
        teacherId:    norm(payload.teacherId),
        teacherName:  norm(payload.teacherName),
        date, periodId,
        type:   "subject_bunk",
        status: "pending-parent-link",
        createdAt: ts
      };
    }
  });

  /* Attendance meta */
  updates[`schools/${schoolId}/attendanceMeta/${classId}/${date}/${periodId}`] = {
    classId, date, periodId,
    teacherId:    norm(payload.teacherId),
    teacherName:  norm(payload.teacherName),
    subjectId:    norm(payload.subjectId),
    subjectName:  norm(payload.subjectName),
    slotType, savedCount: rows.length,
    saveStatus: "submitted",
    savedAt: ts, updatedAt: ts
  };

  await update(ref(db), updates);

  /* ── Auto-compute attendance % summary (async, non-blocking) ── */
  const studentIds = rows.map(r => norm(r.studentId)).filter(Boolean);
  if (studentIds.length > 0) {
    const summaryUpdates = {};
    await recomputeAttendanceSummary(
      schoolId, classId,
      norm(payload.subjectId) || "_class",
      studentIds,
      summaryUpdates
    );
    if (Object.keys(summaryUpdates).length > 0) {
      await update(ref(db), summaryUpdates);
    }
  }

  return { saved: rows.length };
}
