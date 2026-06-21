import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ref, push, set, remove, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { Building2, BookOpen, Users, CalendarDays, UserCheck, Plus, Trash2, X, Mail, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";
import toast from "react-hot-toast";
import { Navigate } from "react-router-dom";

type Tab = "classes" | "subjects" | "teachers" | "subjectTeachers" | "timetable";

export default function AdminPanel() {
  const { isAdmin, schoolId } = useAuth();
  const { classes, subjects, teachers, timetable, allClasses, allSubjects, allStudents } = useSchoolData();
  const [tab, setTab] = useState<Tab>("classes");

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const root = `schools/${schoolId}`;

  const TABS = [
    { id: "classes",        label: "Classes",        icon: Building2 },
    { id: "subjects",       label: "Subjects",       icon: BookOpen },
    { id: "teachers",       label: "Teachers",       icon: Users },
    { id: "subjectTeachers",label: "Subject Assign", icon: UserCheck },
    { id: "timetable",      label: "Timetable",      icon: CalendarDays },
  ] as const;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Sparkles className="w-6 h-6 text-primary-600" />Admin Panel</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Manage your school's classes, subjects, teachers & timetable</p>
      </motion.div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
              tab === id ? "bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-md" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800")}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "classes"        && <ClassesTab key="c" root={root} items={classes} />}
        {tab === "subjects"       && <SubjectsTab key="s" root={root} items={subjects} />}
        {tab === "teachers"       && <TeachersTab key="t" root={root} items={teachers} allClasses={allClasses} allSubjects={allSubjects} allStudents={allStudents} />}
        {tab === "subjectTeachers"&& <SubjectTeachersTab key="st" root={root} allClasses={allClasses} allSubjects={allSubjects} allTeachers={teachers} />}
        {tab === "timetable"      && <TimetableTab key="tt" root={root} items={timetable} allClasses={allClasses} allSubjects={allSubjects} teachers={teachers} />}
      </AnimatePresence>
    </div>
  );
}

const sanitize = (obj: any) => {
  const result: any = {};
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined) result[k] = v; });
  return result;
};

/* ═══ CLASSES ═══════════════════════════════════ */

function ClassesTab({ root, items }: { root: string; items: any[] }) {
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return toast.error("Class name required");
    setBusy(true);
    try {
      const r = push(ref(db, `${root}/classes`));
      await set(r, { name: name.trim(), section: section.trim(), createdAt: Date.now() });
      toast.success("Class added"); setName(""); setSection("");
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };
const del = async (id: string) => {
    if (!confirm("Delete this class?")) return;
    try { await remove(ref(db, `${root}/classes/${id}`)); toast.success("Deleted"); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className={S.card}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Add New Class</h3>
        <div className="flex flex-wrap gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Class name (e.g. Class 10)" className={cn(S.input, "flex-1 min-w-[200px]")} />
          <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section (optional)" className={cn(S.input, "flex-1 min-w-[150px]")} />
          <button onClick={add} disabled={busy} className={S.btnPrimary}><Plus className="w-4 h-4" />Add</button>
        </div>
      </div>

      <div className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800"><h3 className="font-semibold text-gray-900 dark:text-white">All Classes ({items.length})</h3></div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {items.length ? items.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center"><Building2 className="w-5 h-5 text-primary-600" /></div>
                <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.name}</p>{c.section && <p className="text-xs text-gray-500 dark:text-gray-400">Section {c.section}</p>}</div></div>
              <button onClick={() => del(c.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
            </div>
          )) : <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">No classes yet</div>}
        </div>
      </div>
    </motion.div>
  );
}
/* ═══ SUBJECTS ══════════════════════════════════ */
function SubjectsTab({ root, items }: { root: string; items: any[] }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return toast.error("Subject name required");
    setBusy(true);
    try {
      const r = push(ref(db, `${root}/subjects`));
      await set(r, { name: name.trim(), code: code.trim(), createdAt: Date.now() });
      toast.success("Subject added"); setName(""); setCode("");
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this subject?")) return;
    try { await remove(ref(db, `${root}/subjects/${id}`)); toast.success("Deleted"); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className={S.card}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Add New Subject</h3>
        <div className="flex flex-wrap gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Subject name (e.g. Mathematics)" className={cn(S.input, "flex-1 min-w-[200px]")} />
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (optional)" className={cn(S.input, "w-32")} />
          <button onClick={add} disabled={busy} className={S.btnPrimary}><Plus className="w-4 h-4" />Add</button>
        </div>
      </div>

      <div className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800"><h3 className="font-semibold text-gray-900 dark:text-white">All Subjects ({items.length})</h3></div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {items.length ? items.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-accent-600" /></div>
                <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.name}</p>{s.code && <p className="text-xs text-gray-500 dark:text-gray-400">Code: {s.code}</p>}</div></div>
              <button onClick={() => del(s.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
            </div>
          )) : <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">No subjects yet</div>}
        </div>
      </div>
    </motion.div>
  );
}
/* ═══ TEACHERS ══════════════════════════════════ */
function TeachersTab({ root, items, allClasses, allSubjects, allStudents }: { root: string; items: any[]; allClasses: any[]; allSubjects: any[]; allStudents: any[] }) {
  const [editing, setEditing] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [form, setForm] = useState<{ name: string; email: string; phone: string; assignedClasses: string[]; assignedSubjects: string[] }>({ name: "", email: "", phone: "", assignedClasses: [], assignedSubjects: [] });
  const [busy, setBusy] = useState(false);

  const reset = () => { setForm({ name: "", email: "", phone: "", assignedClasses: [], assignedSubjects: [] }); setEditing(null); setShowAdd(false); };

  const openEdit = (t: any) => { setEditing(t); setForm({ name: t.name, email: t.email, phone: t.phone ?? "", assignedClasses: t.assignedClasses ?? [], assignedSubjects: t.assignedSubjects ?? [] }); setShowAdd(true); };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) return toast.error("Name and email required");
    setBusy(true);
    try {
      const data = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        assignedClasses: form.assignedClasses,
        assignedSubjects: form.assignedSubjects,
        status: editing ? (editing.status || "invited") : "invited",   // ✅ FIXED: preserve existing status
        updatedAt: Date.now()
      };
      if (editing) await set(ref(db, `${root}/teachers/${editing.id}`), sanitize({ ...editing, ...data }));
      else { const r = push(ref(db, `${root}/teachers`)); await set(r, sanitize({ ...data, createdAt: Date.now() })); }

      toast.success(editing ? "Teacher updated" : "Teacher invited"); reset();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const del = async (id: string) => {
    if (!confirm("Remove this teacher?")) return;
    try { await remove(ref(db, `${root}/teachers/${id}`)); toast.success("Removed"); }
    catch (e: any) { toast.error(e.message); }
  };

  const toggleIn = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">Add teachers and assign them to classes & subjects. They'll register with the school code.</p>
        <button onClick={() => { reset(); setShowAdd(true); }} className={S.btnPrimary}>Add Teacher</button>
      </div>

      <div className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800"><h3 className="font-semibold text-gray-900 dark:text-white">All Teachers ({items.length})</h3></div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {items.length ? items.map((t) => (
            <div key={t.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white flex items-center justify-center text-sm font-bold shrink-0">{t.name?.charAt(0)?.toUpperCase() || "T"}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{t.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />{t.email}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.assignedClasses?.map((c: string) => <span key={c} className={cn(S.badgeBlue, "text-[10px]")}>{c}</span>)}
                      {t.assignedSubjects?.map((s: string) => <span key={s} className={cn(S.badgePurple, "text-[10px]")}>{s}</span>)}
                      {!t.assignedClasses?.length && !t.assignedSubjects?.length && <span className="text-[10px] text-gray-400 dark:text-gray-500">No assignments</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setViewing(t)} className="px-2.5 py-1 text-xs rounded-lg bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 hover:bg-accent-100 dark:hover:bg-accent-900/40 font-medium">View Students</button>
                  <button onClick={() => openEdit(t)} className="px-2.5 py-1 text-xs rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 font-medium">Edit</button>
                  <button onClick={() => del(t.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          )) : <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">No teachers yet</div>}
        </div>
      </div>
{showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{editing ? "Edit Teacher" : "Add Teacher"}</h3>
              <button onClick={reset} className={cn(S.btnGhost, "p-1")}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={S.input} placeholder="Teacher's full name" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={S.input} placeholder="teacher@school.edu" disabled={!!editing} />
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Teacher must register with this exact email + school code</p></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={S.input} placeholder="Optional" /></div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Assign Classes</label>
                {allClasses.length ? (
                  <div className="flex flex-wrap gap-2">
                    {allClasses.map((c) => {
                      const active = form.assignedClasses.includes(c.name);
                      return (
                        <button key={c.id} onClick={() => setForm({ ...form, assignedClasses: toggleIn(form.assignedClasses, c.name) })}
                          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1",
                            active ? "bg-primary-100 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-400" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700")}>
                          {active && <Check className="w-3 h-3" />}{c.name}
                        </button>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-gray-400 dark:text-gray-500">Add classes first in the Classes tab</p>}
              </div>
<div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Assign Subjects</label>
                {allSubjects.length ? (
                  <div className="flex flex-wrap gap-2">
                    {allSubjects.map((s) => {
                      const active = form.assignedSubjects.includes(s.name);
                      return (
                        <button key={s.id} onClick={() => setForm({ ...form, assignedSubjects: toggleIn(form.assignedSubjects, s.name) })}
                          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1",
                            active ? "bg-accent-100 border-accent-300 text-accent-700 dark:bg-accent-900/30 dark:border-accent-700 dark:text-accent-400" : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700")}>
                          {active && <Check className="w-3 h-3" />}{s.name}
                        </button>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-gray-400 dark:text-gray-500">Add subjects first in the Subjects tab</p>}
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
              <button onClick={reset} className={S.btnSecondary}>Cancel</button>
              <button onClick={save} disabled={busy} className={S.btnPrimary}>{busy ? "Saving…" : editing ? "Update" : "Invite Teacher"}</button>
            </div>
          </motion.div>
        </div>
      )}
 {/* View Students per Teacher (class-wise) */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white flex items-center justify-center text-sm font-bold">{viewing.name?.charAt(0)?.toUpperCase() || "T"}</div>
                <div><h3 className="font-semibold text-gray-900 dark:text-white">{viewing.name}</h3><p className="text-xs text-gray-500 dark:text-gray-400">{viewing.email}</p></div>
              </div>
              <button onClick={() => setViewing(null)} className={cn(S.btnGhost, "p-1")}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-1">
                {viewing.assignedSubjects?.map((s: string) => <span key={s} className={cn(S.badgePurple, "text-[10px]")}>{s}</span>)}
              </div>
              {(viewing.assignedClasses?.length ? viewing.assignedClasses : []).map((cls: string) => {
                const classStudents = allStudents.filter((s: any) => s.class === cls);
                return (
                  <div key={cls} className={cn(S.card, "p-0 overflow-hidden")}>
                    <div className="px-4 py-2.5 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-primary-600" />{cls}</h4>
                      <span className={cn(S.badgeBlue, "text-[10px]")}>{classStudents.length} students</span>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-48 overflow-y-auto">
                      {classStudents.length ? classStudents.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold">{s.rollNo}</div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{s.name}</p>{s.subjects?.length ? <p className="text-[10px] text-gray-400 dark:text-gray-500">{s.subjects.join(", ")}</p> : null}</div>
                        </div>
                      )) : <div className="px-4 py-4 text-center text-xs text-gray-400 dark:text-gray-500">No students in this class yet</div>}
                    </div>
                  </div>
                );
              })}
              {!viewing.assignedClasses?.length && (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">No classes assigned to this teacher yet.<br />Assign classes via Edit or Subject Assign tab.</div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
/* ═══ SUBJECT-TEACHER ASSIGNMENT ══════════════════════ */
function SubjectTeachersTab({ root, allClasses, allSubjects, allTeachers }: { root: string; allClasses: any[]; allSubjects: any[]; allTeachers: any[] }) {
  const [selectedClass, setSelectedClass] = useState("");
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedClass) return;
    const unsub = onValue(ref(db, `${root}/subjectTeachers/${selectedClass}`), (snap) => {
      const d = snap.val();
      if (d) {
        const map: Record<string, string> = {};
        Object.entries(d).forEach(([subj, val]: [string, any]) => { map[subj] = val.teacherUid ?? val; });
        setMappings(map);
      } else { setMappings({}); }
    });
    return () => unsub();
  }, [root, selectedClass]);

  const assign = async (subject: string, teacherUid: string) => {
    if (!selectedClass || !teacherUid) return;
    setBusy(true);
    try {
      // ✅ FIXED: Remove old assignment from previous teacher before assigning new one
      const oldUid = mappings[subject];
      if (oldUid && oldUid !== teacherUid) {
        const oldTeacher = allTeachers.find((t) => t.id === oldUid);
        if (oldTeacher) {
          const newClasses = (oldTeacher.assignedClasses || []).filter((c: string) => c !== selectedClass);
          const newSubjects = (oldTeacher.assignedSubjects || []).filter((s: string) => s !== subject);
          await set(ref(db, `${root}/teachers/${oldUid}`), { ...oldTeacher, assignedClasses: newClasses, assignedSubjects: newSubjects, updatedAt: Date.now() });
        }
      }

      await set(ref(db, `${root}/subjectTeachers/${selectedClass}/${subject}`), { teacherUid });
      const teacher = allTeachers.find((t) => t.id === teacherUid);
      if (teacher) {
        const newClasses = teacher.assignedClasses?.includes(selectedClass) ? teacher.assignedClasses : [...(teacher.assignedClasses || []), selectedClass];
        const newSubjects = teacher.assignedSubjects?.includes(subject) ? teacher.assignedSubjects : [...(teacher.assignedSubjects || []), subject];
        await set(ref(db, `${root}/teachers/${teacherUid}`), sanitize({ ...teacher, assignedClasses: newClasses, assignedSubjects: newSubjects, updatedAt: Date.now() }));
      }
      toast.success(`${subject} assigned`);
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };
const removeAssignment = async (subject: string) => {
    if (!confirm(`Remove ${subject} assignment?`)) return;
    try {
      const oldUid = mappings[subject];
      if (oldUid) {
        const oldTeacher = allTeachers.find((t) => t.id === oldUid);
        if (oldTeacher) {
          const newClasses = (oldTeacher.assignedClasses || []).filter((c: string) => c !== selectedClass);
          const newSubjects = (oldTeacher.assignedSubjects || []).filter((s: string) => s !== subject);
          await set(ref(db, `${root}/teachers/${oldUid}`), { ...oldTeacher, assignedClasses: newClasses, assignedSubjects: newSubjects, updatedAt: Date.now() });
        }
      }
      await remove(ref(db, `${root}/subjectTeachers/${selectedClass}/${subject}`)); toast.success("Removed");
    }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className={S.card}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><UserCheck className="w-4 h-4 text-primary-600" />Assign Teachers to Subjects</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Link each subject to a teacher for each class. Teachers will only see students in their assigned classes/subjects.</p>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className={cn(S.input, "flex-1 py-2")}>
          <option value="">Select Class</option>
          {allClasses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>
{selectedClass && (
        <div className={cn(S.card, "p-0 overflow-hidden")}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800"><h3 className="font-semibold text-gray-900 dark:text-white">{selectedClass} — Subject Assignments</h3></div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {allSubjects.map((s) => {
              const assignedUid = mappings[s.name];
              const assignedTeacher = allTeachers.find((t) => t.id === assignedUid);
              return (
                <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-accent-600" /></div>
                    <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.name}</p>{s.code && <p className="text-xs text-gray-500 dark:text-gray-400">Code: {s.code}</p>}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={assignedUid || ""} onChange={(e) => assign(s.name, e.target.value)} disabled={busy} className={cn(S.input, "py-2 w-48 text-sm")}>
                      <option value="">Select Teacher</option>
                      {allTeachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {assignedTeacher && <button onClick={() => removeAssignment(s.name)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
{!selectedClass && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500"><UserCheck className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Select a class to manage assignments</p></div>
      )}
    </motion.div>
  );
}
/* ═══ TIMETABLE ══════════════════════════════════ */
function TimetableTab({ root, items, allClasses, allSubjects, teachers }: { root: string; items: any[]; allClasses: any[]; allSubjects: any[]; teachers: any[] }) {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const [form, setForm] = useState({ day: "monday", period: "P1", time: "09:00", class: "", subject: "", teacherUid: "", room: "" });
  const [busy, setBusy] = useState(false);
  const [filterDay, setFilterDay] = useState("monday");
const add = async () => {
    if (!form.class || !form.subject) return toast.error("Class and subject required");
    setBusy(true);
    try {
      const r = push(ref(db, `${root}/timetables`));
      await set(r, { ...form, createdAt: Date.now() });
      toast.success("Slot added"); setForm({ ...form, room: "" });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const del = async (id: string) => {
    if (!confirm("Delete slot?")) return;
    try { await remove(ref(db, `${root}/timetables/${id}`)); toast.success("Deleted"); }
    catch (e: any) { toast.error(e.message); }
  };

  const filtered = items.filter((s) => s.day === filterDay).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className={S.card}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Add Timetable Slot</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Day</label>
            <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className={cn(S.input, "py-2")}>
              {days.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Period</label>
            <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className={cn(S.input, "py-2")}>
              {["P1","P2","P3","P4","P5","P6","P7","P8"].map((p) => <option key={p}>{p}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Time</label>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={cn(S.input, "py-2")} /></div>
          <div><label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Class</label>
            <select value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} className={cn(S.input, "py-2")}>
              <option value="">Select</option>{allClasses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Subject</label>
            <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={cn(S.input, "py-2")}>
              <option value="">Select</option>{allSubjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Teacher</label>
            <select value={form.teacherUid} onChange={(e) => setForm({ ...form, teacherUid: e.target.value })} className={cn(S.input, "py-2")}>
              <option value="">Select</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></div>
          <div><label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Room</label>
            <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="e.g. 101" className={cn(S.input, "py-2")} /></div>
          <div className="flex items-end col-span-2 sm:col-span-1">
            <button onClick={add} disabled={busy} className={cn(S.btnPrimary, "w-full")}><Plus className="w-4 h-4" />Add Slot</button>
          </div>
        </div>
      </div>
<div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {days.map((d) => (
          <button key={d} onClick={() => setFilterDay(d)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap capitalize",
              filterDay === d ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400" : "bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700")}>
            {d.slice(0, 3)}
          </button>
        ))}
      </div>

      <div className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800"><h3 className="font-semibold text-gray-900 dark:text-white capitalize">{filterDay} ({filtered.length})</h3></div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {filtered.length ? filtered.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="w-12 text-center"><p className="text-xs text-gray-400 dark:text-gray-500">{s.period}</p><p className="text-sm font-bold text-gray-900 dark:text-gray-100">{s.time}</p></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.subject}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.class} · {teachers.find(t => t.id === s.teacherUid)?.name || s.teacher || "—"} · Room {s.room || "—"}</p>
              </div>
              <button onClick={() => del(s.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
            </div>
          )) : <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">No slots for {filterDay}</div>}
        </div>
      </div>
    </motion.div>
  );
}