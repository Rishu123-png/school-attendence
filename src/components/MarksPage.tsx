import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ref, onValue, push, update, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { TrendingUp, TrendingDown, Search, Users, Sparkles, Download, History, Trash2, Pencil, X, Plus, ChevronLeft, ChevronRight, CheckCheck, Trash } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";
import { getAttendanceSummary, predictNextMark } from "@/lib/marks-ai";
import toast from "react-hot-toast";

interface MarkRec {
  id: string;
  studentId: string;
  subject: string;
  score: number;
  maxScore: number;
  type: string;
  examName?: string;
  date: string;
  className?: string;
  markedBy?: string;
  timestamp?: number;
}

const DEFAULT_ASSESSMENTS = [
  { name: "Unit Test 1", max: 25 },
  { name: "Unit Test 2", max: 25 },
  { name: "Mid Term", max: 100 },
  { name: "Unit Test 3", max: 25 },
  { name: "Unit Test 4", max: 25 },
  { name: "Final Term", max: 100 },
];

const safe = (v: string) => `"${String(v ?? "").replaceAll('"', '""')}"`;

export default function MarksPage() {
  const { profile, schoolId } = useAuth();
  const { students, subjects, classes, loading } = useSchoolData();
  const [marks, setMarks] = useState<MarkRec[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedAssessment, setSelectedAssessment] = useState(DEFAULT_ASSESSMENTS[0].name);
  const [selectedClass, setSelectedClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [maxScore, setMaxScore] = useState(25);
  const [saving, setSaving] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [customName, setCustomName] = useState("");
  const [customMax, setCustomMax] = useState(25);
  const [customAssessments, setCustomAssessments] = useState<{ name: string; max: number }[]>([]);
  const [editing, setEditing] = useState<MarkRec | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const assessments = useMemo(() => [...DEFAULT_ASSESSMENTS, ...customAssessments], [customAssessments]);

  useEffect(() => { if (classes.length && !selectedClass) setSelectedClass(classes[0].name); }, [classes, selectedClass]);
  useEffect(() => { if (subjects.length && !selectedSubject) setSelectedSubject(subjects[0].name); }, [subjects, selectedSubject]);

  useEffect(() => {
    const found = assessments.find((a) => a.name === selectedAssessment);
    if (found && !editing) setMaxScore(found.max);
  }, [selectedAssessment, assessments, editing]);

  useEffect(() => {
    if (!schoolId) return;
    const unsub = onValue(ref(db, `schools/${schoolId}/marks`), (snap) => {
      const d = snap.val();
      if (d) setMarks(Object.entries(d).map(([id, v]: [string, any]) => ({ id, ...v })));
      else setMarks([]);
    });
    return () => unsub();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    const unsub = onValue(ref(db, `schools/${schoolId}/attendance`), (snap) => setAttendanceData(snap.val() ?? null));
    return () => unsub();
  }, [schoolId]);

  const filtered = useMemo(() => students.filter((s) => {
    if (selectedClass && s.class !== selectedClass) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return s.name.toLowerCase().includes(q) || String(s.rollNo).includes(q);
    }
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

  const studentMarks = (sid: string, subject = selectedSubject) => marks
    .filter((m) => m.studentId === sid && (!subject || m.subject === subject))
    .sort((a, b) => (b.timestamp || new Date(b.date).getTime() || 0) - (a.timestamp || new Date(a.date).getTime() || 0));

  const studentAvg = (sid: string) => {
    const sm = studentMarks(sid);
    if (!sm.length) return 0;
    return Math.round(sm.reduce((s, m) => s + (m.score / m.maxScore) * 100, 0) / sm.length);
  };

  const trend = (sid: string) => {
    const sm = studentMarks(sid);
    if (sm.length < 2) return 0;
    return (sm[0].score / sm[0].maxScore) - (sm[1].score / sm[1].maxScore);
  };

  // Batch Quick Actions
  const setAllMax = () => {
    const s: Record<string, string> = { ...scores };
    filtered.forEach((stu) => { s[stu.id] = String(maxScore); });
    setScores(s);
    toast.success(`Set score to ${maxScore} for all ${filtered.length} students!`);
  };

  const clearAllScores = () => {
    setScores({});
    toast.success("Cleared input scores");
  };

  const save = async () => {
    if (!schoolId || !selectedSubject || !selectedAssessment) return;
    if (maxScore <= 0) return toast.error("Max marks must be greater than 0");
    setSaving(true);
    try {
      const dateStr = new Date().toISOString().split("T")[0];
      const entries = Object.entries(scores).filter(([, v]) => v !== "" && !Number.isNaN(Number(v)));
      const updates: Record<string, any> = {};
      let savedCount = 0;

      const existingIndex = new Map<string, string>();
      marks.forEach((m) => {
        if (m.subject === selectedSubject && (m.examName || m.type) === selectedAssessment && m.className === selectedClass) {
          existingIndex.set(m.studentId, m.id);
        }
      });

      for (const [sid, scoreText] of entries) {
        const score = Number(scoreText);
        if (score < 0 || score > maxScore) {
          toast.error(`Score must be between 0 and ${maxScore}`);
          setSaving(false);
          return;
        }
        const payload = {
          studentId: sid,
          subject: selectedSubject,
          score,
          maxScore,
          type: selectedAssessment,
          examName: selectedAssessment,
          className: selectedClass,
          date: dateStr,
          markedBy: profile?.uid,
          timestamp: Date.now(),
        };
        const id = editing?.studentId === sid ? editing.id : existingIndex.get(sid) || push(ref(db, `schools/${schoolId}/marks`)).key;
        updates[`schools/${schoolId}/marks/${id}`] = payload;
        savedCount++;
      }

      if (!savedCount) return toast.error("No scores entered");
      await update(ref(db), updates);
      toast.success(`Marks saved for ${savedCount} student(s)!`);
      setScores({});
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (m: MarkRec) => {
    setEditing(m);
    setSelectedSubject(m.subject);
    setSelectedAssessment(m.examName || m.type);
    setMaxScore(m.maxScore);
    if (m.className) setSelectedClass(m.className);
    setScores({ [m.studentId]: String(m.score) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteMark = async (id: string) => {
    if (!schoolId || !confirm("Delete this mark record?")) return;
    await remove(ref(db, `schools/${schoolId}/marks/${id}`));
    toast.success("Mark deleted");
  };

  const addAssessment = () => {
    const name = customName.trim();
    if (!name) return toast.error("Assessment name required");
    if (assessments.some((a) => a.name.toLowerCase() === name.toLowerCase())) return toast.error("Assessment already exists");
    setCustomAssessments((p) => [...p, { name, max: Math.max(1, customMax) }]);
    setSelectedAssessment(name);
    setMaxScore(Math.max(1, customMax));
    setCustomName("");
    toast.success("Assessment block added");
  };

  const exportCSV = () => {
    const rows = [["Roll", "Name", "Class", "Subject", "Assessment", "Score", "Max", "Percent", "Date"]];
    filtered.forEach((s) => {
      studentMarks(s.id).forEach((m) => rows.push([
        String(s.rollNo), s.name, m.className || selectedClass, m.subject, m.examName || m.type,
        String(m.score), String(m.maxScore), `${Math.round((m.score / m.maxScore) * 100)}%`, m.date,
      ]));
    });
    const csv = rows.map((r) => r.map(safe).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `marks-${selectedClass}-${selectedSubject}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = filtered.flatMap((s) => {
      const sm = studentMarks(s.id);
      if (!sm.length) {
        return [{ Roll: s.rollNo, Name: s.name, Class: selectedClass, Subject: selectedSubject, Assessment: "", Score: "" as number | string, Max: "" as number | string, Percent: "" as number | string, Date: "" }];
      }
      return sm.map((m) => ({
        Roll: s.rollNo,
        Name: s.name,
        Class: m.className || selectedClass,
        Subject: m.subject,
        Assessment: m.examName || m.type,
        Score: m.score as number | string,
        Max: m.maxScore as number | string,
        Percent: Math.round((m.score / m.maxScore) * 100) as number | string,
        Date: m.date,
      }));
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marks");
    XLSX.writeFile(wb, `marks-${selectedClass}-${selectedSubject}.xlsx`);
  };

  const printPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-5 max-w-5xl mx-auto pb-28 lg:pb-0 print:pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
          <div className="h-10 w-48 bg-gray-200/70 dark:bg-gray-800/50 rounded-xl animate-pulse" />
          <div className="h-10 w-80 bg-gray-200/70 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        </div>
        <div className="h-28 bg-gray-200/70 dark:bg-gray-800/50 rounded-2xl animate-pulse print:hidden" />
        <div className="h-96 bg-gray-200/70 dark:bg-gray-800/50 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-28 lg:pb-0 print:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">📊 Marks</h1><p className="text-gray-500 dark:text-gray-400 text-sm">Record, edit, export and predict student performance with batch grading</p></div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button onClick={() => setShowAI(!showAI)} className={cn(S.btnSecondary, showAI && "bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-700")}><Sparkles className="w-4 h-4" />AI</button>
          <button onClick={() => setShowHistory(!showHistory)} className={S.btnSecondary}><History className="w-4 h-4" />History</button>
          <button onClick={exportCSV} className={S.btnSecondary}><Download className="w-4 h-4" />CSV</button>
          <button onClick={exportExcel} className={S.btnSecondary}><Download className="w-4 h-4" />Excel</button>
          <button onClick={printPDF} className={S.btnSecondary}><Download className="w-4 h-4" />PDF</button>
        </div>
      </motion.div>

      {showAI && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className={cn(S.card, "bg-gradient-to-r from-primary-50 to-accent-50 border-primary-100/50 overflow-hidden dark:from-primary-900/10 dark:to-accent-900/10 dark:border-primary-800/30")}>
          <div className="flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-primary-600" /><h3 className="font-semibold text-gray-900 dark:text-white">AI Performance Predictions</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((s) => {
              const sm = studentMarks(s.id).slice().reverse();
              const att = getAttendanceSummary(attendanceData, s.id, selectedSubject);
              const p = predictNextMark(sm, att, maxScore);
              return (
                <div key={s.id} className="bg-white/80 dark:bg-gray-800/50 rounded-xl p-4 border border-white dark:border-gray-700 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.name}</p><p className="text-[11px] text-gray-500">Next: {p.nextExam}</p></div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", p.status === "need-first" ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" : p.expectedPercent >= 75 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : p.expectedPercent >= 50 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>{p.status === "need-first" ? "Need UT1" : `${p.expectedScore}/${maxScore}`}</span>
                  </div>
                  {p.status === "ready" && <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5"><div className={cn("h-1.5 rounded-full", p.expectedPercent >= 75 ? "bg-green-500" : p.expectedPercent >= 50 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${p.expectedPercent}%` }} /></div>}
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Confidence: {p.confidence}% · Attendance: {Math.round(p.attendance.rate * 100) || 0}%</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{p.attendanceMessage}</p>
                  <ul className="list-disc pl-4 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                    {p.explanation.slice(0, 2).map((x) => <li key={x}>{x}</li>)}
                    {p.suggestions.slice(0, 2).map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={cn(S.card, "print:hidden")}>
        {editing && <div className="mb-3 flex items-center justify-between rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300"><span>Editing one saved mark. Change score and save.</span><button onClick={() => { setEditing(null); setScores({}); }}><X className="w-4 h-4" /></button></div>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div className="col-span-1 md:col-span-1"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Class</label><select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className={cn(S.input, "py-2")}>{classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
          <div className="col-span-1 md:col-span-1"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Subject</label><select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className={cn(S.input, "py-2")}>{subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
          <div className="col-span-1 md:col-span-2"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Assessment</label><select value={selectedAssessment} onChange={(e) => setSelectedAssessment(e.target.value)} className={cn(S.input, "py-2")}>{assessments.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max</label><input type="number" value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} className={cn(S.input, "py-2")} /></div>
          <div className="flex items-end"><button onClick={save} disabled={saving || !selectedSubject || !Object.values(scores).some((v) => v)} className={cn(S.btnPrimary, "w-full text-xs py-2")}>{saving ? "Saving…" : "Save"}</button></div>
          <div className="col-span-2 md:col-span-3 relative"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search Student</label><Search className="absolute left-3 bottom-2.5 w-4 h-4 text-gray-400" /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search name / roll…" className={cn(S.input, "py-2 pl-9")} /></div>
          <div className="col-span-2 md:col-span-3 grid grid-cols-[1fr_90px_auto] gap-2 items-end"><div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Add custom block</label><input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Unit Test 5" className={cn(S.input, "py-2")} /></div><input type="number" value={customMax} onChange={(e) => setCustomMax(Number(e.target.value))} className={cn(S.input, "py-2")} /><button onClick={addAssessment} className={cn(S.btnSecondary, "py-2 px-3")}><Plus className="w-4 h-4" /></button></div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 print:hidden">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-auto">⚡ Quick Actions:</span>
          <button onClick={setAllMax} className={cn(S.btnSecondary, "text-xs py-1.5 px-3 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300")}><CheckCheck className="w-3.5 h-3.5 mr-1 inline" />Set All Max ({maxScore})</button>
          <button onClick={clearAllScores} className={cn(S.btnSecondary, "text-xs py-1.5 px-3 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400")}><Trash className="w-3.5 h-3.5 mr-1 inline" />Clear Inputs</button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Users className="w-4 h-4 text-primary-600" />Students ({filtered.length})</h3>
          <span className="hidden print:block text-sm text-gray-500">{selectedClass} · {selectedSubject}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr className="bg-gray-50 dark:bg-gray-800"><th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Roll</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Name</th><th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 print:hidden">Score / {maxScore}</th><th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Avg %</th><th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Trend</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Latest</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {paginated.map((s, i) => {
                const avg = studentAvg(s.id);
                const t = trend(s.id);
                const latest = studentMarks(s.id)[0];
                return (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">{s.rollNo}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</td>
                    <td className="px-4 py-3 print:hidden"><input type="number" value={scores[s.id] ?? ""} onChange={(e) => setScores((p) => ({ ...p, [s.id]: e.target.value }))} placeholder="—" min={0} max={maxScore} className={cn(S.input, "w-24 text-center py-1.5 text-sm mx-auto")} /></td>
                    <td className="px-4 py-3 text-center"><span className={cn("text-sm font-semibold", avg >= 80 ? "text-green-600" : avg >= 50 ? "text-yellow-600" : avg > 0 ? "text-red-600" : "text-gray-300 dark:text-gray-600")}>{avg > 0 ? `${avg}%` : "—"}</span></td>
                    <td className="px-4 py-3 text-center">{t !== 0 && <span className={cn("inline-flex items-center text-xs font-medium", t > 0 ? "text-green-600" : "text-red-600")}>{t > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{latest ? `${latest.examName || latest.type}: ${latest.score}/${latest.maxScore}` : "No marks"}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
{/* Pagination Bar */}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-900/50 print:hidden">
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

      {showHistory && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={cn(S.card, "p-0 overflow-hidden print:hidden")}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800"><h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><History className="w-4 h-4 text-primary-600" />Saved Marks History</h3></div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[420px] overflow-y-auto">
            {marks.filter((m) => !selectedClass || !m.className || m.className === selectedClass).filter((m) => !selectedSubject || m.subject === selectedSubject).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).map((m) => {
              const stu = students.find((s) => s.id === m.studentId);
              return <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{stu?.name || "Student"} · {m.examName || m.type}</p><p className="text-xs text-gray-500">{m.subject} · {m.score}/{m.maxScore} · {Math.round((m.score / m.maxScore) * 100)}% · {m.date}</p></div><div className="flex gap-1"><button onClick={() => startEdit(m)} className="p-2 rounded-lg text-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/40"><Pencil className="w-4 h-4" /></button><button onClick={() => deleteMark(m.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button></div></div>;
            })}
            {!marks.length && <div className="py-10 text-center text-gray-400 text-sm">No saved marks yet</div>}
          </div>
        </motion.div>
      )}
    </div>
  );
}