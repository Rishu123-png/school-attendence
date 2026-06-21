import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, Building2, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { S } from "@/lib/styles";
import { cn } from "@/lib/cn";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"schoolAdmin" | "teacher">("teacher");
  const [schoolCode, setSchoolCode] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Welcome back! 👋");
      } else {
        const sid = role === "teacher" ? schoolCode.trim() : undefined;
        if (role === "teacher" && !sid) { toast.error("School ID is required for teachers"); setBusy(false); return; }
        await register(name, email, password, role, sid);
        toast.success("Account created! 🎉");
      }
      navigate("/dashboard");
    } catch (err: any) {
      const msg =
        err.code === "auth/user-not-found" ? "No account with this email" :
        err.code === "auth/wrong-password" ? "Incorrect password" :
        err.code === "auth/email-already-in-use" ? "Email already registered" :
        err.code === "auth/invalid-credential" ? "Invalid email or password" :
        err.code === "auth/invalid-email" ? "Invalid email address" :
        err.code === "auth/too-many-requests" ? "Too many attempts, try later" :
        err.code === "auth/weak-password" ? "Password must be at least 6 characters" :
        err.message || "Something went wrong";
      toast.error(msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary-200/30 rounded-full blur-3xl" />
        <div className="absolute top-40 -right-20 w-80 h-80 bg-accent-200/30 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 shadow-lg mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">School OS</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Smart Education Management Platform</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{mode === "login" ? "Welcome Back" : "Create Account"}</h2>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={S.input} placeholder="Your full name" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setRole("teacher")}
                      className={cn("flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all",
                        role === "teacher" ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-500" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800")}>
                      <UserCheck className="w-4 h-4" />Teacher
                    </button>
                    <button type="button" onClick={() => setRole("schoolAdmin")}
                      className={cn("flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all",
                        role === "schoolAdmin" ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-900/20 dark:text-accent-400 dark:border-accent-500" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800")}>
                      <Building2 className="w-4 h-4" />School Admin
                    </button>
                  </div>
                </div>

                {role === "teacher" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">School ID</label>
                    <input value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} className={S.input} placeholder="Enter School ID from your admin" required />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Ask your school admin for the School ID. You must also be invited with this exact email in Admin Panel → Teachers.</p>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={cn(S.input, "pl-10")} placeholder="teacher@school.edu" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className={cn(S.input, "pl-10 pr-10")} placeholder="••••••••" required minLength={6} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={busy} className={cn(S.btnPrimary, "w-full")}>
              {busy ? "Processing…" : <>{mode === "login" ? "Sign In" : "Create Account"}<ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-primary-600 font-semibold hover:underline">
              {mode === "login" ? "Register" : "Sign In"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

