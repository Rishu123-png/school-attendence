import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { ref, onValue, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { CheckCircle, Search, Users, CheckCheck, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";
import toast from "react-hot-toast";

export default function AttendancePage() {
  const { profile, schoolId } = useAuth();
  const { students, subjects, classes, loading } = useSchoolData();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedPeriod, setSelectedPeriod] = useState("P1");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Touch gesture state
  const touchStartRef = useRef<Record<string, number>>({});

  const periods = ["P1","P2","P3","P4","P5","P6","P7","P8"];

  useEffect(() => { if (classes.length && !selectedClass) setSelectedClass(classes[0].name); }, [classes, selectedClass]);
  useEffect(() => { if (subjects.length && !selectedSubject) setSelectedSubject(subjects[0].name); }, [subjects, selectedSubject]);

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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClass, searchTerm]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const mark = (sid: string, status: string) => { setSaved(false); setAttendance((p) => ({ ...p, [sid]: status })); };

  const markAll = () => { const m: Record<string, string> = {}; filtered.forEach((s) => { m[s.id] = "present"; }); setAttendance(m); setSaved(false); };

  const saveAttendance = async () => {
    if (!schoolId) return;
    if (!selectedSubject || !selectedClass) { toast.error("Select class & subject"); return; }
    if (!Object.keys(attendance).length) { toast.error("Mark at least one student"); return; }
    setBusy(true);
    try {
      const base = `schools/${schoolId}/attendance/${selectedDate}/${selectedClass}/${selectedPeriod}`;
      const updates: Record<string, any> = {};
      for (const [sid, status] of Object.entries(attendance)) {
        updates[`${base}/${sid}`] = { status, subject: selectedSubject, markedBy: profile?.uid ?? "", timestamp: Date.now() };
      }
      updates[`schools/${schoolId}/attendanceMeta/${selectedDate}/${selectedClass}/${selectedPeriod}`] = { subject: selectedSubject, markedBy: profile?.uid ?? "", markedAt: Date.now(), count: Object.keys(attendance).length };
      await update(ref(db), updates);
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
      <button onClick={() => mark(sid, status)} className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all", active ? cn(colors[status], "shadow-sm") : "text-gray-400 dark:text-gray-500 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600")}>{label}</button>
    );
  };

  if (loading) {
    return (
      <div className="space-y-5 max-w-5xl mx-auto pb-20 lg:pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="h-10 w-48 bg-gray-200/70 dark:bg-gray-800/50 rounded-xl animate-pulse" />
          <div className="h-10 w-32 bg-gray-200/70 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-200/70 dark:bg-gray-800/50 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-20 bg-gray-200/70 dark:bg-gray-800/50 rounded-2xl animate-pulse" />
        <div className="h-96 bg-gray-200/70 dark:bg-gray-800/50 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">📋 Attendance</h1><p className="text-gray-500 dark:text-gray-400 text-sm">Mark and manage student attendance</p></div>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={cn(S.input, "py-2 w-auto")} />
      </motion.div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", val: filtered.length, cls: "" },
          { label: "Present", val: presentCount, cls: "bg-green-50/50 border-green-100 text-green-700 dark:bg-green-900/10 dark:border-green-800 dark:text-green-400" },
          { label: "Absent", val: absentCount, cls: "bg-red-50/50 border-red-100 text-red-700 dark:bg-red-900/10 dark:border-red-800 dark:text-red-400" },
          { label: "Late", val: lateCount, cls: "bg-yellow-50/50 border-yellow-100 text-yellow-700 dark:bg-yellow-900/10 dark:border-yellow-800 dark:text-yellow-400" },
        ].map((c) => (
          <div key={c.label} className={cn(S.card, "py-3 px-4 text-center", c.cls)}><p className="text-xs opacity-70">{c.label}</p><p className="text-xl font-bold">{c.val}</p></div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={S.card}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[130px]"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className={cn(S.input, "py-2")}>
              {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Period</label>
            <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className={cn(S.input, "py-2")}>
              {periods.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[130px]"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Subject</label>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className={cn(S.input, "py-2")}>
              {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="relative flex-1 min-w-[140px]"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
            <Search className="absolute left-3 bottom-2.5 w-4 h-4 text-gray-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Name / Roll…" className={cn(S.input, "py-2 pl-9")} />
          </div>
          <button onClick={markAll} className={cn(S.btnSecondary, "text-xs py-2")}><CheckCheck className="w-4 h-4" />All Present</button>
          <button onClick={saveAttendance} disabled={busy || !Object.keys(attendance).length} className={cn(S.btnPrimary, "text-xs py-2")}>{saved ? "✅ Saved" : busy ? "Saving…" : "Save"}</button>
        </div>
      </motion.div>

      {/* Swipe support help banner for mobile users */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary-50/70 border border-primary-100 text-primary-700 dark:bg-primary-900/20 dark:border-primary-800/40 dark:text-primary-300 text-xs font-medium shadow-sm">
        <Sparkles className="w-4 h-4 text-primary-600 shrink-0" />
        <span>📱 <b>Touch tip:</b> Swipe right on a student row to mark <b>Present</b>, swipe left for <b>Absent</b>!</span>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Users className="w-4 h-4 text-primary-600" />Students ({filtered.length})</h3>
          {saved && <span className={cn(S.badgeGreen, "text-xs")}><CheckCircle className="w-3 h-3" />Submitted</span>}
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[500px] overflow-y-auto">
          {paginated.length ? paginated.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.015 }}
              onTouchStart={(e) => { touchStartRef.current[s.id] = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const start = touchStartRef.current[s.id];
                if (start !== undefined) {
                  const end = e.changedTouches[0].clientX;
                  const diff = end - start;
                  if (diff > 50) { mark(s.id, "present"); toast.success(`${s.name} marked Present`); }
                  else if (diff < -50) { mark(s.id, "absent"); toast.error(`${s.name} marked Absent`); }
                }
              }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700 text-xs font-bold">{s.rollNo}</div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.name}</p><p className="text-xs text-gray-400 dark:text-gray-500">{s.class}{s.section ? ` · ${s.section}` : ""}</p></div>
              <div className="flex items-center gap-1.5">
                {statusBtn(s.id, "present", "✓")}
                {statusBtn(s.id, "absent", "✗")}
                {statusBtn(s.id, "late", "⏰")}
              </div>
            </motion.div>
          )) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500"><Users className="w-10 h-10 mx-auto mb-2 opacity-50" /><p className="text-sm">No students found</p></div>
          )}
        </div>

        {/* Pagination Bar */}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Show</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className={cn(S.input, "py-1 px-2 text-xs w-auto")}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>per page</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={cn(S.btnGhost, "px-3 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed")}
              >
                <ChevronLeft className="w-4 h-4 mr-1 inline" /> Prev
              </button>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={cn(S.btnGhost, "px-3 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed")}
              >
                Next <ChevronRight className="w-4 h-4 ml-1 inline" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
