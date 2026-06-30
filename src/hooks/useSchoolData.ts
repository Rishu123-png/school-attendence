// src/hooks/useSchoolData.ts
import { useEffect, useState, useMemo } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface ClassItem { id: string; name: string; section?: string }
export interface SubjectItem { id: string; name: string; code?: string }
export interface StudentItem { id: string; name: string; rollNo: number; class: string; section?: string; email?: string; phone?: string; parentName?: string; parentPhone?: string; subjects?: string[] }
export interface SlotItem { id: string; day: string; period: string; time: string; class: string; subject: string; teacher: string; teacherUid: string; room: string; type?: string; classId?: string; subjectId?: string; teacherId?: string }
export interface TeacherItem { id: string; name: string; email: string; phone?: string; status: "invited" | "active"; assignedClasses?: string[]; assignedSubjects?: string[] }

export function useSchoolData() {
  const { schoolId, profile } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [timetable, setTimetable] = useState<SlotItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) { setClasses([]); setSubjects([]); setStudents([]); setTimetable([]); setTeachers([]); setLoading(false); return; }
    setLoading(true);
    const root = `schools/${schoolId}`;
    const unsubs: (() => void)[] = [];

    unsubs.push(onValue(ref(db, `${root}/classes`), (snap) => {
      const d = snap.val();
      setClasses(d ? Object.entries(d).map(([id, v]: [string, any]) => ({ id, name: v.name ?? id, section: v.section })) : []);
    }, (err) => { console.error("Classes listener error:", err); }));

    unsubs.push(onValue(ref(db, `${root}/subjects`), (snap) => {
      const d = snap.val();
      setSubjects(d ? Object.entries(d).map(([id, v]: [string, any]) => ({ id, name: v.name ?? id, code: v.code })) : []);
    }, (err) => { console.error("Subjects listener error:", err); }));

    unsubs.push(onValue(ref(db, `${root}/students`), (snap) => {
      const d = snap.val();
      setStudents(d ? Object.entries(d).map(([id, v]: [string, any]) => ({
        id, name: v.name ?? "—", rollNo: v.rollNo ?? 0, class: v.class ?? "", section: v.section,
        email: v.email, phone: v.phone, parentName: v.parentName, parentPhone: v.parentPhone,
        subjects: v.subjects ?? []
      })).sort((a, b) => a.rollNo - b.rollNo) : []);
    }, (err) => { console.error("Students listener error:", err); }));

    unsubs.push(onValue(ref(db, `${root}/timetables`), (snap) => {
      const d = snap.val();
      setTimetable(d ? Object.entries(d).map(([id, v]: [string, any]) => ({
        id,
        day: v.day ?? "",
        period: v.period ?? "",
        time: v.time ?? "09:00",
        class: v.class ?? v.classId ?? "",
        subject: v.subject ?? v.subjectId ?? "",
        teacher: v.teacher ?? v.teacherId ?? "",
        teacherUid: v.teacherUid ?? v.teacherId ?? "",
        room: v.room ?? "101",
        type: v.type ?? "Lecture",
        classId: v.classId ?? "",
        subjectId: v.subjectId ?? "",
        teacherId: v.teacherId ?? v.teacher ?? v.teacherUid ?? ""
      })) : []);
    }, (err) => { console.error("Timetable listener error:", err); }));

    unsubs.push(onValue(ref(db, `${root}/teachers`), (snap) => {
      const d = snap.val();
      setTeachers(d ? Object.entries(d).map(([id, v]: [string, any]) => ({
        id, name: v.name ?? "", email: (v.email ?? "").toLowerCase(), phone: v.phone,
        status: v.status ?? "invited", assignedClasses: v.assignedClasses ?? [], assignedSubjects: v.assignedSubjects ?? []
      })) : []);
      setLoading(false);
    }, (err) => { console.error("Teachers listener error:", err); setLoading(false); }));

    return () => unsubs.forEach((u) => u());
  }, [schoolId]);

  const currentTeacher = useMemo(() => {
    if (!profile?.email) return undefined;
    return teachers.find((t) => t.email === profile.email.toLowerCase());
  }, [teachers, profile?.email]);

  const isAdmin = profile?.role === "schoolAdmin";

  const visibleClasses = useMemo(() => {
    if (isAdmin) return classes;
    if (!currentTeacher?.assignedClasses?.length) return [];
    return classes.filter((c) => currentTeacher.assignedClasses!.includes(c.name));
  }, [classes, currentTeacher, isAdmin]);

  const visibleSubjects = useMemo(() => {
    if (isAdmin) return subjects;
    if (!currentTeacher?.assignedSubjects?.length) return [];
    return subjects.filter((s) => currentTeacher.assignedSubjects!.includes(s.name));
  }, [subjects, currentTeacher, isAdmin]);

  const visibleStudents = useMemo(() => {
    if (isAdmin) return students;
    if (!currentTeacher?.assignedClasses?.length) return [];
    return students.filter((s) => currentTeacher.assignedClasses!.includes(s.class));
  }, [students, currentTeacher, isAdmin]);

  const visibleTimetable = useMemo(() => {
    if (isAdmin) return timetable;
    if (!currentTeacher) return [];
    return timetable.filter((slot) => slot.teacherUid === currentTeacher.id);
  }, [timetable, currentTeacher, isAdmin]);

  return {
    classes: visibleClasses,
    subjects: visibleSubjects,
    students: visibleStudents,
    timetable: visibleTimetable,
    teachers,
    currentTeacher,
    allClasses: classes,
    allSubjects: subjects,
    allStudents: students,
    allTimetable: timetable,
    loading,
  };
}
