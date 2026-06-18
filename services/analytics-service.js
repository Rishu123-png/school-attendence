* ============================================================
   ANALYTICS SERVICE — NEW
   Powers the analytics dashboard, daily reports, leaderboard
   All computed from existing Firebase data
   ============================================================ */

import { db } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { listStudents } from "./student-service.js";
import { listClasses } from "./class-service.js";
import { listTeachers } from "./teacher-service.js";
import { listSubjects } from "./subject-service.js";

/* ─── Daily Report ───────────────────────────────────────────── */
export async function getDailyReport(schoolId, date) {
  const [classes, teachers, metaSnap] = await Promise.all([
    listClasses(schoolId),
    listTeachers(schoolId),
    get(ref(db, `schools/${schoolId}/attendanceMeta`))
  ]);

  const meta = metaSnap.exists() ? (metaSnap.val() || {}) : {};
  const teacherMap = new Map(teachers.map(t => [t.teacherId, t]));

  const classReports = [];
  for (const cls of classes) {
    const classId = cls.classId;
    const classMeta = (meta[classId] || {})[date] || {};
    const periods = Object.values(classMeta);
    const submitted = periods.filter(p => p.saveStatus === "submitted");
    const missing   = periods.filter(p => p.saveStatus !== "submitted");

    /* Count students for the class from attendance records */
    const attSnap = await get(ref(db, `schools/${schoolId}/attendance/${classId}/${date}`));
    let totalStudents = 0, presentStudents = 0;
    if (attSnap.exists()) {
      for (const [, students] of Object.entries(attSnap.val() || {})) {
        for (const [, rec] of Object.entries(students || {})) {
          totalStudents++;
          if (rec.status === "present" || rec.status === "late") presentStudents++;
        }
      }
    }

    classReports.push({
      classId,
      className:     cls.displayName || cls.classId,
      periodsTotal:  periods.length,
      periodsSubmitted: submitted.length,
      periodsMissing:   missing.length,
      totalStudents,
      presentStudents,
      attendancePct: totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : null,
      missingTeachers: missing.map(p => teacherMap.get(p.teacherId)?.name || p.teacherId).filter(Boolean)
    });
  }

  const schoolPresent = classReports.reduce((a, c) => a + c.presentStudents, 0);
  const schoolTotal   = classReports.reduce((a, c) => a + c.totalStudents, 0);

  return {
    date,
    schoolAttendancePct: schoolTotal > 0 ? Math.round((schoolPresent / schoolTotal) * 100) : null,
    totalClasses:       classes.length,
    classReports
  };
}

/* ─── Attendance Trend (last N days) ─────────────────────────── */
export async function getAttendanceTrend(schoolId, days = 14) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
  }

  const result = [];
  for (const date of dates) {
    const attSnap = await get(ref(db, `schools/${schoolId}/attendance`));
    let present = 0, total = 0;
    if (attSnap.exists()) {
      for (const [, classDates] of Object.entries(attSnap.val() || {})) {
        const dayData = classDates[date];
        if (!dayData) continue;
        for (const [, students] of Object.entries(dayData || {})) {
          for (const [, rec] of Object.entries(students || {})) {
            total++;
            if (rec.status === "present" || rec.status === "late") present++;
          }
        }
      }
    }
    result.push({ date, pct: total > 0 ? Math.round((present / total) * 100) : null, present, total });
  }
  return result;
}

/* ─── Subject-wise Attendance Summary ────────────────────────── */
export async function getSubjectAttendanceSummary(schoolId) {
  const [subjects, summarySnap] = await Promise.all([
    listSubjects(schoolId),
    get(ref(db, `schools/${schoolId}/attendanceSummary`))
  ]);
  const subjectMap = new Map(subjects.map(s => [s.subjectId, s]));
  const subjectStats = new Map();

  if (summarySnap.exists()) {
    for (const [, subjectSummaries] of Object.entries(summarySnap.val() || {})) {
      for (const [subjectId, summary] of Object.entries(subjectSummaries || {})) {
        if (subjectId === "_class") continue;
        if (!subjectStats.has(subjectId)) {
          subjectStats.set(subjectId, { subjectId, name: subjectMap.get(subjectId)?.name || subjectId, totalPct: 0, count: 0, atRiskCount: 0 });
        }
        const s = subjectStats.get(subjectId);
        s.totalPct += (summary.pct || 0);
        s.count++;
        if (summary.atRisk) s.atRiskCount++;
      }
    }
  }

  return Array.from(subjectStats.values()).map(s => ({
    ...s,
    avgPct: s.count > 0 ? Math.round(s.totalPct / s.count) : 0
  })).sort((a, b) => a.avgPct - b.avgPct);
}

/* ─── Class Leaderboard ─────────────────────────────────────── */
export async function getClassLeaderboard(schoolId, classId) {
  const [students, summarySnap, marksSnap] = await Promise.all([
    listStudents(schoolId),
    get(ref(db, `schools/${schoolId}/attendanceSummary`)),
    get(ref(db, `schools/${schoolId}/marks`))
  ]);

  const classStudents = students.filter(s => s.classId === classId);
  const summaryData   = summarySnap.exists()  ? (summarySnap.val()  || {}) : {};
  const marksData     = marksSnap.exists()    ? (marksSnap.val()    || {}) : {};

  return classStudents.map(student => {
    const sid = student.studentId;
    /* Average attendance across all subjects */
    const subjectSummaries = Object.values(summaryData[sid] || {});
    const attPct = subjectSummaries.length > 0
      ? Math.round(subjectSummaries.reduce((a, s) => a + (s.pct || 0), 0) / subjectSummaries.length)
      : null;

    /* Average predicted marks across all subjects */
    const studentMarks = Object.values(marksData[sid] || {});
    const avgMarks = studentMarks.length > 0
      ? Math.round(studentMarks.reduce((a, m) => {
          const e = m.exams || {};
          const pcts = [
            e.ut1?.maxScore > 0 ? (e.ut1.score / e.ut1.maxScore) * 100 : 0,
            e.halfYearly?.maxScore > 0 ? (e.halfYearly.score / e.halfYearly.maxScore) * 100 : 0,
            e.ut2?.maxScore > 0 ? (e.ut2.score / e.ut2.maxScore) * 100 : 0,
            e.annual?.maxScore > 0 ? (e.annual.score / e.annual.maxScore) * 100 : 0
          ].filter(v => v > 0);
          return a + (pcts.length > 0 ? pcts.reduce((x, y) => x + y, 0) / pcts.length : 0);
        }, 0) / studentMarks.length)
      : null;

    const score = (attPct !== null ? attPct * 0.4 : 0) + (avgMarks !== null ? avgMarks * 0.6 : 0);

    return {
      studentId: sid,
      name:      student.fullName || sid,
      rollNo:    student.rollNo || "—",
      section:   student.section || "—",
      attPct,
      avgMarks,
      score:     Math.round(score),
      atRisk:    attPct !== null && attPct < 75
    };
  }).sort((a, b) => b.score - a.score);
}

/* ─── Teacher Performance Summary ───────────────────────────── */
export async function getTeacherPerformance(schoolId, date) {
  const [teachers, metaSnap] = await Promise.all([
    listTeachers(schoolId),
    get(ref(db, `schools/${schoolId}/attendanceMeta`))
  ]);

  const meta = metaSnap.exists() ? (metaSnap.val() || {}) : {};
  const teacherStats = new Map(teachers.map(t => [t.teacherId, {
    teacherId: t.teacherId, name: t.name, subject: t.subject,
    periodsSubmitted: 0, periodsMissing: 0
  }]));

  for (const [, classDates] of Object.entries(meta)) {
    const dayData = classDates[date];
    if (!dayData) continue;
    for (const [, periodMeta] of Object.entries(dayData || {})) {
      const tid = periodMeta?.teacherId;
      if (!tid) continue;
      if (!teacherStats.has(tid)) {
        teacherStats.set(tid, { teacherId: tid, name: tid, periodsSubmitted: 0, periodsMissing: 0 });
      }
      const s = teacherStats.get(tid);
      if (periodMeta.saveStatus === "submitted") s.periodsSubmitted++;
      else s.periodsMissing++;
    }
  }
  return Array.from(teacherStats.values()).filter(t => t.periodsSubmitted > 0 || t.periodsMissing > 0);
}
