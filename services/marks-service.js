import { db } from "./firebase.js";
import { ref, get, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { listTeachers } from "./teacher-service.js";
import { listAssignments } from "./assignment-service.js";
import { listClasses } from "./class-service.js";
import { listSubjects } from "./subject-service.js";
import { listStudents } from "./student-service.js";

function norm(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeSelected(values) {
  const list = Array.isArray(values) ? values : String(values || '').split(',');
  return Array.from(new Set(list.map(item => norm(item)).filter(Boolean)));
}

export async function resolveTeacherMarkContext(schoolId, authUid) {
  const [teachers, assignments, classes, subjects] = await Promise.all([
    listTeachers(schoolId),
    listAssignments(schoolId),
    listClasses(schoolId),
    listSubjects(schoolId)
  ]);

  const teacher = teachers.find(row => String(row.authUid || "") === String(authUid || "")) || null;
  if (!teacher) {
    return { teacher: null, scopes: [] };
  }

  const classMap = new Map(classes.map(item => [item.classId, item]));
  const subjectMap = new Map(subjects.map(item => [item.subjectId, item]));

  const scopes = assignments
    .filter(item => String(item.teacherId || "") === String(teacher.teacherId || ""))
    .map(item => ({
      assignmentId: item.assignmentId,
      teacherId: teacher.teacherId,
      classId: item.classId,
      classLabel: classMap.get(item.classId)?.displayName || item.classId,
      subjectId: item.subjectId,
      subjectLabel: subjectMap.get(item.subjectId)?.name || item.subjectId
    }));

  return { teacher, scopes };
}

export async function listStudentsForMarkScope(schoolId, classId, subjectId) {
  const students = await listStudents(schoolId);
  return students.filter(student => {
    if (String(student.classId || "") !== String(classId || "")) return false;
    return normalizeSelected(student.selectedSubjectIds || []).includes(String(subjectId || ""));
  }).sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));
}

export async function getStudentSubjectMarks(schoolId, studentId, subjectId) {
  const snap = await get(ref(db, `schools/${schoolId}/marks/${studentId}/${subjectId}`));
  return snap.exists() ? (snap.val() || {}) : {};
}

export async function saveStudentSubjectMarks(schoolId, payload) {
  const studentId = norm(payload.studentId);
  const subjectId = norm(payload.subjectId);
  if (!schoolId || !studentId || !subjectId) {
    throw new Error("schoolId, studentId and subjectId are required");
  }

  const marks = {
    exams: {
      ut1: {
        score: Number(payload.ut1Score || 0),
        maxScore: Number(payload.ut1Max || 25)
      },
      halfYearly: {
        score: Number(payload.hyScore || 0),
        maxScore: Number(payload.hyMax || 100)
      },
      ut2: {
        score: Number(payload.ut2Score || 0),
        maxScore: Number(payload.ut2Max || 25)
      },
      annual: {
        score: Number(payload.annualScore || 0),
        maxScore: Number(payload.annualMax || 100)
      }
    },
    teacherId: norm(payload.teacherId),
    teacherName: norm(payload.teacherName),
    subjectId,
    subjectName: norm(payload.subjectName),
    updatedAt: serverTimestamp()
  };

  await set(ref(db, `schools/${schoolId}/marks/${studentId}/${subjectId}`), marks);
  return marks;
}

export function buildPredictionSummary({ ut1Score, ut1Max, hyScore, hyMax, ut2Score, ut2Max, annualScore, annualMax, attendancePct }) {
  const toPct = (score, max) => max > 0 ? (score / max) : null;
  const ut1Pct = toPct(Number(ut1Score || 0), Number(ut1Max || 25));
  const hyPct = toPct(Number(hyScore || 0), Number(hyMax || 100));
  const ut2Pct = toPct(Number(ut2Score || 0), Number(ut2Max || 25));
  const annualPct = toPct(Number(annualScore || 0), Number(annualMax || 100));

  const predictedAnnualPct = Math.min(1, Math.max(0,
    (ut1Pct * 0.15) +
    (hyPct * 0.35) +
    (ut2Pct * 0.2) +
    ((attendancePct / 100) * 0.1) +
    (annualPct * 0.2)
  ));

  const predictedScore = Math.round(predictedAnnualPct * Number(annualMax || 100));
  const grade = predictedAnnualPct >= 0.9 ? 'A+' : predictedAnnualPct >= 0.75 ? 'A' : predictedAnnualPct >= 0.6 ? 'B' : predictedAnnualPct >= 0.4 ? 'C' : 'D';

  return {
    predictedAnnualPct: Math.round(predictedAnnualPct * 100),
    predictedScore,
    grade
  };
}