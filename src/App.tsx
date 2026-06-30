import { useState, Suspense, lazy } from "react";
import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { DarkModeInitializer } from "@/components/DarkModeInitializer";
import AppUpdateToast from "@/components/AppUpdateToast";

// Lazy Loaded Routes for Perfect Code-Splitting
const LoginPage = lazy(() => import("@/components/LoginPage"));
const SchoolSetup = lazy(() => import("@/components/SchoolSetup"));
const Layout = lazy(() => import("@/components/Layout"));
const Dashboard = lazy(() => import("@/components/Dashboard"));
const AttendancePage = lazy(() => import("@/components/AttendancePage"));
const MarksPage = lazy(() => import("@/components/MarksPage"));
const SchedulePage = lazy(() => import("@/components/SchedulePage"));
const AnnouncementsPage = lazy(() => import("@/components/AnnouncementsPage"));
const StudentsPage = lazy(() => import("@/components/StudentsPage"));
const AnalyticsPage = lazy(() => import("@/components/AnalyticsPage"));
const AdminPanel = lazy(() => import("@/components/AdminPanel"));
const HolidaysPage = lazy(() => import("@/components/HolidaysPage"));
const AttendanceReportPage = lazy(() => import("@/components/AttendanceReportPage"));
const LeaderboardPage = lazy(() => import("@/components/LeaderboardPage"));
const TopBunkersPage = lazy(() => import("@/components/TopBunkersPage"));
const AlertsPage = lazy(() => import("@/components/AlertsPage"));
const StudentProfilePage = lazy(() => import("@/components/StudentProfilePage"));
const SuperAdminPanel = lazy(() => import("@/components/SuperAdminPanel"));

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 shadow-lg shadow-primary-200 mx-auto animate-pulse-soft">
          <svg
            className="w-8 h-8 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
          </svg>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm animate-pulse">
          Loading School OS…
        </p>
      </div>
    </div>
  );
}

function PendingApproval() {
  const { logout, profile } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg mb-2">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Awaiting Admin Approval
          </h1>
          <p className="text-gray-500 text-sm">
            Your account{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {profile?.email}
            </span>{" "}
            is registered, but your school admin has not added you to the teacher list yet.
          </p>
          <p className="text-gray-400 text-xs mt-4">
            Ask your admin to add a teacher with this exact email in the Admin Panel → Teachers.
          </p>
        </div>

        <button
          onClick={logout}
          className="text-sm text-primary-600 font-medium hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function PendingEmailVerification() {
  const { logout, user, resendVerification } = useAuth();
  const [sent, setSent] = useState(false);

  const resend = async () => {
    if (!user) return;

    try {
      await resendVerification();
      setSent(true);
      toast.success("Verification email resent!");
    } catch (e: any) {
      toast.error(e.message || "Failed to resend");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg mb-2">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Verify Your Email
          </h1>
          <p className="text-gray-500 text-sm">
            For security, we sent a verification link to{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {user?.email}
            </span>
            .
          </p>
          <p className="text-gray-400 text-xs mt-4">
            Please check your inbox and spam folder. Once verified, click the button below to continue.
          </p>
        </div>

        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 bg-primary-600 text-white rounded-xl font-medium shadow hover:bg-primary-700 transition-colors"
          >
            I have Verified, Refresh
          </button>

          <button
            onClick={resend}
            disabled={sent}
            className="text-sm text-gray-600 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            {sent ? "Email Sent!" : "Resend Link"}
          </button>
        </div>

        <button
          onClick={logout}
          className="text-sm text-red-500 font-medium hover:underline mt-4"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const { user, profile, loading, schoolId, isAdmin, isSuperAdmin } = useAuth();
  const { currentTeacher } = useSchoolData();

  if (loading) return <Splash />;
  if (!user) return <Navigate to="/" replace />;

  if (profile?.role === "teacher" && !user.emailVerified) {
    return <PendingEmailVerification />;
  }

  if (!isSuperAdmin && profile && !schoolId) {
    return <SchoolSetup />;
  }

  if (!isAdmin && !isSuperAdmin && !currentTeacher) {
    return <PendingApproval />;
  }

  return <Outlet />;
}

function SuperAdminRoute() {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) return <Splash />;
  if (!user) return <Navigate to="/" replace />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <Splash />;

  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />

        <Route element={<ProtectedRoute />}>
          <Route
            element={
              <NotificationProvider>
                <Layout />
              </NotificationProvider>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/marks" element={<MarksPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/holidays" element={<HolidaysPage />} />
            <Route path="/report" element={<AttendanceReportPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/bunkers" element={<TopBunkersPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/student-profile" element={<StudentProfilePage />} />
          </Route>
        </Route>

        <Route element={<SuperAdminRoute />}>
          <Route path="/super-admin" element={<SuperAdminPanel />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <DarkModeInitializer />
        <AppRoutes />
        <AppUpdateToast />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: "12px",
              background: "#fff",
              color: "#1f2937",
              boxShadow: "0 4px 12px rgba(0,0,0,.08)",
              border: "1px solid #e5e7eb",
              fontSize: "14px"
            },
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#fff"
              }
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#fff"
              }
            }
          }}
        />
      </AuthProvider>
    </HashRouter>
  );
}
