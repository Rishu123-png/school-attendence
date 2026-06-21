import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Home, GraduationCap, ClipboardCheck, BarChart3, Bell, Menu, LogOut, User, ChevronDown, Sparkles, BookOpen, CalendarDays, Megaphone, Users, Copy, Check, FileText, Trophy, UserX, PartyPopper, UserSearch, X, Moon, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useDarkMode } from "@/hooks/useDarkMode";
import { cn } from "@/lib/cn";

interface NavItem { path: string; label: string; icon: any; adminOnly?: boolean }
interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Teaching",
    items: [
      { path: "/dashboard",      label: "Home",          icon: Home },
      { path: "/attendance",     label: "Attendance",     icon: ClipboardCheck },
      { path: "/marks",          label: "Marks",          icon: BookOpen },
      { path: "/schedule",       label: "Schedule",       icon: CalendarDays },
      { path: "/students",       label: "Students",       icon: Users },
      { path: "/student-profile",label: "Student Profile",icon: UserSearch },
    ],
  },
  {
    label: "Reports & Insights",
    items: [
      { path: "/analytics",      label: "Analytics",      icon: BarChart3 },
      { path: "/report",         label: "Attendance Report", icon: FileText },
      { path: "/leaderboard",    label: "Leaderboard",    icon: Trophy },
      { path: "/bunkers",        label: "Top Bunkers",    icon: UserX },
    ],
  },
  {
    label: "Communication",
    items: [
      { path: "/announcements",  label: "Announcements",  icon: Megaphone },
      { path: "/alerts",         label: "Alerts",         icon: Bell },
      { path: "/holidays",       label: "Holidays",       icon: PartyPopper },
    ],
  },
  {
    label: "Administration",
    items: [
      { path: "/admin",          label: "Admin Panel",    icon: Sparkles, adminOnly: true },
    ],
  },
];

const MOBILE_NAV = [
  { path: "/dashboard",     label: "Home",       icon: Home },
  { path: "/attendance",    label: "Attendance", icon: ClipboardCheck },
  { path: "/marks",         label: "Marks",      icon: BookOpen },
  { path: "/announcements", label: "Updates",    icon: Megaphone },
  { path: "/analytics",     label: "Insights",   icon: BarChart3 },
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
      case "reminder":   return { dot: "bg-primary-500", bg: "bg-primary-50/40 dark:bg-primary-900/20" };
      case "announcement": return { dot: "bg-accent-500", bg: "bg-accent-50/40 dark:bg-accent-900/20" };
      default: return { dot: "bg-gray-400", bg: "bg-gray-50/40" };
    }
  };

  const handleLogout = async () => { await logout(); navigate("/"); };

  const copySchoolCode = () => {
    navigator.clipboard.writeText(schoolId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let currentLabel = "Dashboard";
  for (const g of NAV_GROUPS) {
    const it = g.items.find((i) => i.path === location.pathname);
    if (it) { currentLabel = it.label; break; }
  }

  return (
    <div className={cn("flex h-screen", isDark ? "bg-gray-950" : "bg-gray-50")}>
      {/* ── Sidebar ── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 border-r shadow-sm transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
        sidebar ? "translate-x-0" : "-translate-x-full",
        isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100",
      )}>
        <div className="flex flex-col h-full">
          <div className={cn("flex items-center gap-3 px-6 py-5 border-b", isDark ? "border-gray-800" : "border-gray-100")}>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 shadow-lg shadow-primary-200">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={cn("text-lg font-bold", isDark ? "text-white" : "text-gray-900")}>School OS</h1>
              <p className="text-[10px] text-gray-400">Smart Education Hub</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto scrollbar-hide">
            {NAV_GROUPS.map((group) => {
              const items = group.items.filter((i) => !i.adminOnly || isAdmin);
              if (!items.length) return null;
              return (
                <div key={group.label}>
                  <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{group.label}</p>
                  <div className="space-y-0.5 mt-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = location.pathname === item.path;
                      return (
                        <button key={item.path} onClick={() => { navigate(item.path); setSidebar(false); }}
                          className={cn("flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all",
                            active
                              ? "bg-gradient-to-r from-primary-50 to-primary-100/50 text-primary-700 shadow-sm dark:from-primary-900/30 dark:to-primary-800/20 dark:text-primary-400"
                              : isDark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}>
                          <Icon className={cn("w-4 h-4", active && "text-primary-600")} />
                          <span>{item.label}</span>
                          {active && <motion.div layoutId="dot" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {schoolId && (
            <div className={cn("px-4 py-3 border-t", isDark ? "border-gray-800" : "border-gray-100")}>
              <p className="text-[10px] text-gray-400 mb-1">School Code (share with teachers)</p>
              <button onClick={copySchoolCode}
                className={cn("flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs font-mono transition-colors",
                  isDark ? "bg-gray-800 hover:bg-gray-700 text-gray-300" : "bg-gray-50 hover:bg-gray-100 text-gray-700")}>
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                <span className="truncate">{schoolId}</span>
              </button>
            </div>
          )}

          <div className={cn("p-4 border-t", isDark ? "border-gray-800" : "border-gray-100")}>
            <div className={cn("flex items-center gap-3 px-3 py-2 rounded-xl", isDark ? "bg-gray-800" : "bg-gray-50")}>
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white text-sm font-semibold">
                {profile?.name?.charAt(0) ?? "T"}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-semibold truncate", isDark ? "text-white" : "text-gray-900")}>{profile?.name ?? "User"}</p>
                <p className="text-[10px] text-gray-500 capitalize">{profile?.role === "schoolAdmin" ? "Admin" : "Teacher"}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {sidebar && <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebar(false)} />}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className={cn("sticky top-0 z-30 backdrop-blur-lg border-b shadow-sm",
          isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/80 border-gray-100")}>
          <div className="flex items-center justify-between px-4 lg:px-6 h-14">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebar(true)} className={cn("p-2 rounded-xl lg:hidden", isDark ? "text-gray-400 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100")}><Menu className="w-5 h-5" /></button>
              <span className={cn("hidden sm:block text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>{currentLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Dark mode toggle */}
              <button onClick={toggle} className={cn("p-2 rounded-xl transition-colors", isDark ? "text-yellow-400 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100")}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className="relative">
                <button onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); if (!notifOpen) markAllRead(); }}
                  className={cn("relative p-2 rounded-xl", isDark ? "text-gray-400 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100")}>
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full shadow">{unreadCount > 9 ? "9+" : unreadCount}</span>
                  )}
                </button>
                <AnimatePresence>
                  {notifOpen && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className={cn("absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-xl overflow-hidden",
                        isDark ? "bg-gray-900 border border-gray-700" : "bg-white border border-gray-100")}>
                      <div className={cn("p-4 border-b flex items-center justify-between", isDark ? "border-gray-700" : "border-gray-100")}>
                        <h3 className={cn("font-semibold flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}><Bell className="w-4 h-4 text-primary-600" />Notifications</h3>
                        {notifications.length > 0 && <button onClick={clearAll} className="text-xs text-red-500 hover:underline">Clear all</button>}
                      </div>
                      <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                        {notifications.length ? notifications.map((n) => {
                          const st = notifStyle(n.kind);
                          return (
                            <div key={n.id} className={cn("flex items-start gap-3 px-4 py-3 transition-colors", !n.read && st.bg)}>
                              <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", st.dot)} />
                              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => markRead(n.id)}>
                                <p className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>{n.title}</p>
                                <p className={cn("text-xs mt-0.5", isDark ? "text-gray-400" : "text-gray-600")}>{n.message}</p>
                                <p className="text-[10px] text-gray-500 mt-1">{timeAgo(n.timestamp)}</p>
                              </div>
                              <button onClick={() => dismiss(n.id)} className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          );
                        }) : (
                          <div className="text-center py-10 text-gray-400">
                            <Bell className="w-9 h-9 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No notifications</p>
                            <p className="text-[11px] mt-1">Class reminders & alerts appear here</p>
                          </div>
                        )}
                      </div>
                      <div className={cn("p-2 border-t", isDark ? "border-gray-700" : "border-gray-100")}>
                        <button onClick={() => { setNotifOpen(false); navigate("/alerts"); }} className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 font-medium">Open Alert Center</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <button onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                  className={cn("flex items-center gap-2 p-1.5 rounded-xl", isDark ? "hover:bg-gray-800" : "hover:bg-gray-100")}>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white text-xs font-semibold">{profile?.name?.charAt(0) ?? "T"}</div>
                  <ChevronDown className={cn("w-4 h-4 hidden sm:block", isDark ? "text-gray-500" : "text-gray-400")} />
                </button>
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className={cn("absolute right-0 mt-2 w-56 rounded-2xl shadow-xl overflow-hidden",
                        isDark ? "bg-gray-900 border border-gray-700" : "bg-white border border-gray-100")}>
                      <div className={cn("p-4 border-b", isDark ? "border-gray-700" : "border-gray-100")}>
                        <p className={cn("font-semibold truncate", isDark ? "text-white" : "text-gray-900")}>{profile?.name}</p>
                        <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
                      </div>
                      <div className="p-2">
                        <button className={cn("flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800", isDark ? "text-gray-300" : "text-gray-700")}><User className="w-4 h-4" />Profile</button>
                        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><LogOut className="w-4 h-4" />Sign Out</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main className={cn("flex-1 overflow-y-auto p-4 lg:p-6", isDark ? "bg-gray-950" : "bg-gray-50")}><Outlet /></main>

        <nav className={cn("sticky bottom-0 z-30 backdrop-blur-lg border-t lg:hidden",
          isDark ? "bg-gray-900/90 border-gray-800" : "bg-white/90 border-gray-100")}>
          <div className="flex items-center justify-around px-2 py-1">
            {MOBILE_NAV.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={cn("flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all", active ? "text-primary-600" : isDark ? "text-gray-500" : "text-gray-400")}>
                  <div className={cn("p-1.5 rounded-lg", active && (isDark ? "bg-primary-900/30" : "bg-primary-50"))}><Icon className="w-5 h-5" /></div>
                  <span className={cn("text-[10px] font-medium", active && "font-semibold")}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}