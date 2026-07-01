import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ref, push, set, onValue, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { Users, Search, Mail, Phone, X, UserPlus, BookOpen, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";
import toast from "react-hot-toast";

const classLabel = (c: any) => c?.section ? `${c.name} - ${c.section}` : (c?.name ?? "");
const studentClassLabel = (s: any) => [s.class, s.section].filter(Boolean).join(" - ");

export default function StudentsPage() {
  const { isAdmin, schoolId, profile } = useAuth();
  const { students, classes, subjects, currentTeacher, allStudents, loading } = useSchoolData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", rollNo: 0,
    classId: "", class: "", section: "", parentName: "", parentPhone: "",
    assignedSubjects: [] as string[]
  });
  const [posting, setPosting] = useState(false);
  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, Record<string, string>>>({});
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(21);

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

  useEffect(() => {
    if (!isAdmin && currentTeacher?.assignedClasses?.length === 1) {
      const assigned = currentTeacher.assignedClasses[0];
      const cls = classes.find((c) => classLabel(c) === assigned || c.name === assigned);
      if (!selectedClass) setSelectedClass(cls?.id || assigned);
      if (!form.class) {
        setForm(p => ({ ...p, classId: cls?.id || "", class: cls?.name || assigned, section: cls?.section || "" }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTeacher, isAdmin, classes]);

  const filtered = useMemo(() => students.filter((s) => {
    if (selectedClass && s.classId !== selectedClass && studentClassLabel(s) !== selectedClass && s.class !== selectedClass) return false;
    if (searchTerm) { const q = searchTerm.toLowerCase(); return s.name.toLowerCase().includes(q) || String(s.rollNo).includes(q) || (s.email ?? "").toLowerCase().includes(q); }
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

  const saveStudent = async () => {
    if (!form.name.trim() || !form.class) { toast.error("Name and Class required"); return; }
    if (!schoolId) { toast.error("No school"); return; }

    // duplicate roll no check (skip if editing the same student)
    const dup = allStudents.find(s => s.class === form.class && (s.section || "") === (form.section || "") && Number(s.rollNo) === Number(form.rollNo) && s.id !== editingStudent?.id);
    if (dup) { toast.error(`Roll No ${form.rollNo} already exists in ${[form.class, form.section].filter(Boolean).join(" - ")}`); return; }

    let assignedSubjects = form.assignedSubjects;
    if (!isAdmin && currentTeacher) {
      if (!currentTeacher.assignedClasses?.includes(form.class)) {
        return toast.error("You can only add/edit students to your assigned classes");
      }
      assignedSubjects = [...new Set([...form.assignedSubjects, ...(currentTeacher.assignedSubjects || [])])];
    }

    setPosting(true);
    try {
      const studentData = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        rollNo: Number(form.rollNo),
        classId: form.classId,
        class: form.class,
        section: form.section,
        parentName: form.parentName,
        parentPhone: form.parentPhone,
        subjects: assignedSubjects,
        updatedAt: Date.now(),
        addedBy: profile?.uid ?? null
      };

      if (editingStudent) {
        await set(ref(db, `schools/${schoolId}/students/${editingStudent.id}`), { ...editingStudent, ...studentData });
        toast.success("Student updated! ✅");
      } else {
        const newRef = push(ref(db, `schools/${schoolId}/students`));
        await set(newRef, { ...studentData, createdAt: Date.now() });
        toast.success("Student added! 🎉");
      }
      
      setShowAdd(false);
      setEditingStudent(null);
      setForm({ name: "", email: "", phone: "", rollNo: 0, classId: "", class: "", section: "", parentName: "", parentPhone: "", assignedSubjects: [] });
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    setPosting(false);
  };

  const deleteStudent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this student?")) return;
    setPosting(true);
    try {
      await remove(ref(db, `schools/${schoolId}/students/${id}`));
      toast.success("Student deleted");
    } catch (e: any) { toast.error(e.message ?? "Failed to delete"); }
    setPosting(false);
  };

  const openEdit = (s: any) => {
    setEditingStudent(s);
    setForm({
      name: s.name, email: s.email ?? "", phone: s.phone ?? "", rollNo: s.rollNo ?? 0,
      classId: s.classId ?? "", class: s.class, section: s.section ?? "", parentName: s.parentName ?? "", parentPhone: s.parentPhone ?? "",
      assignedSubjects: s.subjects ?? []
    });
    setShowAdd(true);
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
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
      {type === "number"
        ? <input type="number" value={form[key] as number} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} className={S.input} />
        : <input type={type} value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={S.input} />}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-2">
            <div className="h-8 w-40 bg-gray-200/70 dark:bg-gray-800/50 rounded-xl animate-pulse" />
            <div className="h-4 w-60 bg-gray-200/70 dark:bg-gray-800/50 rounded-lg animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-gray-200/70 dark:bg-gray-800/50 rounded-xl animate-pulse" />
        </div>
        <div className="h-20 bg-gray-200/70 dark:bg-gray-800/50 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-36 bg-gray-200/70 dark:bg-gray-800/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">👨‍🎓 Students</h1><p className="text-gray-500 dark:text-gray-400 text-sm">Manage student profiles</p></div>
        {canAdd && <button onClick={() => setShowAdd(true)} className={S.btnPrimary}><UserPlus className="w-4 h-4" />Add Student</button>}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={S.card}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[150px]"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className={cn(S.input, "py-2")}>
              <option value="">All</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
            </select>
          </div>
          <div className="relative flex-[2] min-w-[200px]"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
            <Search className="absolute left-3 bottom-2.5 w-4 h-4 text-gray-400" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Name, roll, email…" className={cn(S.input, "py-2 pl-9")} />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <span className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} students</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paginated.map((s, i) => {
          const canManage = isAdmin || currentTeacher?.assignedClasses?.includes(studentClassLabel(s)) || currentTeacher?.assignedClasses?.includes(s.class);
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className={S.cardHover}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700 text-lg font-bold shadow-sm shrink-0">{s.rollNo}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{s.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.class}{s.section ? ` · ${s.section}` : ""}</p>
                    <div className="mt-2 space-y-1">
                      {s.email && <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500"><Mail className="w-3 h-3" />{s.email}</p>}
                      {s.phone && <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500"><Phone className="w-3 h-3" />{s.phone}</p>}
                      {s.parentName && <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500"><Users className="w-3 h-3" />{s.parentName}</p>}
                      {s.subjects && s.subjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.subjects.slice(0, 4).map((sub) => (
                            <span key={sub} className={cn(S.badgeBlue, "text-[9px]")}>{sub}</span>
                          ))}
                          {s.subjects.length > 4 && <span className="text-[9px] text-gray-400 dark:text-gray-500">+{s.subjects.length - 4}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {canManage && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-primary-100 hover:text-primary-600 dark:hover:bg-primary-900/30 dark:hover:text-primary-400 transition-colors"><BookOpen className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteStudent(s.id)} className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination Bar */}
      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-800 pt-4 mt-6">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Show</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className={cn(S.input, "py-1 px-2 text-xs w-auto")}>
              <option value={12}>12</option>
              <option value={21}>21</option>
              <option value={42}>42</option>
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

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary-600" />{editingStudent ? "Edit Student" : "Add Student"}</h3>
              <button onClick={() => { setShowAdd(false); setEditingStudent(null); }} className={cn(S.btnGhost, "p-1")}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5"><div className="grid grid-cols-2 gap-3">
              {F("Full Name *", "name", "text", true)}
              {F("Roll No *", "rollNo", "number")}
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Class *</label>
                <select value={form.classId || [form.class, form.section].filter(Boolean).join(" - ")} onChange={(e) => {
                  const c = classes.find((cls) => cls.id === e.target.value);
                  if (c) setForm({ ...form, classId: c.id, class: c.name, section: c.section || "" });
                  else setForm({ ...form, classId: "", class: e.target.value, section: "" });
                }} className={S.input} disabled={!isAdmin && currentTeacher?.assignedClasses?.length === 1}>
                  <option value="">Select</option>
                  {(isAdmin ? classes : classes.filter(c => currentTeacher?.assignedClasses?.includes(classLabel(c)) || currentTeacher?.assignedClasses?.includes(c.name))).map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Section</label>
                <input value={form.section} readOnly placeholder="Select class section" className={cn(S.input, "bg-gray-50 dark:bg-gray-800")} />
              </div>
              {F("Email", "email", "email")}
              {F("Phone", "phone")}
              {F("Parent Name", "parentName", "text", true)}
              {F("Parent Phone", "parentPhone", "text", true)}

              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />Assign Subjects</label>
                {subjects.length ? (
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((s) => {
                      const active = form.assignedSubjects.includes(s.name);
                      const isOwnSubject = !isAdmin && currentTeacher?.assignedSubjects?.includes(s.name);
                      const teacherCanAssign = isAdmin || isOwnSubject;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => teacherCanAssign && toggleSubject(s.name)}
                          disabled={!teacherCanAssign}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1",
                            active
                              ? "bg-primary-100 border-primary-300 text-primary-700 dark:bg-primary-900/20 dark:border-primary-700 dark:text-primary-400"
                              : cn("bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400", !teacherCanAssign && "opacity-50 cursor-not-allowed")
                          )}
                        >
                          {active && <Check className="w-3 h-3" />}{s.name}
                        </button>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-gray-400 dark:text-gray-500">Add subjects first in Admin Panel</p>}
                {!isAdmin && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">ℹ️ You can only assign subjects you teach</p>}
              </div>
            </div></div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className={S.btnSecondary}>Cancel</button>
              <button onClick={saveStudent} disabled={posting} className={S.btnPrimary}>{posting ? "Saving…" : editingStudent ? "Update Student" : "Add Student"}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}