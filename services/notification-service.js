import { db } from "./firebase.js";
import { ref, get, set, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { listTimetableForClass } from "./timetable-service.js";

function norm(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export async function listTeacherAlerts(schoolId) {
  const snap = await get(ref(db, `schools/${schoolId}/teacherAlerts`));
  if (!snap.exists()) return [];
  return Object.entries(snap.val() || {}).map(([alertId, value]) => ({ alertId, ...(value || {}) }));
}

export async function listParentNotifications(schoolId) {
  const snap = await get(ref(db, `schools/${schoolId}/parentNotifications`));
  if (!snap.exists()) return [];
  const rows = [];
  for (const [studentId, notifications] of Object.entries(snap.val() || {})) {
    for (const [notificationId, value] of Object.entries(notifications || {})) {
      rows.push({ studentId, notificationId, ...(value || {}) });
    }
  }
  return rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function minutesFromTimeString(value = "") {
  if (!String(value).includes(":")) return null;
  const [hh, mm] = String(value).split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

export async function sweepTeacherLateAlerts(schoolId, dateStr, graceMinutes = 3) {
  const rows = await listTimetableForClass(schoolId, "");
  if (!rows.length) return { created: 0 };

  const date = new Date(`${dateStr}T00:00:00`);
  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayKey = dayKeys[date.getDay()] || "";
  const dayRows = rows.filter(row => String(row.dayKey || "") === dayKey);
  const now = new Date();
  const isToday = dateStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let created = 0;
  for (const row of dayRows) {
    const slotStart = minutesFromTimeString(row.startTime || "");
    if (slotStart === null) continue;
    if (isToday && nowMinutes < slotStart + graceMinutes) continue;

    const metaSnap = await get(ref(db, `schools/${schoolId}/attendanceMeta/${row.classId}/${dateStr}/${row.periodId}`));
    const meta = metaSnap.exists() ? (metaSnap.val() || {}) : null;
    if (meta?.saveStatus === 'submitted') continue;

    const alertId = `late_${dateStr}_${row.classId}_${row.periodId}_${row.teacherId}`;
    const alertPath = `schools/${schoolId}/teacherAlerts/${alertId}`;
    const existingSnap = await get(ref(db, alertPath));
    if (existingSnap.exists()) continue;

    await set(ref(db, alertPath), {
      alertId,
      type: 'teacher_late',
      teacherId: norm(row.teacherId),
      teacherName: norm(row.teacherName),
      classId: norm(row.classId),
      classLabel: norm(row.classLabel || row.classId),
      periodId: norm(row.periodId),
      subjectId: norm(row.subjectId),
      subjectName: norm(row.subjectName),
      date: norm(dateStr),
      status: 'open',
      createdAt: serverTimestamp()
    });
    created += 1;
  }

  return { created };
}

export async function markAlertStatus(schoolId, alertId, status) {
  await update(ref(db, `schools/${schoolId}/teacherAlerts/${alertId}`), {
    status: norm(status) || 'closed',
    updatedAt: serverTimestamp()
  });
}