import { useState, type ElementType } from "react";
import { motion } from "framer-motion";
import { Shield, Building2, Users, GraduationCap, Key, Search, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSuperAdmin, type SchoolSummary, type UserSummary } from "@/hooks/useSuperAdmin";
import { S } from "@/lib/styles";
import { cn } from "@/lib/cn";
import toast from "react-hot-toast";

export default function SuperAdminPanel() {
  const { resetPassword } = useAuth();
  const { schools, users, totals, loading, error } = useSuperAdmin();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sendingReset, setSendingReset] = useState<string | null>(null);

  const filteredUsers: UserSummary[] = users.filter(
    (u: UserSummary) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.schoolName.toLowerCase().includes(search.toLowerCase()) ||
      u.uid.toLowerCase().includes(search.toLowerCase()),
  );

  const handleResetPassword = async (email: string) => {
    setSendingReset(email);
    try {
      await resetPassword(email);
      toast.success(`Password reset email sent to ${email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setSendingReset(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading super admin dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <p className="text-red-600 font-medium">Error loading dashboard</p>
          <p className="text-gray-500 text-sm mt-2">{error}</p>
          <button onClick={() => navigate("/dashboard")} className={cn(S.btnSecondary, "mt-4")}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-7 h-7 text-primary-600" /> Super Admin Panel
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Overview of all schools, teachers, and users</p>
          </div>
          <button onClick={() => navigate("/dashboard")} className={S.btnSecondary}>
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={Building2} label="Schools" value={totals.totalSchools} color="primary" />
          <StatCard icon={Users} label="Users" value={totals.totalUsers} color="accent" />
          <StatCard icon={Shield} label="Admins" value={totals.totalAdmins} color="blue" />
          <StatCard icon={GraduationCap} label="Teachers" value={totals.totalTeachers} color="green" />
          <StatCard icon={Users} label="Students" value={totals.totalStudents} color="purple" />
        </div>

        <div className={cn(S.card, "overflow-hidden")}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Schools</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3">School Name</th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Admins</th>
                  <th className="px-4 py-3">Teachers</th>
                  <th className="px-4 py-3">Students</th>
                  <th className="px-4 py-3">Classes</th>
                  <th className="px-4 py-3">Subjects</th>
                </tr>
              </thead>
              <tbody>
                {schools.length ? (
                  schools.map((s: SchoolSummary) => (
                    <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.id}</td>
                      <td className="px-4 py-3">{s.adminCount}</td>
                      <td className="px-4 py-3">{s.teacherCount}</td>
                      <td className="px-4 py-3">{s.studentCount}</td>
                      <td className="px-4 py-3">{s.classCount}</td>
                      <td className="px-4 py-3">{s.subjectCount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                      No schools yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cn(S.card, "overflow-hidden")}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">All Users</h2>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users or schools…"
                className={cn(S.input, "pl-9 py-2")}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">UID</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length ? (
                  filteredUsers.map((u: UserSummary) => (
                    <tr key={u.uid} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            u.role === "schoolAdmin"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                          )}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">{u.schoolName}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.uid}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleResetPassword(u.email)}
                          disabled={sendingReset === u.email}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline disabled:opacity-50"
                        >
                          <Key className="w-3.5 h-3.5" />
                          {sendingReset === u.email ? "Sending…" : "Reset password"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            * Passwords are never stored or visible. Clicking “Reset password” sends a password-reset email to the user.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: ElementType;
  label: string;
  value: number;
  color: "primary" | "accent" | "blue" | "green" | "purple";
}) {
  const colors = {
    primary: "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400",
    accent: "bg-accent-50 text-accent-700 dark:bg-accent-900/20 dark:text-accent-400",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    green: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
    purple: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn(S.card, "text-center")}>
      <div className={cn("inline-flex items-center justify-center w-10 h-10 rounded-xl mb-2", colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </motion.div>
  );
}