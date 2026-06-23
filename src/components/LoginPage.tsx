import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, Building2, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { S } from "@/lib/styles";
import { cn } from "@/lib/cn";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login, register, resetPassword } = useAuth();
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
        if (role === "teacher" && !sid) {
          toast.error("School ID is required for teachers");
          setBusy(false);
          return;
        }
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          setBusy(false);
          return;
        }
        await register(name, email, password, role, sid);
        toast.success(
          role === "teacher"
            ? "Account created! Please check your email to verify your identity."
            : "Account created! 🎉",
        );
      }
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Auth error:", err);
      const msg =
        err.code === "auth/user-not-found"
          ? "No account with this email. Please register first."
          : err.code === "auth/wrong-password"
          ? "Incorrect password"
          : err.code === "auth/email-already-in-use"
          ? "This email is already registered. Try logging in instead."
          : err.code === "auth/invalid-credential"
          ? "Invalid email or password. If you just registered, try logging in."
          : err.code === "auth/invalid-email"
          ? "Invalid email address"
          : err.code === "auth/too-many-requests"
          ? "Too many attempts, try later"
          : err.code === "auth/weak-password"
          ? "Password must be at least 6 characters"
          : err.message || "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first");
      return;
    }
    try {
      await resetPassword(email.trim());
      toast.success("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-200 dark:shadow-primary-900/30 mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">School OS</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Smart Education Management Platform</p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <>
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={S.input}
                    placeholder="Your full name"
                    required
                  />
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole("teacher")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all",
                        role === "teacher"
                          ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-500"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800",
                      )}
                    >
                      <UserCheck className="w-4 h-4" />
                      Teacher
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("schoolAdmin")}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all",
                        role === "schoolAdmin"
                          ? "border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-900/20 dark:text-accent-400 dark:border-accent-500"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800",
                      )}
                    >
                      <Building2 className="w-4 h-4" />
                      School Admin
                    </button>
                  </div>
                </div>

                {/* School Code for Teacher */}
                {role === "teacher" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">School ID</label>
                    <input
                      type="text"
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value)}
                      className={S.input}
                      placeholder="Enter School ID from your admin"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">Ask your school admin for the School ID.</p>
                  </div>
                )}
              </>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(S.input, "pl-9")}
                  placeholder="you@school.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(S.input, "pl-9 pr-10")}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "register" && (
                <p className="text-xs text-gray-400 mt-1">Minimum 6 characters</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className={cn(S.btnPrimary, "w-full")}
            >
              {busy ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </>
              ) : (
                <>
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Forgot Password */}
          {mode === "login" && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-primary-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Toggle Mode */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-primary-600 font-medium hover:underline"
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </div>
        </div>

        {/* Helper text */}
        {mode === "register" && role === "teacher" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800"
          >
            <p className="text-xs text-primary-700 dark:text-primary-300">
              <strong>📌 Important:</strong> Your school admin must first add you as a teacher in the Admin Panel before you can register. Use the <strong>exact same email</strong> and <strong>School ID</strong> provided by your admin.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
