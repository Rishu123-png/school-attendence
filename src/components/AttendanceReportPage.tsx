import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { Printer, Download, FileSpreadsheet, CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";

interface Row { id: string; rollNo: number; name: string; present: number; absent: number; late: number; total: number; pct: number }

export default function AttendanceReportPage() {
  const { schoolId } = useAuth();
  const { classes, students } = useSchoolData();
  const [selectedClass, setSelectedClass] = useState("");
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; });
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [rawData, setRawData] = useState<any>(null);

  useEffect(() => { if (classes.length && !selectedClass) setSelectedClass(classes[0].name); }, [classes, selectedClass]);

  useEffect(() => {
    if (!schoolId) return;
    const unsub = onValue(ref(db, `schools/${schoolId}/attendance`), (snap) => setRawData(snap.val() ?? {}));
    return () => unsub();
  }, [schoolId]);

  const rows: Row[] = useMemo(() => {
    if (!rawData || !selectedClass) return [];
    const map = new Map<string, { p: number; a: number; l: number; t: number }>();
    // attendance/$date/$class/$period/$studentId
    for (const date in rawData) {
      if (date < fromDate || date > toDate) continue;
      const dayData = rawData[date];
      const cls = dayData?.[selectedClass];
      if (!cls) continue;
      for (const period in cls) {
        const periodData = cls[period];
        for (const sid in periodData) {
          const status = periodData[sid]?.status;
          if (!status) continue;
          if (!map.has(sid)) map.set(sid, { p: 0, a: 0, l: 0, t: 0 });
          const m = map.get(sid)!;
          m.t++;
          if (status === "present") m.p++;
          else if (status === "absent") m.a++;
          else if (status === "late") m.l++;
        }
      }
    }
    return students.filter((s) => s.class === selectedClass).map((s) => {
      const m = map.get(s.id) ?? { p: 0, a: 0, l: 0, t: 0 };
      return { id: s.id, rollNo: s.rollNo, name: s.name, present: m.p, absent: m.a, late: m.l, total: m.t, pct: m.t ? Math.round((m.p / m.t) * 100) : 0 };
    });
  }, [rawData, selectedClass, fromDate, toDate, students]);

  const classAvg = rows.length ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 0;
  const totalPeriods = rows.reduce((s, r) => s + r.total, 0);

  const exportCSV = () => {
    const header = "Roll No,Name,Present,Absent,Late,Total Periods,Attendance %\n";
    const body = rows.map((r) => `${r.rollNo},"${r.name}",${r.present},${r.absent},${r.late},${r.total},${r.pct}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance-${selectedClass}-${fromDate}-to-${toDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-20 lg:pb-0 print:max-w-none">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div><h1 className="text-2xl font-bold text-gray-900">🖨️ Attendance Report</h1><p className="text-gray-500 text-sm">Detailed reports — export & print</p></div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className={S.btnSecondary}><Download className="w-4 h-4" />Export CSV</button>
          <button onClick={() => window.print()} className={S.btnPrimary}><Printer className="w-4 h-4" />Print</button>
        </div>
      </motion.div>

      {/* filters */}
      <div className={cn(S.card, "print:hidden")}>
        <h3 className="font-semibold text-gray-900 mb-3">🔎 Report Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className="block text-xs text-gray-500 mb-1">Class *</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className={cn(S.input, "py-2")}>
              {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={cn(S.input, "py-2")} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={cn(S.input, "py-2")} /></div>
        </div>
      </div>

      {/* summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className={cn(S.card, "py-3 text-center")}><p className="text-xs text-gray-500">Students</p><p className="text-xl font-bold text-gray-900">{rows.length}</p></div>
        <div className={cn(S.card, "py-3 text-center")}><p className="text-xs text-gray-500">Total Periods</p><p className="text-xl font-bold text-gray-900">{totalPeriods}</p></div>
        <div className={cn(S.card, "py-3 text-center bg-gradient-to-br from-primary-50 to-white")}>
          <p className="text-xs text-gray-500">Class Avg</p>
          <p className={cn("text-xl font-bold", classAvg >= 80 ? "text-green-600" : classAvg >= 60 ? "text-yellow-600" : "text-red-600")}>{classAvg}%</p>
        </div>
      </div>

      {/* print header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">Attendance Report — {selectedClass}</h1>
        <p className="text-sm text-gray-600">From {fromDate} to {toDate}</p>
      </div>

      {/* table */}
      <div className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between print:hidden">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-primary-600" />Student Attendance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Roll</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Name</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-green-700">Present</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-red-700">Absent</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-yellow-700">Late</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Total</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">%</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length ? rows.sort((a, b) => a.rollNo - b.rollNo).map((r, i) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-sm font-medium text-gray-700">{r.rollNo}</td>
                  <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{r.name}</td>
                  <td className="px-3 py-2.5 text-center text-sm font-semibold text-green-600">{r.present}</td>
                  <td className="px-3 py-2.5 text-center text-sm font-semibold text-red-600">{r.absent}</td>
                  <td className="px-3 py-2.5 text-center text-sm font-semibold text-yellow-600">{r.late}</td>
                  <td className="px-3 py-2.5 text-center text-sm text-gray-700">{r.total}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("text-sm font-bold px-2 py-0.5 rounded-full",
                      r.pct >= 80 ? "bg-green-100 text-green-700" : r.pct >= 60 ? "bg-yellow-100 text-yellow-700" : r.total > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-400")}>
                      {r.total > 0 ? `${r.pct}%` : "—"}
                    </span>
                  </td>
                </motion.tr>
              )) : <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm"><CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-40" />No data for the selected range</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
