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
  login: (email: string, password: string) => Promise<UserCredential>;
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

  const login = async (email: string, password: string): Promise<UserCredential> => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    role: "teacher" | "schoolAdmin",
    schoolId?: string
  ): Promise<void> => {
    const sId = schoolId ? schoolId.trim() : "";

    if (role === "teacher") {
      if (!sId) throw new Error("School ID is required for teachers");

      // ✅ FIXED: Check if admin has added this teacher to the school
      const teachersRef = ref(db, `schools/${sId}/teachers`);
      const teachersSnap = await get(teachersRef);

      if (!teachersSnap.exists()) {
        throw new Error("This school has no teachers added yet. Please contact your school admin.");
      }

      const teachersData = teachersSnap.val();
      const teacherExists = Object.values(teachersData).some((t: any) =>
        t && t.email && t.email.toLowerCase() === email.toLowerCase()
      );

      if (!teacherExists) {
        throw new Error("You have not been added as a teacher by the school admin. Please ask your admin to add you first.");
      }
    }

    // ✅ FIXED: Create Firebase Auth user first
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    const authEmail = userCredential.user.email || email.toLowerCase();

    // ✅ FIXED: Wait for email to be available in auth token, then create user profile
    // This ensures auth.token.email is populated for the Firebase rules validation
    try {
      // Force token refresh to ensure email is in the token
      const token = await userCredential.user.getIdTokenResult(true);
      
      // Create user profile with all required fields
      const profileData = {
        uid,
        name: name.trim(),
        email: authEmail,
        role,
        schoolId: sId,
        createdAt: Date.now()
      };

      await set(ref(db, `userProfiles/${uid}`), profileData);

      // ✅ FIXED: If teacher, also update the teacher record in schools with the Firebase UID
      if (role === "teacher" && sId) {
        const teachersRef = ref(db, `schools/${sId}/teachers`);
        const teachersSnap = await get(teachersRef);
        
        if (teachersSnap.exists()) {
          const teachersData = teachersSnap.val();
          // Find the teacher record by email and update it with the Firebase UID
          for (const [teacherId, teacherData] of Object.entries(teachersData)) {
            if ((teacherData as any)?.email?.toLowerCase() === authEmail.toLowerCase()) {
              await update(ref(db, `schools/${sId}/teachers/${teacherId}`), {
                uid: uid,  // Link Firebase Auth UID to teacher record
                status: "active",
                updatedAt: Date.now()
              });
              break;
            }
          }
        }
      }

      // Send verification email for teachers
      if (role === "teacher") {
        await sendEmailVerification(userCredential.user);
      }
    } catch (error: any) {
      // If profile creation fails, delete the auth user to maintain consistency
      try {
        await userCredential.user.delete();
      } catch (deleteError) {
        console.error("Failed to clean up auth user after profile creation error:", deleteError);
      }
      throw new Error(`Failed to create profile: ${error.message}`);
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
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
return context;
}