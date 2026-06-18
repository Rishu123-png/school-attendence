/* ============================================================
   EXPORT SERVICE — NEW
   CSV generation + print helper for attendance, marks, reports
   ============================================================ */

export function generateCSV(headers, rows) {
  const escape = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const lines  = [headers.map(escape).join(",")];
  rows.forEach(row => lines.push(row.map(escape).join(",")));
  return lines.join("\n");
}

export function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportAttendanceCSV(records, classLabel, dateRange) {
  const headers = ["Date", "Period", "Student", "Roll No", "Status", "Subject", "Teacher"];
  const rows = records.map(r => [
    r.date, r.periodId, r.studentName || r.studentId,
    r.rollNo || "—", r.status, r.subjectName || "—", r.teacherName || "—"
  ]);
  const csv = generateCSV(headers, rows);
  downloadCSV(csv, `attendance_${classLabel}_${dateRange}.csv`);
}

export function exportStudentReportCSV(students, classLabel) {
  const headers = ["Rank", "Name", "Roll No", "Section", "Attendance %", "Avg Marks %", "Score", "At Risk"];
  const rows = students.map((s, i) => [
    i + 1, s.name, s.rollNo, s.section,
    s.attPct != null ? `${s.attPct}%` : "—",
    s.avgMarks != null ? `${s.avgMarks}%` : "—",
    s.score,
    s.atRisk ? "YES" : "No"
  ]);
  downloadCSV(generateCSV(headers, rows), `leaderboard_${classLabel}.csv`);
}

export function triggerPrint() {
  window.print();
}
