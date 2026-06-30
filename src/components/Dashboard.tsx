import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { S } from "@/lib/styles";
import { cn } from "@/lib/cn";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Users,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  Calendar,
  Bell,
  Sparkles,
  Play,
  BarChart3,
  Trophy,
  UserX,
  FileText,
  UserSearch,
  PartyPopper,
  Activity,
} from "lucide-react";

interface Ann { id: string; title: string; message: string; type: string; timestamp: number; author: string }

export default function Dashboard() {
  const { profile, schoolId } = useAuth();
  const { timetable, students, loading } = useSchoolData();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Ann[]>([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, total: 0 });
  const [now, setNow] = useState(new Date());

  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = days[now.getDay()];
  const todaySlots = timetable.filter((s) => s.day?.toLowerCase() === today).sort((a, b) => a.time.localeCompare(b.time));

  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nextClass = todaySlots.find((s) => s.time > timeStr) ?? null;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!schoolId) return;

    const unsub1 = onValue(ref(db, `schools/${schoolId}/announcements`), (snap) => {
      const d = snap.val();
      if (d) {
        setAnnouncements(
          Object.entries(d)
            .map(([id, v]: [string, any]) => ({ id, ...v }))
            .sort((a: Ann, b: Ann) => b.timestamp - a.timestamp)
            .slice(0, 5),
        );
      } else {
        setAnnouncements([]);
      }
    });

    const todayDate = new Date().toISOString().split("T")[0];
    const unsub2 = onValue(ref(db, `schools/${schoolId}/attendance/${todayDate}`), (snap) => {
      const d = snap.val();
      let present = 0;
      let absent = 0;
      let total = 0;

      if (d) {
        const walk = (obj: any) => {
          for (const k in obj) {
            const v = obj[k];
            if (typeof v === "object" && v !== null) {
              if (v.status) {
                total++;
                if (v.status === "present") present++;
                else absent++;
              } else {
                walk(v);
              }
            }
          }
        };
        walk(d);
      }

      setStats({ present, absent, total });
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [schoolId]);

  const greeting = now.getHours() < 12 ? "Morning" : now.getHours() < 17 ? "Afternoon" : "Evening";
  const rate = stats.total ? Math.round((stats.present / stats.total) * 100) : 0;
  const annColor = (t: string) =>
    t === "urgent"
      ? "border-l-red-500 bg-red-50/50 dark:bg-red-900/10"
      : t === "exam"
        ? "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10"
        : t === "holiday"
          ? "border-l-green-500 bg-green-50/50 dark:bg-green-900/10"
          : "border-l-primary-500 bg-primary-50/30 dark:bg-primary-900/10";
  const annIcon = (t: string) => t === "urgent" ? "🔴" : t === "exam" ? "📝" : t === "holiday" ? "🎉" : "📢";

  if (loading) {
    return (
      <div className="relative mx-auto max-w-5xl space-y-6 pb-24 lg:pb-0">
        <div className="h-32 w-full rounded-3xl bg-gray-200/70 dark:bg-gray-800/50 animate-pulse" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-200/70 dark:bg-gray-800/50 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-64 rounded-3xl bg-gray-200/70 dark:bg-gray-800/50 animate-pulse" />
          <div className="h-64 rounded-3xl bg-gray-200/70 dark:bg-gray-800/50 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-5xl space-y-6 pb-24 lg:pb-0">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80 sm:p-6"
      >
        <motion.div
          className="absolute -right-10 -top-14 h-36 w-36 rounded-full bg-primary-400/20 blur-2xl"
          animate={{ scale: [1, 1.2, 1], x: [0, -12, 0], y: [0, 10, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-accent-400/20 blur-2xl"
          animate={{ scale: [1, 0.9, 1.12, 1], x: [0, 20, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:border-primary-900/60 dark:bg-primary-900/20 dark:text-primary-300">
              <Activity className="h-3.5 w-3.5" /> Live school dashboard
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Good {greeting},{" "}
              <span className="bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                {profile?.name?.split(" ")[0] ?? "Teacher"}
              </span>
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Calendar className="h-4 w-4" />
              {now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/70">
            <Clock className="h-5 w-5 text-primary-600" />
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
            </span>
          </div>
        </div>
      </motion.div>

      {nextClass && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-600 via-primary-700 to-accent-600 p-5 shadow-xl shadow-primary-500/20 sm:p-6"
        >
          <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-white/5" />
          <motion.div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-xl"
            animate={{ scale: [1, 1.25, 1], x: [0, -18, 0], y: [0, 14, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-5 left-8 h-2 w-2 rounded-full bg-white/60"
            animate={{ x: [0, 160, 0], opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                {nextClass.period}
              </span>
              <span className="text-xs text-white/70">{nextClass.time}</span>
            </div>
            <h2 className="mb-1 text-xl font-bold text-white sm:text-2xl">{nextClass.subject}</h2>
            <p className="mb-4 text-sm text-white/80">{nextClass.class} · Room {nextClass.room || "—"}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => navigate("/attendance")} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"><Play className="h-4 w-4 fill-primary-700" />Start Attendance</button>
              <button onClick={() => navigate("/schedule")} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20">View Schedule<ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Students", val: students.length, icon: Users, color: "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300", link: "/students" },
          { label: "Present Today", val: stats.present, icon: CheckCircle, color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300", link: "/attendance", extra: <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", rate >= 80 ? "bg-green-100 text-green-600" : rate >= 60 ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600")}>{rate}%</span> },
          { label: "Today's Classes", val: todaySlots.length, icon: BookOpen, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300", link: "/schedule" },
          { label: "Absent Today", val: stats.absent, icon: AlertTriangle, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300", link: "/analytics" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <motion.div key={c.label} whileTap={{ scale: 0.97 }} className={cn(S.cardHover, "bg-white/85 backdrop-blur-xl dark:bg-gray-900/85")} onClick={() => navigate(c.link)}>
              <div className="mb-3 flex items-center justify-between"><div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", c.color)}><Icon className="h-5 w-5" /></div>{c.extra}</div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.val}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={cn(S.card, "bg-white/85 backdrop-blur-xl dark:bg-gray-900/85")}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><Calendar className="h-4 w-4 text-primary-600" />Today's Schedule</h3>
            <button onClick={() => navigate("/schedule")} className="text-xs font-medium text-primary-600 hover:underline">View All</button>
          </div>
          <div className="space-y-2">
            {todaySlots.length ? todaySlots.slice(0, 6).map((slot, idx) => (
              <motion.div key={slot.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800" onClick={() => navigate("/attendance")}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"><span className="text-xs font-bold text-primary-600">{slot.period}</span></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{slot.subject}</p><p className="text-xs text-gray-500 dark:text-gray-400">{slot.class} · Room {slot.room || "—"}</p></div>
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{slot.time}</span>
              </motion.div>
            )) : <div className="py-8 text-center text-gray-400 dark:text-gray-500"><Calendar className="mx-auto mb-2 h-8 w-8 opacity-50" /><p className="text-sm">No classes today</p></div>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className={cn(S.card, "bg-white/85 backdrop-blur-xl dark:bg-gray-900/85")}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><Bell className="h-4 w-4 text-accent-600" />Announcements</h3>
            <button onClick={() => navigate("/announcements")} className="text-xs font-medium text-primary-600 hover:underline">View All</button>
          </div>
          <div className="space-y-2">
            {announcements.length ? announcements.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={cn("cursor-pointer rounded-xl border-l-4 p-3", annColor(a.type))}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{annIcon(a.type)}</span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{a.title}</p><p className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">{a.message}</p><p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">{new Date(a.timestamp).toLocaleDateString()} · {a.author}</p></div>
                </div>
              </motion.div>
            )) : <div className="py-8 text-center text-gray-400 dark:text-gray-500"><Bell className="mx-auto mb-2 h-8 w-8 opacity-50" /><p className="text-sm">No announcements yet</p></div>}
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><Sparkles className="h-4 w-4 text-primary-600" />Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Report", icon: FileText, color: "from-blue-500 to-blue-600", link: "/report" },
            { label: "Leaderboard", icon: Trophy, color: "from-yellow-500 to-amber-500", link: "/leaderboard" },
            { label: "Top Bunkers", icon: UserX, color: "from-red-500 to-rose-500", link: "/bunkers" },
            { label: "Student Profile", icon: UserSearch, color: "from-purple-500 to-violet-500", link: "/student-profile" },
            { label: "Holidays", icon: PartyPopper, color: "from-green-500 to-emerald-500", link: "/holidays" },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} onClick={() => navigate(a.link)} className={cn(S.cardHover, "flex flex-col items-center justify-center gap-2 bg-white/85 py-4 text-center backdrop-blur-xl dark:bg-gray-900/85")}>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", a.color)}><Icon className="h-5 w-5" /></div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{a.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className={cn(S.card, "border-primary-100/50 bg-gradient-to-r from-primary-50/90 to-accent-50/90 backdrop-blur-xl dark:border-primary-800/30 dark:from-primary-900/20 dark:to-accent-900/20")}>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 shadow-lg"><Sparkles className="h-6 w-6 text-white" /></div>
          <div className="flex-1"><h3 className="font-semibold text-gray-900 dark:text-white">AI Smart Insights</h3><p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">Predictive analytics on performance, attendance trends, and early warnings.</p></div>
          <button onClick={() => navigate("/analytics")} className={cn(S.btnPrimary, "shrink-0")}><BarChart3 className="h-4 w-4" />View Insights</button>
        </div>
      </motion.div>
    </div>
  );
}
