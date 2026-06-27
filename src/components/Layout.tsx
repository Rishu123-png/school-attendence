import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  GraduationCap,
  ClipboardCheck,
  BarChart3,
  Bell,
  Menu,
  LogOut,
  User,
  ChevronDown,
  Sparkles,
  BookOpen,
  CalendarDays,
  Megaphone,
  Users,
  Copy,
  Check,
  FileText,
  Trophy,
  UserX,
  PartyPopper,
  UserSearch,
  X,
  Moon,
  Sun,
  PlusCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useDarkMode } from "@/hooks/useDarkMode";
import { cn } from "@/lib/cn";
import PageBackdrop from "@/components/PageBackdrop";

interface NavItem { path: string; label: string; icon: any; adminOnly?: boolean }
interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Teaching",
    items: [
      { path: "/dashboard", label: "Home", icon: Home },
      { path: "/attendance", label: "Attendance", icon: ClipboardCheck },
      { path: "/marks", label: "Marks", icon: BookOpen },
      { path: "/schedule", label: "Schedule", icon: CalendarDays },
      { path: "/students", label: "Students", icon: Users },
      { path: "/student-profile", label: "Student Profile", icon: UserSearch },
    ],
  },
  {
    label: "Reports & Insights",
    items: [
      { path: "/analytics", label: "Analytics", icon: BarChart3 },
      { path: "/report", label: "Attendance Report", icon: FileText },
      { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
      { path: "/bunkers", label: "Top Bunkers", icon: UserX },
    ],
  },
  {
    label: "Communication",
    items: [
      { path: "/announcements", label: "Announcements", icon: Megaphone },
      { path: "/alerts", label: "Alerts", icon: Bell },
      { path: "/holidays", label: "Holidays", icon: PartyPopper },
    ],
  },
  {
    label: "Administration",
    items: [
      { path: "/admin", label: "Admin Panel", icon: Sparkles, adminOnly: true },
    ],
  },
];

const MOBILE_NAV = [
  { path: "/dashboard", label: "Home", icon: Home },
  { path: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { path: "/marks", label: "Marks", icon: BookOpen },
  { path: "/announcements", label: "Updates", icon: Megaphone },
  { path: "/analytics", label: "Insights", icon: BarChart3 },
];

export default function Layout() {
  const { profile, logout, isAdmin, schoolId } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, dismiss, clearAll } = useNotifications();
  const { isDark, toggle } = useDarkMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebar, setSidebar] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const notifStyle = (kind: string) => {
    switch (kind) {
      case "late-alert": return { dot: "bg-red-500", bg: "bg-red-50/40 dark:bg-red-900/20" };
      case "reminder": return { dot: "bg-primary-500", bg: "bg-primary-50/40 dark:bg-primary-900/20" };
      case "announcement": return { dot: "bg-accent-500", bg: "bg-accent-50/40 dark:bg-accent-900/20" };
      default: return { dot: "bg-gray-400", bg: "bg-gray-50/40" };
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const copySchoolCode = () => {
    navigator.clipboard.writeText(schoolId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let currentLabel = "Dashboard";
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => i.path === location.pathname);
    if (item) {
      currentLabel = item.label;
      break;
    }
  }

  return (
    <div className={cn("flex h-screen", isDark ? "bg-gray-950" : "bg-gray-50")}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r shadow-sm transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
          sidebar ? "translate-x-0" : "-translate-x-full",
          isDark ? "bg-gray-900/95 border-gray-800" : "bg-white/95 border-gray-100",
        )}
      >
        <div className="flex h-full flex-col backdrop-blur-xl">
          <div className={cn("flex items-center gap-3 border-b px-6 py-5", isDark ? "border-gray-800" : "border-gray-100")}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 shadow-lg shadow-primary-200 dark:shadow-primary-900/30">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className={cn("text-lg font-bold", isDark ? "text-white" : "text-gray-900")}>School OS</h1>
              <p className="text-[10px] text-gray-400">Smart Education Hub</p>
            </div>
          </div>

          <nav className="scrollbar-hide flex-1 space-y-4 overflow-y-auto px-3 py-3">
            {NAV_GROUPS.map((group) => {
              const items = group.items.filter((i) => !i.adminOnly || isAdmin);
              if (!items.length) return null;
              return (
                <div key={group.label}>
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group.label}</p>
                  <div className="mt-1 space-y-0.5">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          onClick={() => { navigate(item.path); setSidebar(false); }}
                          className={cn(
                            "relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                            active
                              ? "bg-gradient-to-r from-primary-50 to-primary-100/50 text-primary-700 shadow-sm dark:from-primary-900/30 dark:to-primary-800/20 dark:text-primary-400"
                              : isDark
                                ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                          )}
                        >
                          <Icon className={cn("h-4 w-4", active && "text-primary-600")} />
                          <span>{item.label}</span>
                          {active && <motion.div layoutId="sidebar-dot" className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {isAdmin && schoolId && (
            <div className={cn("border-t px-4 py-3", isDark ? "border-gray-800" : "border-gray-100")}>
              <p className="mb-1 text-[10px] text-gray-400">School Code (share with teachers)</p>
              <button
                onClick={copySchoolCode}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xs transition-colors",
                  isDark ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-50 text-gray-700 hover:bg-gray-100",
                )}
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                <span className="truncate">{schoolId}</span>
              </button>
            </div>
          )}

          <div className={cn("border-t p-4", isDark ? "border-gray-800" : "border-gray-100")}>
            <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2", isDark ? "bg-gray-800" : "bg-gray-50")}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-sm font-semibold text-white">
                {profile?.name?.charAt(0) ?? "T"}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>{profile?.name ?? "User"}</p>
                <p className="text-[10px] capitalize text-gray-500">{profile?.role === "schoolAdmin" ? "Admin" : "Teacher"}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {sidebar && <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebar(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={cn("sticky top-0 z-30 border-b shadow-sm backdrop-blur-lg", isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/80 border-gray-100")}>
          <div className="flex h-14 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebar(true)} className={cn("rounded-xl p-2 lg:hidden", isDark ? "text-gray-400 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100")}><Menu className="h-5 w-5" /></button>
              <span className={cn("hidden text-sm font-medium sm:block", isDark ? "text-gray-300" : "text-gray-700")}>{currentLabel}</span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={toggle} className={cn("rounded-xl p-2 transition-colors", isDark ? "text-yellow-400 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100")}>
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div className="relative">
                <button onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); if (!notifOpen) markAllRead(); }} className={cn("relative rounded-xl p-2", isDark ? "text-gray-400 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100")}>
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                </button>

                <AnimatePresence>
                  {notifOpen && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} className={cn("absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl shadow-xl", isDark ? "bg-gray-900 border border-gray-700" : "bg-white border border-gray-100")}>
                      <div className={cn("flex items-center justify-between border-b p-4", isDark ? "border-gray-700" : "border-gray-100")}>
                        <h3 className={cn("flex items-center gap-2 font-semibold", isDark ? "text-white" : "text-gray-900")}><Bell className="h-4 w-4 text-primary-600" />Notifications</h3>
                        {notifications.length > 0 && <button onClick={clearAll} className="text-xs text-red-500 hover:underline">Clear all</button>}
                      </div>
                      <div className="max-h-96 divide-y divide-gray-50 overflow-y-auto dark:divide-gray-800">
                        {notifications.length ? notifications.map((n) => {
                          const st = notifStyle(n.kind);
                          return (
                            <div key={n.id} className={cn("flex items-start gap-3 px-4 py-3 transition-colors", !n.read && st.bg)}>
                              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", st.dot)} />
                              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => markRead(n.id)}>
                                <p className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>{n.title}</p>
                                <p className={cn("mt-0.5 text-xs", isDark ? "text-gray-400" : "text-gray-600")}>{n.message}</p>
                                <p className="mt-1 text-[10px] text-gray-500">{timeAgo(n.timestamp)}</p>
                              </div>
                              <button onClick={() => dismiss(n.id)} className="shrink-0 rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          );
                        }) : (
                          <div className="py-10 text-center text-gray-400"><Bell className="mx-auto mb-2 h-9 w-9 opacity-40" /><p className="text-sm">No notifications</p><p className="mt-1 text-[11px]">Class reminders & alerts appear here</p></div>
                        )}
                      </div>
                      <div className={cn("border-t p-2", isDark ? "border-gray-700" : "border-gray-100")}>
                        <button onClick={() => { setNotifOpen(false); navigate("/alerts"); }} className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">Open Alert Center</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }} className={cn("flex items-center gap-2 rounded-xl p-1.5", isDark ? "hover:bg-gray-800" : "hover:bg-gray-100")}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-xs font-semibold text-white">{profile?.name?.charAt(0) ?? "T"}</div>
                  <ChevronDown className={cn("hidden h-4 w-4 sm:block", isDark ? "text-gray-500" : "text-gray-400")} />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} className={cn("absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl shadow-xl", isDark ? "bg-gray-900 border border-gray-700" : "bg-white border border-gray-100")}>
                      <div className={cn("border-b p-4", isDark ? "border-gray-700" : "border-gray-100")}>
                        <p className={cn("truncate font-semibold", isDark ? "text-white" : "text-gray-900")}>{profile?.name}</p>
                        <p className="truncate text-xs text-gray-500">{profile?.email}</p>
                      </div>
                      <div className="p-2">
                        <button className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800", isDark ? "text-gray-300" : "text-gray-700")}><User className="h-4 w-4" />Profile</button>
                        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><LogOut className="h-4 w-4" />Sign Out</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main className={cn("relative flex-1 overflow-y-auto p-4 lg:p-6", isDark ? "bg-gray-950" : "bg-gray-50")}>
          <PageBackdrop />
          <div className="relative z-10">
            <Outlet />
          </div>
        </main>

        <nav className={cn("sticky bottom-0 z-30 border-t backdrop-blur-xl lg:hidden", isDark ? "bg-gray-900/90 border-gray-800" : "bg-white/90 border-gray-100")}>
          <div className="relative flex items-center justify-around px-2 py-1.5">
            {MOBILE_NAV.map((item, index) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              const isCenter = index === 2;
              return (
                <button key={item.path} onClick={() => navigate(item.path)} className={cn("relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-all", active ? "text-primary-600" : isDark ? "text-gray-500" : "text-gray-400", isCenter && "-mt-6") }>
                  <div className={cn("relative rounded-xl p-1.5 transition-all", active && (isDark ? "bg-primary-900/30" : "bg-primary-50"), isCenter && "bg-gradient-to-br from-primary-600 to-accent-600 p-3 text-white shadow-lg shadow-primary-500/30") }>
                    {isCenter ? <PlusCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    {active && !isCenter && <motion.span layoutId="mobile-active-dot" className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary-600" />}
                  </div>
                  <span className={cn("text-[10px] font-medium", active && "font-semibold", isCenter && "text-gray-500 dark:text-gray-400")}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}