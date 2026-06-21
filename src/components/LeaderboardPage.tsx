import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { Trophy, Medal, Award, TrendingUp, Crown } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";

interface Rank { id: string; rollNo: number; name: string; section?: string; attPct: number; marksPct: number; score: number; status: string }

export default function LeaderboardPage() {
  const { schoolId } = useAuth();
  const { classes, students } = useSchoolData();
  const [selectedClass, setSelectedClass] = useState("");
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [marksData, setMarksData] = useState<any[]>([]);

  useEffect(() => { if (classes.length && !selectedClass) setSelectedClass(classes[0].name); }, [classes, selectedClass]);

  useEffect(() => {
    if (!schoolId) return;
    const u1 = onValue(ref(db, `schools/${schoolId}/attendance`), (s) => setAttendanceData(s.val() ?? {}));
    const u2 = onValue(ref(db, `schools/${schoolId}/marks`), (s) => setMarksData(s.val() ? Object.values(s.val()) : []));
    return () => { u1(); u2(); };
  }, [schoolId]);

  const rankings: Rank[] = useMemo(() => {
    if (!attendanceData || !selectedClass) return [];
    // attendance per student
    const att = new Map<string, { p: number; t: number }>();
    for (const date in attendanceData) {
      const cls = attendanceData[date]?.[selectedClass];
      if (!cls) continue;
      for (const period in cls) {
        for (const sid in cls[period]) {
          if (!att.has(sid)) att.set(sid, { p: 0, t: 0 });
          const m = att.get(sid)!; m.t++;
          if (cls[period][sid]?.status === "present") m.p++;
        }
      }
    }
    // marks per student
    const marks = new Map<string, number[]>();
    marksData.forEach((m: any) => {
      if (!marks.has(m.studentId)) marks.set(m.studentId, []);
      marks.get(m.studentId)!.push((m.score / (m.maxScore || 1)) * 100);
    });

    return students.filter((s) => s.class === selectedClass).map((s) => {
      const a = att.get(s.id) ?? { p: 0, t: 0 };
      const ms = marks.get(s.id) ?? [];
      const attPct = a.t ? Math.round((a.p / a.t) * 100) : 0;
      const marksPct = ms.length ? Math.round(ms.reduce((x, y) => x + y, 0) / ms.length) : 0;
      const score = Math.round(attPct * 0.4 + marksPct * 0.6); // weighted: marks 60%, attendance 40%
      const status = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Average" : score > 0 ? "Needs Help" : "No Data";
      return { id: s.id, rollNo: s.rollNo, name: s.name, section: s.section, attPct, marksPct, score, status };
    }).sort((a, b) => b.score - a.score);
  }, [attendanceData, marksData, selectedClass, students]);

  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  const podiumColor = (idx: number) => ["from-yellow-400 to-amber-500", "from-gray-300 to-gray-400", "from-orange-400 to-orange-500"][idx];
  const medalIcon = (idx: number) => [<Crown key="0" className="w-5 h-5" />, <Medal key="1" className="w-5 h-5" />, <Award key="2" className="w-5 h-5" />][idx];

  const statusColor = (s: string) => s === "Excellent" ? S.badgeGreen : s === "Good" ? S.badgeBlue : s === "Average" ? S.badgeYellow : s === "No Data" ? "bg-gray-100 text-gray-500 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" : S.badgeRed;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Trophy className="w-6 h-6 text-yellow-500" />Class Leaderboard</h1><p className="text-gray-500 text-sm">Ranked by attendance (40%) + marks (60%)</p></div>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className={cn(S.input, "py-2 w-auto")}>
          {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </motion.div>

      {/* podium */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[1, 0, 2].map((podiumIdx) => {
            const r = top3[podiumIdx]; if (!r) return <div key={podiumIdx} />;
            const heights = ["pt-8", "pt-2", "pt-12"]; // center is shortest visually for top1
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * podiumIdx }} className={cn("text-center", podiumIdx === 0 && "order-2", podiumIdx === 1 && "order-1", podiumIdx === 2 && "order-3")}>
                <div className={cn("inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br text-white shadow-lg mb-2", podiumColor(podiumIdx))}>
                  {medalIcon(podiumIdx)}
                </div>
                <div className={cn(S.card, "py-4", heights[podiumIdx])}>
                  <p className="text-2xl font-bold text-gray-900">#{podiumIdx + 1}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1 truncate">{r.name}</p>
                  <p className="text-xs text-gray-500">Roll {r.rollNo}</p>
                  <p className="text-lg font-bold text-primary-600 mt-2">{r.score}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* full rankings */}
      <div className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary-600" />Full Rankings</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Rank</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Student</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Roll</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Att %</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Marks %</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Score</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {rest.length ? rest.map((r, i) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }} className="hover:bg-gray-50">
                  <td className="px-3 py-3 text-sm font-semibold text-gray-500">#{i + 4}</td>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900">{r.name}</td>
                  <td className="px-3 py-3 text-center text-sm text-gray-600">{r.rollNo}</td>
                  <td className="px-3 py-3 text-center text-sm font-medium text-gray-700">{r.attPct}%</td>
                  <td className="px-3 py-3 text-center text-sm font-medium text-gray-700">{r.marksPct}%</td>
                  <td className="px-3 py-3 text-center"><span className={cn("text-sm font-bold", r.score >= 70 ? "text-green-600" : r.score >= 50 ? "text-yellow-600" : "text-red-600")}>{r.score}</span></td>
                  <td className="px-3 py-3 text-center"><span className={cn(statusColor(r.status), "text-[10px]")}>{r.status}</span></td>
                </motion.tr>
              )) : top3.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm"><Trophy className="w-10 h-10 mx-auto mb-2 opacity-40" />Select a class with data to see rankings</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
