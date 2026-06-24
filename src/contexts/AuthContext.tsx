import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  ref,
  set,
  get,
  update,
  onValue,
  push,
  User,
  UserCredential,
  DataSnapshot
} from "../lib/firebase";

// Define strong interfaces for user profiles and roles
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: "teacher" | "schoolAdmin" | "superAdmin";
  schoolId: string;
  phone?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  schoolId: string;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: "teacher" | "schoolAdmin", schoolId?: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setupSchool: (schoolName: string) => Promise<string>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const profileListenerRef = useRef<(() => void) | null>(null);
  const adminListenerRef = useRef<(() => void) | null>(null);

  const loading = loadingProfile || loadingAdmin;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser: User | null) => {
      setUser(currentUser);

      if (profileListenerRef.current) {
        profileListenerRef.current();
        profileListenerRef.current = null;
      }
      if (adminListenerRef.current) {
        adminListenerRef.current();
        adminListenerRef.current = null;
      }

      if (currentUser) {
        setLoadingProfile(true);
        setLoadingAdmin(true);

        const profileRef = ref(db, `userProfiles/${currentUser.uid}`);
        const unsubProfile = onValue(profileRef, (snapshot: DataSnapshot) => {
          const val = snapshot.val();
          if (val) {
            setProfile({
              uid: currentUser.uid,
              name: val.name || currentUser.displayName || "User",
              email: val.email || currentUser.email || "",
              role: val.role || "teacher",
              schoolId: val.schoolId || "",
              phone: val.phone || ""
            });
          } else {
            setProfile(null);
          }
          setLoadingProfile(false);
        }, (error: Error) => {
          console.error("Profile subscription error: ", error);
          setLoadingProfile(false);
        });
        profileListenerRef.current = unsubProfile;

        const superAdminRef = ref(db, `superAdmins/${currentUser.uid}`);
        const unsubAdmin = onValue(superAdminRef, (snapshot: DataSnapshot) => {
          setIsSuperAdmin(snapshot.exists());
          setLoadingAdmin(false);
        }, (error: Error) => {
          console.error("Super Admin verification error: ", error);
          setLoadingAdmin(false);
        });
        adminListenerRef.current = unsubAdmin;

      } else {
        setProfile(null);
        setIsSuperAdmin(false);
        setLoadingProfile(false);
        setLoadingAdmin(false);
      }
    });

    return () => {
      unsubscribe();
      if (profileListenerRef.current) profileListenerRef.current();
      if (adminListenerRef.current) adminListenerRef.current();
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  // ════════════════════════════════════════════════════════════════
  //  FIXED register()
  //  Previous bug: the teacher-invite check did `get(schools/.../teachers)`
  //  BEFORE the user was signed in (auth == null) → Firebase returned
  //  PERMISSION_DENIED. Also the teacher-record link write was fatal.
  //
  //  Fix: create the Auth user FIRST (so reads are authenticated), THEN
  //       verify the invite, THEN write the profile, and make the teacher
  //       record link NON-FATAL so a rules denial never destroys the account.
  // ════════════════════════════════════════════════════════════════
  const register = async (
    name: string,
    email: string,
    password: string,
    role: "teacher" | "schoolAdmin",
    schoolId?: string
  ): Promise<void> => {
    const sId = schoolId ? schoolId.trim() : "";

    // 1) Create the Firebase Auth user FIRST.
    //    After this call the new user is signed in, so all subsequent DB
    //    reads/writes carry a valid auth token (rules see auth != null).
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    const authEmail = userCredential.user.email || email; // must match auth.token.email

    try {
      // Force a token refresh so auth.token.email is populated for the
      // userProfiles write rule (newData.child('email').val() == auth.token.email).
      await userCredential.user.getIdTokenResult(true);

      if (role === "teacher") {
        if (!sId) throw new Error("School ID is required for teachers");

        // 2) Confirm the admin actually added this teacher.
        //    Read runs while signed in now. (Requires teachers list .read = "auth != null".)
        const teachersSnap = await get(ref(db, `schools/${sId}/teachers`));
        const teachersData = teachersSnap.val() || {};
        const teacherExists = Object.values(teachersData).some(
          (t: any) => t && t.email && t.email.toLowerCase() === authEmail.toLowerCase()
        );
        if (!teacherExists) {
          throw new Error(
            "You have not been added as a teacher by the school admin. Please ask your admin to add you first."
          );
        }
      }

      // 3) Write the user profile (rules validate uid/email/role vs the token).
      await set(ref(db, `userProfiles/${uid}`), {
        uid,
        name: name.trim(),
        email: authEmail, // kept EXACTLY as auth.token.email
        role,
        schoolId: sId,
        createdAt: Date.now()
      });

      // 4) Link the new uid back into the admin's teacher record — NON-FATAL.
      //    Only superAdmin/school-admin may write here, so this MAY be denied
      //    by rules for a brand-new teacher. We catch & continue so the
      //    registration still succeeds. (For guaranteed linking, use the
      //    Cloud Function version.)
      if (role === "teacher" && sId) {
        try {
          const teachersSnap = await get(ref(db, `schools/${sId}/teachers`));
          const teachersData = teachersSnap.val() || {};
          for (const [teacherId, teacherData] of Object.entries(teachersData)) {
            if ((teacherData as any)?.email?.toLowerCase() === authEmail.toLowerCase()) {
              await update(ref(db, `schools/${sId}/teachers/${teacherId}`), {
                uid,
                status: "active",
                updatedAt: Date.now()
              });
              break;
            }
          }
        } catch (linkErr: any) {
          console.warn("Teacher record link skipped (rules blocked it):", linkErr?.message);
        }
      }

      // 5) Send verification email for teachers — NON-FATAL.
      if (role === "teacher") {
        try {
          await sendEmailVerification(userCredential.user);
        } catch {
          /* non-fatal */
        }
      }
    } catch (error: any) {
      // Clean up the half-created Auth account so the email is free to retry.
      try {
        await userCredential.user.delete();
      } catch {
        /* ignore */
      }
      throw new Error(error.message || "Failed to create profile");
    }
  };

  const resendVerification = async (): Promise<void> => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
  };

  const setupSchool = async (schoolName: string): Promise<string> => {
    if (!user || !profile) throw new Error("Authentication required");
    if (profile.role !== "schoolAdmin") throw new Error("Only school admins can register a school");
    if (profile.schoolId) throw new Error("You are already associated with a school");

    const schoolsRef = ref(db, "schools");
    const newSchoolRef = push(schoolsRef);
    const randomKey = newSchoolRef.key;

    if (!randomKey) throw new Error("Failed to generate unique school code.");

    await set(newSchoolRef, {
      profile: {
        name: schoolName,
        createdAt: Date.now()
      },
      admins: {
        [user.uid]: {
          role: "schoolAdmin",
          name: profile.name
        }
      }
    });

    await update(ref(db, `userProfiles/${user.uid}`), {
      schoolId: randomKey,
      updatedAt: Date.now()
    });

    return randomKey;
  };

  const logout = (): Promise<void> => {
    return signOut(auth);
  };

  const isAdmin = profile?.role === "schoolAdmin" || isSuperAdmin;
  const schoolId = profile?.schoolId || "";

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isSuperAdmin, schoolId, login, register, resendVerification, resetPassword, setupSchool, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
