import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import LoginPage from "@/components/LoginPage";
import SchoolSetup from "@/components/SchoolSetup";
import Layout from "@/components/Layout";
import Dashboard from "@/components/Dashboard";
import AttendancePage from "@/components/AttendancePage";
import MarksPage from "@/components/MarksPage";
import SchedulePage from "@/components/SchedulePage";
import AnnouncementsPage from "@/components/AnnouncementsPage";
import StudentsPage from "@/components/StudentsPage";
import AnalyticsPage from "@/components/AnalyticsPage";
import AdminPanel from "@/components/AdminPanel";
import HolidaysPage from "@/components/HolidaysPage";
import AttendanceReportPage from "@/components/AttendanceReportPage";
import LeaderboardPage from "@/components/LeaderboardPage";
import TopBunkersPage from "@/components/TopBunkersPage";
import AlertsPage from "@/components/AlertsPage";
import StudentProfilePage from "@/components/StudentProfilePage";

/* ── Loading screen ─────────────────────────────── */
function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 shadow-lg shadow-primary-200 mx-auto animate-pulse-soft">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" /></svg>
        </div>
        <p className="text-gray-500 text-sm animate-pulse">Loading School OS…</p>
      </div>
    </div>
  );
}

/* ── Pending teacher approval screen ────────────── */
function PendingApproval() {
  const { logout, profile } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 p-4">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg mb-2">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Awaiting Admin Approval</h1>
          <p className="text-gray-500 text-sm">Your account (<span className="font-medium text-gray-700">{profile?.email}</span>) is registered, but your school admin hasn't added you to the teacher list yet.</p>
          <p className="text-gray-400 text-xs mt-4">Ask your admin to add a teacher with this exact email in the Admin Panel → Teachers.</p>
        </div>
        <button onClick={logout} className="text-sm text-primary-600 font-medium hover:underline">Sign out</button>
      </div>
    </div>
  );
}

/* ── Protected wrapper with teacher gating ─────── */
function ProtectedRoute() {
  const { user, profile, loading, schoolId, isAdmin } = useAuth();
  const { currentTeacher, teachers, loading: dataLoading } = useSchoolData();

  if (loading) return <Splash />;
  if (!user) return <Navigate to="/" replace />;
  // User logged in but no school linked → setup flow
  if (profile && !schoolId) return <SchoolSetup />;
  // Teacher gate: admin must have invited this teacher's email
  if (!isAdmin) {
    if (dataLoading) return <Splash />;
    // Only block when school clearly has at least one teacher and we're not in the list.
    if (teachers.length > 0 && !currentTeacher) return <PendingApproval />;
  }
  return <Outlet />;
}

/* ── Routes ─────────────────────────────────────── */
function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<NotificationProvider><Layout /></NotificationProvider>}>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { borderRadius: "12px", background: "#fff", color: "#1f2937", boxShadow: "0 4px 12px rgba(0,0,0,.08)", border: "1px solid #e5e7eb", fontSize: "14px" },
            success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
            error:   { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
          }}
        />
      </AuthProvider>
    </HashRouter>
  );
}
