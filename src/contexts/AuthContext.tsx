import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  type User,
} from "firebase/auth";
import { ref, onValue, set, push } from "firebase/database";
import { auth, db } from "@/lib/firebase";

/* ── types ──────────────────────────────────────── */
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
  schoolId: string;
  login: (e: string, p: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: "schoolAdmin" | "teacher", schoolId?: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  setupSchool: (schoolName: string) => Promise<string>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileUnsubRef = useRef<(() => void) | null>(null);   // ✅ FIXED: track cleanup

  /* listen to auth + profile */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);

      // ✅ FIXED: clean up previous profile listener before starting a new one
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
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
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => {
      unsub();
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
      }
    };
  }, []);

  /* ── login ─ */
  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  /* ── register ─ */
  const register = async (
    name: string,
    email: string,
    password: string,
    role: "schoolAdmin" | "teacher",
    existingSchoolId?: string,
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    const schoolId = existingSchoolId ?? "";

    if (role === "teacher") {
      await sendEmailVerification(cred.user);
    }

    await set(ref(db, `userProfiles/${uid}`), {
      name,
      email,
      role,
      schoolId,
      createdAt: Date.now(),
    });
  };

  const resendVerification = async () => {
    if (user) {
      await sendEmailVerification(user);
    }
  };

  /* ── setup school (admin creates a new school) ─ */
  const setupSchool = async (schoolName: string): Promise<string> => {
    if (!user || !profile) throw new Error("Not authenticated");
    const uid = user.uid;
    const newSchoolRef = push(ref(db, "schools"));
    const schoolId = newSchoolRef.key!;

    // Write the entire school node in one go so the rules pass
    await set(newSchoolRef, {
      profile: { name: schoolName, createdAt: Date.now() },
      admins: { [uid]: { role: "schoolAdmin", name: profile.name } },
    });

    // Link user to school
    await set(ref(db, `userProfiles/${uid}/schoolId`), schoolId);
    return schoolId;
  };

  const logout = () => signOut(auth);

  const isAdmin = profile?.role === "schoolAdmin";
  const schoolId = profile?.schoolId ?? "";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, schoolId, login, register, resendVerification, setupSchool, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}