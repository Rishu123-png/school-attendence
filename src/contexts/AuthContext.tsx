import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { ref, onValue, set, push, update, get } from "firebase/database";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: "schoolAdmin" | "teacher";
  schoolId: string;
  phone?: string;
}

interface Ctx {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  schoolId: string;
  login: (e: string, p: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: "schoolAdmin" | "teacher", schoolId?: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setupSchool: (schoolName: string) => Promise<string>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const profileUnsubRef = useRef<(() => void) | null>(null);
  const superAdminUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);

      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
      if (superAdminUnsubRef.current) {
        superAdminUnsubRef.current();
        superAdminUnsubRef.current = null;
      }

      if (fbUser) {
        const pRef = ref(db, `userProfiles/${fbUser.uid}`);
        const unsubProfile = onValue(pRef, (snap) => {
          const d = snap.val();
          if (d) {
            setProfile({
              uid: fbUser.uid,
              name: d.name ?? fbUser.displayName ?? "User",
              email: d.email ?? fbUser.email ?? "",
              role: d.role ?? "teacher",
              schoolId: d.schoolId ?? "",
              phone: d.phone,
            });
          } else {
            setProfile(null);
          }
          setLoading(false);
        });
        profileUnsubRef.current = unsubProfile;

        const saRef = ref(db, `superAdmins/${fbUser.uid}`);
        const unsubSuperAdmin = onValue(saRef, (snap) => {
          setIsSuperAdmin(snap.exists());
        });
        superAdminUnsubRef.current = unsubSuperAdmin;
      } else {
        setProfile(null);
        setIsSuperAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      unsub();
      if (profileUnsubRef.current) profileUnsubRef.current();
      if (superAdminUnsubRef.current) superAdminUnsubRef.current();
    };
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    role: "schoolAdmin" | "teacher",
    existingSchoolId?: string,
  ) => {
    const schoolId = existingSchoolId ?? "";

    if (role === "teacher") {
      if (!schoolId.trim()) throw new Error("School ID is required for teachers");
      const schoolSnap = await get(ref(db, `schools/${schoolId}/profile`));
      if (!schoolSnap.exists()) throw new Error("School ID does not exist. Ask your admin for the correct ID.");
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    if (role === "teacher") {
      await sendEmailVerification(cred.user);
    }

    await set(ref(db, `userProfiles/${uid}`), {
      uid,
      name,
      email,
      role,
      schoolId,
      createdAt: Date.now(),
    });
  };

  const resendVerification = async () => {
    if (user) await sendEmailVerification(user);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const setupSchool = async (schoolName: string): Promise<string> => {
    if (!user || !profile) throw new Error("Not authenticated");
    if (profile.role !== "schoolAdmin") throw new Error("Only school admins can create a school");
    if (profile.schoolId) throw new Error("You already have a school");

    const uid = user.uid;
    const newSchoolRef = push(ref(db, "schools"));
    const schoolId = newSchoolRef.key!;

    await set(newSchoolRef, {
      profile: { name: schoolName, createdAt: Date.now() },
      admins: { [uid]: { role: "schoolAdmin", name: profile.name } },
    });

    await update(ref(db, `userProfiles/${uid}`), {
      schoolId,
      updatedAt: Date.now(),
    });

    return schoolId;
  };

  const logout = () => signOut(auth);

  const isAdmin = profile?.role === "schoolAdmin" || isSuperAdmin;
  const schoolId = profile?.schoolId ?? "";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        isSuperAdmin,
        schoolId,
        login,
        register,
        resendVerification,
        resetPassword,
        setupSchool,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
