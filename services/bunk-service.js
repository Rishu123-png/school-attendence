import { db } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

export async function listBunkEvents(schoolId) {
  const snap = await get(ref(db, `schools/${schoolId}/bunkEvents`));
  if (!snap.exists()) return [];

  const rows = [];
  for (const [studentId, events] of Object.entries(snap.val() || {})) {
    for (const [eventId, value] of Object.entries(events || {})) {
      rows.push({ studentId, eventId, ...(value || {}) });
    }
  }

  return rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.periodId || "").localeCompare(String(a.periodId || "")));
}

export function summarizeBunkEvents(events = [], classMap = new Map(), subjectMap = new Map(), studentMap = new Map()) {
  const grouped = new Map();

  events.forEach(event => {
    const key = `${event.studentId}__${event.subjectId || ''}__${event.classId || ''}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        studentId: event.studentId,
        studentName: event.studentName || studentMap.get(event.studentId)?.fullName || 'Unknown',
        classId: event.classId || '',
        classLabel: classMap.get(event.classId)?.displayName || event.classId || '—',
        section: studentMap.get(event.studentId)?.section || event.section || '',
        subjectId: event.subjectId || '',
        subjectLabel: event.subjectName || subjectMap.get(event.subjectId)?.name || event.subjectId || '—',
        teacherName: event.teacherName || '—',
        bunkCount: 0,
        lastDate: '',
        lastPeriod: ''
      });
    }

    const row = grouped.get(key);
    row.bunkCount += 1;
    if (String(event.date || '') >= String(row.lastDate || '')) {
      row.lastDate = event.date || row.lastDate;
      row.lastPeriod = event.periodId || row.lastPeriod;
      row.teacherName = event.teacherName || row.teacherName;
    }
  });

  return Array.from(grouped.values()).sort((a, b) => b.bunkCount - a.bunkCount || String(b.lastDate || '').localeCompare(String(a.lastDate || '')));
}