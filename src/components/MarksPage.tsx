import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ref, onValue, push, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { TrendingUp, TrendingDown, Search, Users, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";
import { predict } from "@/lib/ai-predictions";
import toast from "react-hot-toast";

interface MarkRec { id: string; studentId: string; subject: string; score: number; maxScore: number; type: string; date: string }

export default function MarksPage() {
  const { profile, schoolId } = useAuth();
  const { students, subjects, classes } = useSchoolData();
  const [marks, setMarks] = useState<MarkRec[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedType, setSelectedType] = useState("quiz");
  const [selectedClass, setSelectedClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [maxScore, setMaxScore] = useState(100);
  const [saving, setSaving] = useState(false);
  const [showAI, setShowAI] = useState(false);

  useEffect(() => { if (classes.length && !selectedClass) setSelectedClass(classes[0].name); }, [classes, selectedClass]);
  useEffect(() => { if (subjects.length && !selectedSubject) setSelectedSubject(subjects[0].name); }, [subjects, selectedSubject]);

  useEffect(() => {
    if (!schoolId) return;
    const unsub = onValue(ref(db, `schools/${schoolId}/marks`), (snap) => {
      const d = snap.val();
      if (d) setMarks(Object.entries(d).map(([id, v]: [string, any]) => ({ id, ...v })));
      else setMarks([]);
    });
    return () => unsub();
  }, [schoolId]);

  const filtered = useMemo(() => students.filter((s) => {
    if (selectedClass && s.class !== selectedClass) return false;
    if (searchTerm) { const q = searchTerm.toLowerCase(); return s.name.toLowerCase().includes(q) || String(s.rollNo).includes(q); }
    return true;
  }), [students, selectedClass, searchTerm]);

  const save = async () => {
    if (!schoolId || !selectedSubject) return;
    setSaving(true);
    try {
      const entries = Object.entries(scores).filter(([, v]) => v !== "");
      for (const [sid, score] of entries) {
        const newRef = push(ref(db, `schools/${schoolId}/marks`));
        await set(newRef, { studentId: sid, subject: selectedSubject, score: Number(score), maxScore, type: selectedType, date: new Date().toISOString().split("T")[0], markedBy: profile?.uid, timestamp: Date.now() });
      }
      toast.success(`Marks saved for ${entries.length} students! 📝`); setScores({});
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    setSaving(false);
  };

  const studentMarks = (sid: string) => marks.filter((m) => m.studentId === sid && m.subject === selectedSubject).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const studentAvg = (sid: string) => { const sm = studentMarks(sid); if (!sm.length) return 0; return Math.round(sm.reduce((s, m) => s + (m.score / m.maxScore) * 100, 0) / sm.length); };
  const trend = (sid: string) => { const sm = studentMarks(sid); if (sm.length < 2) return 0; return (sm[0].score / sm[0].maxScore) - (sm[1].score / sm[1].maxScore); };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">📊 Marks</h1><p className="text-gray-500 text-sm">Record and track student performance</p></div>
        <button onClick={() => setShowAI(!showAI)} className={cn(S.btnSecondary, showAI && "bg-primary-50 border-primary-200")}><Sparkles className="w-4 h-4" />AI Predictions</button>
      </motion.div>

      {showAI && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className={cn(S.card, "bg-gradient-to-r from-primary-50 to-accent-50 border-primary-100/50 overflow-hidden")}>
          <div className="flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-primary-600" /><h3 className="font-semibold text-gray-900">AI Performance Predictions</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.slice(0, 6).map((s) => {
              const sm = studentMarks(s.id);
              const p = predict([], sm.map((m) => ({ pct: (m.score / m.maxScore) * 100 })));
              return (
                <div key={s.id} className="bg-white/80 rounded-xl p-3 border border-white">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", p.performance.expected >= 80 ? "bg-green-100 text-green-700" : p.performance.expected >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>{p.performance.expected}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5"><div className={cn("h-1.5 rounded-full", p.performance.expected >= 80 ? "bg-green-500" : p.performance.expected >= 50 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${Math.min(100, p.performance.expected)}%` }} /></div>
                  <p className="text-[10px] text-gray-400 mt-1">Confidence: {p.performance.confidence}%</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* controls */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={S.card}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[130px]"><label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className={cn(S.input, "py-2")}>{classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
          <div className="flex-1 min-w-[130px]"><label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className={cn(S.input, "py-2")}>{subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className={cn(S.input, "py-2")}><option value="quiz">Quiz</option><option value="midterm">Mid Term</option><option value="final">Final</option><option value="assignment">Assignment</option></select></div>
          <div className="w-20"><label className="block text-xs font-medium text-gray-500 mb-1">Max</label>
            <input type="number" value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} className={cn(S.input, "py-2")} /></div>
          <div className="relative flex-1 min-w-[130px]"><label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <Search className="absolute left-3 bottom-2.5 w-4 h-4 text-gray-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search…" className={cn(S.input, "py-2 pl-9")} /></div>
          <button onClick={save} disabled={saving || !selectedSubject || !Object.values(scores).some((v) => v)} className={cn(S.btnPrimary, "text-xs py-2")}>{saving ? "Saving…" : "Save Marks"}</button>
        </div>
      </motion.div>

      {/* table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-primary-600" />Students ({filtered.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50"><th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Roll</th><th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Name</th><th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Score / {maxScore}</th><th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Avg %</th><th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Trend</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s, i) => {
                const avg = studentAvg(s.id);
                const t = trend(s.id);
                return (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{s.rollNo}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3"><input type="number" value={scores[s.id] ?? ""} onChange={(e) => setScores((p) => ({ ...p, [s.id]: e.target.value }))} placeholder="—" min={0} max={maxScore} className={cn(S.input, "w-24 text-center py-1.5 text-sm mx-auto")} /></td>
                    <td className="px-4 py-3 text-center"><span className={cn("text-sm font-semibold", avg >= 80 ? "text-green-600" : avg >= 50 ? "text-yellow-600" : avg > 0 ? "text-red-600" : "text-gray-300")}>{avg > 0 ? `${avg}%` : "—"}</span></td>
                    <td className="px-4 py-3 text-center">{t !== 0 && <span className={cn("inline-flex items-center text-xs font-medium", t > 0 ? "text-green-600" : "text-red-600")}>{t > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}</span>}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
