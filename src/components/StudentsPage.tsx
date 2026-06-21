import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ref, push, set, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { Users, Search, Mail, Phone, X, UserPlus, BookOpen, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";
import toast from "react-hot-toast";

export default function StudentsPage() {
  const { isAdmin, schoolId, profile } = useAuth();
  const { students, classes, subjects, currentTeacher } = useSchoolData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", rollNo: 0,
    class: "", section: "", parentName: "", parentPhone: "",
    assignedSubjects: [] as string[]
  });
  const [posting, setPosting] = useState(false);
  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, Record<string, string>>>({});

  // Load subject-teacher mappings
  useEffect(() => {
    if (!schoolId) return;
    const unsub = onValue(ref(db, `schools/${schoolId}/subjectTeachers`), (snap) => {
      const d = snap.val();
      if (d) setSubjectTeachers(d);
      else setSubjectTeachers({});
    });
    return () => unsub();
  }, [schoolId]);

  const canAdd = isAdmin || !!currentTeacher;

  // Pre-fill class based on teacher assignment
  useEffect(() => {
    if (!isAdmin && currentTeacher?.assignedClasses?.length === 1 && !selectedClass) {
      setSelectedClass(currentTeacher.assignedClasses[0]);
    }
    if (!isAdmin && currentTeacher?.assignedClasses?.length === 1 && !form.class) {
      setForm(p => ({ ...p, class: currentTeacher.assignedClasses![0] }));
    }
  }, [currentTeacher, isAdmin, selectedClass, form.class]);

  const filtered = useMemo(() => students.filter((s) => {
    if (selectedClass && s.class !== selectedClass) return false;
    if (searchTerm) { const q = searchTerm.toLowerCase(); return s.name.toLowerCase().includes(q) || String(s.rollNo).includes(q) || (s.email ?? "").toLowerCase().includes(q); }
    return true;
  }), [students, selectedClass, searchTerm]);

  const addStudent = async () => {
    if (!form.name.trim() || !form.class) { toast.error("Name and Class required"); return; }
    if (!schoolId) { toast.error("No school"); return; }
    
    // If teacher is adding, ensure student goes to their assigned class only
    if (!isAdmin && currentTeacher) {
      if (!currentTeacher.assignedClasses?.includes(form.class)) {
        return toast.error("You can only add students to your assigned classes");
      }
      // Auto-assign teacher's subjects to the student
      const autoSubjects = [...new Set([...form.assignedSubjects, ...(currentTeacher.assignedSubjects || [])])];
      form.assignedSubjects = autoSubjects;
    }

    setPosting(true);
    try {
      const newRef = push(ref(db, `schools/${schoolId}/students`));
      const studentData = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        rollNo: Number(form.rollNo),
        class: form.class,
        section: form.section,
        parentName: form.parentName,
        parentPhone: form.parentPhone,
        subjects: form.assignedSubjects,
        createdAt: Date.now(),
        addedBy: profile?.uid
      };
      await set(newRef, studentData);
      
      toast.success("Student added! 🎉");
      setShowAdd(false);
      setForm({ name: "", email: "", phone: "", rollNo: 0, class: "", section: "", parentName: "", parentPhone: "", assignedSubjects: [] });
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    setPosting(false);
  };

  const toggleSubject = (subj: string) => {
    setForm(p => ({
      ...p,
      assignedSubjects: p.assignedSubjects.includes(subj)
        ? p.assignedSubjects.filter(s => s !== subj)
        : [...p.assignedSubjects, subj]
    }));
  };

  const F = (label: string, key: keyof typeof form, type = "text", span = false) => (
    <div className={span ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {type === "number"
        ? <input type="number" value={form[key] as number} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} className={S.input} />
        : <input type={type} value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={S.input} />}
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">👨‍🎓 Students</h1><p className="text-gray-500 text-sm">Manage student profiles</p></div>
        {canAdd && <button onClick={() => setShowAdd(true)} className={S.btnPrimary}><UserPlus className="w-4 h-4" />Add Student</button>}
      </motion.div>

      {/* filter */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={S.card}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[150px]"><label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className={cn(S.input, "py-2")}>
              <option value="">All</option>
              {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="relative flex-[2] min-w-[200px]"><label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <Search className="absolute left-3 bottom-2.5 w-4 h-4 text-gray-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Name, roll, email…" className={cn(S.input, "py-2 pl-9")} />
          </div>
          <span className="text-sm text-gray-500">{filtered.length} students</span>
        </div>
      </motion.div>

      {/* grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className={S.cardHover}>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700 text-lg font-bold shadow-sm shrink-0">{s.rollNo}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{s.name}</h3>
                <p className="text-xs text-gray-500">{s.class}{s.section ? ` · ${s.section}` : ""}</p>
                <div className="mt-2 space-y-1">
                  {s.email && <p className="flex items-center gap-1.5 text-xs text-gray-400"><Mail className="w-3 h-3" />{s.email}</p>}
                  {s.phone && <p className="flex items-center gap-1.5 text-xs text-gray-400"><Phone className="w-3 h-3" />{s.phone}</p>}
                  {s.parentName && <p className="flex items-center gap-1.5 text-xs text-gray-400"><Users className="w-3 h-3" />{s.parentName}</p>}
                  {s.subjects && s.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.subjects.slice(0, 4).map((sub) => (
                        <span key={sub} className={cn(S.badgeBlue, "text-[9px]")}>{sub}</span>
                      ))}
                      {s.subjects.length > 4 && <span className="text-[9px] text-gray-400">+{s.subjects.length - 4}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary-600" />Add Student</h3>
              <button onClick={() => setShowAdd(false)} className={cn(S.btnGhost, "p-1")}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5"><div className="grid grid-cols-2 gap-3">
              {F("Full Name *", "name", "text", true)}
              {F("Roll No *", "rollNo", "number")}
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Class *</label>
                <select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} className={S.input} disabled={!isAdmin && currentTeacher?.assignedClasses?.length === 1}>
                  <option value="">Select</option>
                  {(isAdmin ? classes : classes.filter(c => currentTeacher?.assignedClasses?.includes(c.name))).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select></div>
              {F("Section", "section")}
              {F("Email", "email", "email")}
              {F("Phone", "phone")}
              {F("Parent Name", "parentName", "text", true)}
              {F("Parent Phone", "parentPhone", "text", true)}
              
              {/* Subject Assignment */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />Assign Subjects</label>
                {subjects.length ? (
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((s) => {
                      const active = form.assignedSubjects.includes(s.name);
                      const teacherForSub = subjectTeachers[form.class]?.[s.name];
                      const isOwnSubject = !isAdmin && currentTeacher?.assignedSubjects?.includes(s.name);
                      return (
                        <button
                          key={s.id}
                          onClick={() => !isAdmin && !isOwnSubject ? null : toggleSubject(s.name)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1",
                            active
                              ? isOwnSubject ? "bg-accent-100 border-accent-300 text-accent-700" : "bg-primary-100 border-primary-300 text-primary-700"
                              : cn("bg-gray-50 border-gray-200 text-gray-500", (!isAdmin || !isOwnSubject) && "opacity-50 cursor-not-allowed")
                          )}
                          title={teacherForSub ? `Teacher: ${teacherForSub}` : "No teacher assigned"}
                        >
                          {active && <Check className="w-3 h-3" />}{s.name}
                        </button>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-gray-400">Add subjects first in Admin Panel</p>}
                {!isAdmin && <p className="text-[10px] text-gray-400 mt-1.5">ℹ️ You can only assign subjects you teach</p>}
              </div>
            </div></div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className={S.btnSecondary}>Cancel</button>
              <button onClick={addStudent} disabled={posting} className={S.btnPrimary}>{posting ? "Adding…" : "Add Student"}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
