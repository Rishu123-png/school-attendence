import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ref, onValue, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { CheckCircle, Search, Users, CheckCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";
import toast from "react-hot-toast";

export default function AttendancePage() {
  const { profile, schoolId } = useAuth();
  const { students, subjects, classes } = useSchoolData();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedPeriod, setSelectedPeriod] = useState("P1");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const periods = ["P1","P2","P3","P4","P5","P6","P7","P8"];

  useEffect(() => { if (classes.length && !selectedClass) setSelectedClass(classes[0].name); }, [classes, selectedClass]);
  useEffect(() => { if (subjects.length && !selectedSubject) setSelectedSubject(subjects[0].name); }, [subjects, selectedSubject]);

  // load saved attendance
  useEffect(() => {
    if (!schoolId || !selectedClass || !selectedPeriod) return;
    const path = `schools/${schoolId}/attendance/${selectedDate}/${selectedClass}/${selectedPeriod}`;
    const unsub = onValue(ref(db, path), (snap) => {
      const d = snap.val();
      if (d) { const map: Record<string, string> = {}; Object.entries(d).forEach(([sid, v]: [string, any]) => { map[sid] = v.status; }); setAttendance(map); setSaved(true); }
      else { setAttendance({}); setSaved(false); }
    });
    return () => unsub();
  }, [schoolId, selectedDate, selectedClass, selectedPeriod]);

  const filtered = useMemo(() => students.filter((s) => {
    if (selectedClass && s.class !== selectedClass) return false;
    if (searchTerm) { const q = searchTerm.toLowerCase(); return s.name.toLowerCase().includes(q) || String(s.rollNo).includes(q); }
    return true;
  }), [students, selectedClass, searchTerm]);

  const mark = (sid: string, status: string) => setAttendance((p) => ({ ...p, [sid]: status }));

  const markAll = () => { const m: Record<string, string> = {}; filtered.forEach((s) => { m[s.id] = "present"; }); setAttendance(m); };

  const saveAttendance = async () => {
    if (!schoolId) return;
    setBusy(true);
    try {
      const base = `schools/${schoolId}/attendance/${selectedDate}/${selectedClass}/${selectedPeriod}`;
      for (const [sid, status] of Object.entries(attendance)) {
        await set(ref(db, `${base}/${sid}`), { status, subject: selectedSubject, markedBy: profile?.uid ?? "", timestamp: Date.now() });
      }
      // also write attendanceMeta
      await set(ref(db, `schools/${schoolId}/attendanceMeta/${selectedDate}/${selectedClass}/${selectedPeriod}`), { subject: selectedSubject, markedBy: profile?.uid ?? "", markedAt: Date.now(), count: Object.keys(attendance).length });
      toast.success("Attendance saved! ✅"); setSaved(true);
    } catch (e: any) { toast.error(e.message ?? "Failed to save"); }
    setBusy(false);
  };

  const presentCount = Object.values(attendance).filter((s) => s === "present").length;
  const absentCount  = Object.values(attendance).filter((s) => s === "absent").length;
  const lateCount    = Object.values(attendance).filter((s) => s === "late").length;

  const statusBtn = (sid: string, status: string, label: string) => {
    const active = attendance[sid] === status;
    const colors: Record<string, string> = { present: "text-green-600 bg-green-100 border-green-200", absent: "text-red-600 bg-red-100 border-red-200", late: "text-yellow-600 bg-yellow-100 border-yellow-200" };
    return (
      <button onClick={() => mark(sid, status)} className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all", active ? cn(colors[status], "shadow-sm") : "text-gray-400 border-gray-100 hover:border-gray-200")}>{label}</button>
    );
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">📋 Attendance</h1><p className="text-gray-500 text-sm">Mark and manage student attendance</p></div>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={cn(S.input, "py-2 w-auto")} />
      </motion.div>

      {/* mini stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", val: filtered.length, cls: "" },
          { label: "Present", val: presentCount, cls: "bg-green-50/50 border-green-100 text-green-700" },
          { label: "Absent", val: absentCount, cls: "bg-red-50/50 border-red-100 text-red-700" },
          { label: "Late", val: lateCount, cls: "bg-yellow-50/50 border-yellow-100 text-yellow-700" },
        ].map((c) => (
          <div key={c.label} className={cn(S.card, "py-3 px-4 text-center", c.cls)}><p className="text-xs opacity-70">{c.label}</p><p className="text-xl font-bold">{c.val}</p></div>
        ))}
      </div>

      {/* controls */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={S.card}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[130px]"><label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className={cn(S.input, "py-2")}>
              {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
            <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className={cn(S.input, "py-2")}>
              {periods.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[130px]"><label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className={cn(S.input, "py-2")}>
              {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="relative flex-1 min-w-[140px]"><label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <Search className="absolute left-3 bottom-2.5 w-4 h-4 text-gray-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Name / Roll…" className={cn(S.input, "py-2 pl-9")} />
          </div>
          <button onClick={markAll} className={cn(S.btnSecondary, "text-xs py-2")}><CheckCheck className="w-4 h-4" />All Present</button>
          <button onClick={saveAttendance} disabled={busy || !Object.keys(attendance).length} className={cn(S.btnPrimary, "text-xs py-2")}>{saved ? "✅ Saved" : busy ? "Saving…" : "Save"}</button>
        </div>
      </motion.div>

      {/* student list */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-primary-600" />Students ({filtered.length})</h3>
          {saved && <span className={cn(S.badgeGreen, "text-xs")}><CheckCircle className="w-3 h-3" />Submitted</span>}
        </div>
        <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
          {filtered.length ? filtered.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.015 }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700 text-xs font-bold">{s.rollNo}</div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{s.name}</p><p className="text-xs text-gray-400">{s.class}{s.section ? ` · ${s.section}` : ""}</p></div>
              <div className="flex items-center gap-1.5">
                {statusBtn(s.id, "present", "✓")}
                {statusBtn(s.id, "absent", "✗")}
                {statusBtn(s.id, "late", "⏰")}
              </div>
            </motion.div>
          )) : (
            <div className="text-center py-12 text-gray-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-50" /><p className="text-sm">No students found</p></div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
