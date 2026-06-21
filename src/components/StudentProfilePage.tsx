import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { Search, User, Mail, Phone, Users as UsersIcon, BookOpen, ClipboardCheck, TrendingUp, Sparkles, AlertTriangle, Award } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";
import { predict } from "@/lib/ai-predictions";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function StudentProfilePage() {
  const { schoolId } = useAuth();
  const { students } = useSchoolData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [marksData, setMarksData] = useState<any[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    const u1 = onValue(ref(db, `schools/${schoolId}/attendance`), (s) => setAttendanceData(s.val() ?? {}));
    const u2 = onValue(ref(db, `schools/${schoolId}/marks`), (s) => setMarksData(s.val() ? Object.values(s.val()) : []));
    return () => { u1(); u2(); };
  }, [schoolId]);

  const matches = useMemo(() => {
    if (!searchTerm.trim()) return students.slice(0, 8);
    const q = searchTerm.toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q) || String(s.rollNo).includes(q)).slice(0, 12);
  }, [searchTerm, students]);

  const student = useMemo(() => students.find((s) => s.id === selectedId), [students, selectedId]);

  /* ── compute attendance breakdown for the student ── */
  const attendance = useMemo(() => {
    if (!student || !attendanceData) return { present: 0, absent: 0, late: 0, total: 0, pct: 0, daily: [] as { date: string; present: number; total: number }[], subjectMap: [] as { subject: string; pct: number }[] };
    let present = 0, absent = 0, late = 0, total = 0;
    const daily = new Map<string, { p: number; t: number }>();
    const subj = new Map<string, { p: number; t: number }>();
    for (const date in attendanceData) {
      for (const cls in attendanceData[date]) {
        for (const period in attendanceData[date][cls]) {
          const rec = attendanceData[date][cls][period][student.id];
          if (!rec) continue;
          total++;
          if (rec.status === "present") present++;
          else if (rec.status === "absent") absent++;
          else if (rec.status === "late") late++;
          if (!daily.has(date)) daily.set(date, { p: 0, t: 0 });
          const dd = daily.get(date)!; dd.t++; if (rec.status === "present") dd.p++;
          const sname = rec.subject ?? "General";
          if (!subj.has(sname)) subj.set(sname, { p: 0, t: 0 });
          const ss = subj.get(sname)!; ss.t++; if (rec.status === "present") ss.p++;
        }
      }
    }
    const dailyArr = Array.from(daily.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
      .map(([date, v]) => ({ date: date.slice(5), present: v.p, total: v.t }));
    const subjectMap = Array.from(subj.entries()).map(([subject, v]) => ({ subject, pct: v.t ? Math.round((v.p / v.t) * 100) : 0 }));
    return { present, absent, late, total, pct: total ? Math.round((present / total) * 100) : 0, daily: dailyArr, subjectMap };
  }, [student, attendanceData]);

  const studentMarks = useMemo(() => {
    if (!student) return [] as any[];
    return marksData.filter((m: any) => m.studentId === student.id).sort((a: any, b: any) => (a.date ?? "").localeCompare(b.date ?? ""));
  }, [student, marksData]);

  const marksChart = useMemo(() => studentMarks.map((m: any) => ({ date: (m.date ?? "").slice(5), subject: m.subject, pct: Math.round((m.score / (m.maxScore || 1)) * 100) })), [studentMarks]);

  // ✅ FIXED: Build real attendance days array instead of fake Array.from
  const aiPred = useMemo(() => {
    if (!student) return null;
    const attDays: any[] = [];
    if (attendanceData) {
      for (const date in attendanceData) {
        for (const cls in attendanceData[date]) {
          for (const period in attendanceData[date][cls]) {
            const rec = attendanceData[date][cls][period][student.id];
            if (!rec) continue;
            attDays.push({ present: rec.status === "present", date, subject: rec.subject ?? "General" });
          }
        }
      }
    }
    return predict(attDays, studentMarks.map((m: any) => ({ pct: (m.score / (m.maxScore || 1)) * 100 })));
  }, [student, attendanceData, studentMarks]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><User className="w-6 h-6 text-primary-600" />Student Profile</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Search and explore individual student details</p>
      </motion.div>

      {/* search */}
      <div className={S.card}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name or roll no…" className={cn(S.input, "pl-12 text-base")} />
        </div>
        {searchTerm && matches.length > 0 && !selectedId && (
          <div className="mt-3 flex flex-wrap gap-2">
            {matches.map((s) => (
              <button key={s.id} onClick={() => { setSelectedId(s.id); setSearchTerm(""); }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-400 transition-colors text-sm">
                <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center text-[10px] font-bold">{s.rollNo}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{s.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{s.class}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!student && (
        <div className={cn(S.card, "text-center py-12 text-gray-400 dark:text-gray-500")}>
          <User className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Search and select a student to view their profile</p>
        </div>
      )}

      {student && (
        <>
          {/* profile header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={cn(S.card, "bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-primary-900/10 dark:via-gray-900 dark:to-accent-900/10")}>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 text-white flex items-center justify-center text-3xl font-bold shadow-lg shrink-0">{student.name.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{student.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{student.class}{student.section ? ` · Section ${student.section}` : ""} · Roll {student.rollNo}</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {student.email && <p className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><Mail className="w-3.5 h-3.5" />{student.email}</p>}
                  {student.phone && <p className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><Phone className="w-3.5 h-3.5" />{student.phone}</p>}
                  {student.parentName && <p className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><UsersIcon className="w-3.5 h-3.5" />{student.parentName}{student.parentPhone ? ` (${student.parentPhone})` : ""}</p>}
                </div>
              </div>
              <button onClick={() => setSelectedId(null)} className={cn(S.btnSecondary, "text-xs shrink-0")}>Search again</button>
            </div>
          </motion.div>

          {/* stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={cn(S.card, "bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/10 dark:to-gray-900")}>
              <ClipboardCheck className="w-5 h-5 text-primary-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{attendance.pct}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Attendance</p>
            </div>
            <div className={cn(S.card, "bg-gradient-to-br from-green-50 to-white dark:from-green-900/10 dark:to-gray-900")}>
              <Award className="w-5 h-5 text-green-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{attendance.present}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Present</p>
            </div>
            <div className={cn(S.card, "bg-gradient-to-br from-red-50 to-white dark:from-red-900/10 dark:to-gray-900")}>
              <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{attendance.absent}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Absent</p>
            </div>
            <div className={cn(S.card, "bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/10 dark:to-gray-900")}>
              <BookOpen className="w-5 h-5 text-purple-600 mb-2" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{studentMarks.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Marks Records</p>
            </div>
          </div>

          {/* AI prediction */}
          {aiPred && attendance.total > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className={cn(S.card, "bg-gradient-to-r from-primary-50 to-accent-50 border-primary-100/50 dark:from-primary-900/10 dark:to-accent-900/10 dark:border-primary-800/30")}>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary-600" />AI Prediction</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white/80 dark:bg-gray-800/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Attendance Forecast</p>
                  <p className={cn("text-xl font-bold", aiPred.attendance.risk === "low" ? "text-green-600" : aiPred.attendance.risk === "medium" ? "text-yellow-600" : "text-red-600")}>{aiPred.attendance.predicted}%</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 capitalize">Trend: {aiPred.attendance.trend} · Risk: {aiPred.attendance.risk}</p>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Expected Score</p>
                  <p className={cn("text-xl font-bold", aiPred.performance.expected >= 70 ? "text-green-600" : aiPred.performance.expected >= 50 ? "text-yellow-600" : "text-red-600")}>{aiPred.performance.expected}%</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Confidence: {aiPred.performance.confidence}%</p>
                </div>
                <div className="bg-white/80 dark:bg-gray-800/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Bunk Risk</p>
                  <p className={cn("text-xl font-bold", aiPred.bunkRisk.level === "green" ? "text-green-600" : aiPred.bunkRisk.level === "yellow" ? "text-yellow-600" : "text-red-600")}>{aiPred.bunkRisk.probability}%</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 capitalize">Level: {aiPred.bunkRisk.level}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {aiPred.tips.map((t, i) => <p key={i} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2"><span className="text-primary-600">•</span>{t}</p>)}
              </div>
            </motion.div>
          )}

          {/* charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={S.card}>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary-600" />Marks Progress</h3>
              {marksChart.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={marksChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }} />
                    <Line type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: "#6366f1" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">No marks recorded</div>}
            </div>

            <div className={S.card}>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent-600" />Subject-wise Attendance</h3>
              {attendance.subjectMap.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={attendance.subjectMap} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="subject" type="category" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }} />
                    <Bar dataKey="pct" fill="#ec4899" radius={[0, 8, 8, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">No attendance data</div>}
            </div>
          </div>

          {/* recent marks list */}
          {studentMarks.length > 0 && (
            <div className={cn(S.card, "p-0 overflow-hidden")}>
              <div className="p-4 border-b border-gray-100 dark:border-gray-800"><h3 className="font-semibold text-gray-900 dark:text-white">Recent Marks</h3></div>
              <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-72 overflow-y-auto">
                {studentMarks.slice().reverse().slice(0, 15).map((m: any, i: number) => {
                  const pct = Math.round((m.score / (m.maxScore || 1)) * 100);
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.subject}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{m.type} · {new Date(m.date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{m.score}/{m.maxScore}</p>
                        <p className={cn("text-xs font-medium", pct >= 80 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-600")}>{pct}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
