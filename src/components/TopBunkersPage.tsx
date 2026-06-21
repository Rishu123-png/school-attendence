
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { AlertTriangle, Eye } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";

interface BunkRow { id: string; name: string; rollNo: number; class: string; section?: string; subject: string; count: number; lastDate: string; lastPeriod: string }

export default function TopBunkersPage() {
  const { schoolId } = useAuth();
  const { classes, subjects, students } = useSchoolData();
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [filterClass, setFilterClass] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  useEffect(() => {
    if (!schoolId) return;
    const unsub = onValue(ref(db, `schools/${schoolId}/attendance`), (s) => setAttendanceData(s.val() ?? {}));
    return () => unsub();
  }, [schoolId]);

  const bunks: BunkRow[] = useMemo(() => {
    if (!attendanceData) return [];
    const map = new Map<string, { count: number; lastDate: string; lastPeriod: string; subject: string }>();
    for (const date in attendanceData) {
      for (const cls in attendanceData[date]) {
        for (const period in attendanceData[date][cls]) {
          for (const sid in attendanceData[date][cls][period]) {
            const rec = attendanceData[date][cls][period][sid];
            if (rec?.status !== "absent") continue;
            const subj = rec.subject ?? "General";
            const key = `${sid}__${subj}`;
            if (!map.has(key)) map.set(key, { count: 0, lastDate: date, lastPeriod: period, subject: subj });
            const m = map.get(key)!;
            m.count++;
            if (date > m.lastDate) { m.lastDate = date; m.lastPeriod = period; }
          }
        }
      }
    }
    const rows: BunkRow[] = [];
    map.forEach((v, k) => {
      const sid = k.split("__")[0];
      const stu = students.find((s) => s.id === sid);
      if (!stu) return;
      if (filterClass && stu.class !== filterClass) return;
      if (filterSection && stu.section !== filterSection) return;
      if (filterSubject && v.subject !== filterSubject) return;
      rows.push({ id: k, name: stu.name, rollNo: stu.rollNo, class: stu.class, section: stu.section, subject: v.subject, count: v.count, lastDate: v.lastDate, lastPeriod: v.lastPeriod });
    });
    return rows.sort((a, b) => b.count - a.count);
  }, [attendanceData, students, filterClass, filterSection, filterSubject]);

  const totalBunks = bunks.reduce((s, r) => s + r.count, 0);
  const uniqueStudents = new Set(bunks.map((b) => `${b.name}-${b.rollNo}`)).size;
  const topBunkers = bunks.filter((b) => b.count >= 3).length;

  const sections = Array.from(new Set(students.map((s) => s.section).filter(Boolean))) as string[];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">🕵️ Top Bunkers</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Class-wise & subject-wise bunk summary</p>
      </motion.div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className={cn(S.card, "py-3 text-center bg-gradient-to-br from-red-50 to-white dark:from-red-900/10 dark:to-gray-900")}><p className="text-xs text-red-600 dark:text-red-400">Total Bunk Events</p><p className="text-2xl font-bold text-red-700 dark:text-red-400">{totalBunks}</p></div>
        <div className={cn(S.card, "py-3 text-center bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/10 dark:to-gray-900")}><p className="text-xs text-orange-600 dark:text-orange-400">Unique Students</p><p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{uniqueStudents}</p></div>
        <div className={cn(S.card, "py-3 text-center bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-900/10 dark:to-gray-900")}><p className="text-xs text-yellow-600 dark:text-yellow-400">Repeat Offenders (≥3)</p><p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{topBunkers}</p></div>
      </div>

      {/* filters */}
      <div className={S.card}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">🔎 Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className={cn(S.input, "py-2")}>
            <option value="">All Classes</option>{classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className={cn(S.input, "py-2")}>
            <option value="">All Sections</option>{sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className={cn(S.input, "py-2")}>
            <option value="">All Subjects</option>{subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* table */}
      <div className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />Repeated Subject Bunks</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Sorted by bunk count — highest first</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50 dark:bg-gray-800">
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">#</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Student</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Class</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Subject</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400">Bunks</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Last Date</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Last Period</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {bunks.length ? bunks.map((b, i) => (
                <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">{i + 1}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/20 dark:to-red-900/10 text-red-700 dark:text-red-400 flex items-center justify-center text-xs font-bold">{b.rollNo}</div><span className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.name}</span></div></td>
                  <td className="px-3 py-3 text-center text-xs text-gray-600 dark:text-gray-300">{b.class}{b.section ? ` · ${b.section}` : ""}</td>
                  <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{b.subject}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn("text-sm font-bold px-2.5 py-0.5 rounded-full", b.count >= 5 ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : b.count >= 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400")}>{b.count}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400">{new Date(b.lastDate).toLocaleDateString()}</td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400">{b.lastPeriod}</td>
                </motion.tr>
              )) : <tr><td colSpan={7} className="text-center py-12 text-gray-400 dark:text-gray-500"><Eye className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">🎉 No bunk events found!</p><p className="text-xs mt-1">All students attending or no absences recorded</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
