import { useEffect, useState, useMemo } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";

export interface SchoolSummary {
  id: string;
  name: string;
  createdAt: number;
  adminCount: number;
  teacherCount: number;
  studentCount: number;
  classCount: number;
  subjectCount: number;
}

export interface UserSummary {
  uid: string;
  name: string;
  email: string;
  role: "schoolAdmin" | "teacher" | string;
  schoolId: string;
  schoolName: string;
  phone?: string;
}

export function useSuperAdmin() {
  const [rawSchools, setRawSchools] = useState<any>(null);
  const [rawUsers, setRawUsers] = useState<any>(null);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loading = loadingSchools || loadingUsers;

  useEffect(() => {
    setLoadingSchools(true);
    setLoadingUsers(true);
    setError(null);

    const schoolsRef = ref(db, "schools");
    const usersRef = ref(db, "userProfiles");

    const unsubSchools = onValue(schoolsRef, (snap) => {
      setRawSchools(snap.val() ?? {});
      setLoadingSchools(false);
    });

    const unsubUsers = onValue(usersRef, (snap) => {
      setRawUsers(snap.val() ?? {});
      setLoadingUsers(false);
    });

    return () => {
      unsubSchools();
      unsubUsers();
    };
  }, []);

  const schools: SchoolSummary[] = useMemo(() => {
    if (!rawSchools) return [];
    return Object.entries(rawSchools).map(([id, data]: [string, any]) => {
      const admins = data?.admins ? Object.keys(data.admins) : [];
      const teachers = data?.teachers ? Object.keys(data.teachers) : [];
      const students = data?.students ? Object.keys(data.students) : [];
      const classes = data?.classes ? Object.keys(data.classes) : [];
      const subjects = data?.subjects ? Object.keys(data.subjects) : [];
      return {
        id,
        name: data?.profile?.name || "Unnamed School",
        createdAt: data?.profile?.createdAt || 0,
        adminCount: admins.length,
        teacherCount: teachers.length,
        studentCount: students.length,
        classCount: classes.length,
        subjectCount: subjects.length,
      };
    });
  }, [rawSchools]);

  const schoolNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    schools.forEach((s) => (map[s.id] = s.name));
    return map;
  }, [schools]);

  const users: UserSummary[] = useMemo(() => {
    if (!rawUsers) return [];
    return Object.entries(rawUsers).map(([uid, data]: [string, any]) => ({
      uid,
      name: data?.name || "—",
      email: data?.email || "—",
      role: data?.role || "—",
      schoolId: data?.schoolId || "—",
      schoolName: schoolNameMap[data?.schoolId] || "No school",
      phone: data?.phone,
    }));
  }, [rawUsers, schoolNameMap]);

  const totals = useMemo(() => {
    return {
      totalSchools: schools.length,
      totalUsers: users.length,
      totalAdmins: users.filter((u) => u.role === "schoolAdmin").length,
      totalTeachers: users.filter((u) => u.role === "teacher").length,
      totalStudents: schools.reduce((sum, s) => sum + s.studentCount, 0),
    };
  }, [schools, users]);

  return { schools, users, totals, loading, error };
}