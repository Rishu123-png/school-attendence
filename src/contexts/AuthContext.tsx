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

      // Clear previous database listeners
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

        // 1. Listen to Realtime Database User Profile
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

        // 2. Listen to Super Admin status
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

      const schoolRef = ref(db, `schools/${sId}/profile`);
      const schoolSnap = await get(schoolRef);
      if (!schoolSnap.exists()) {
        throw new Error("School ID does not exist. Please check with your administrator.");
      }
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    if (role === "teacher") {
      await sendEmailVerification(userCredential.user);
    }

    await set(ref(db, `userProfiles/${uid}`), {
      uid,
      name,
      email,
      role,
      schoolId: sId,
      createdAt: Date.now()
    });
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

    // Create school structure
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

    // Update admin user profile with the new school ID
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
