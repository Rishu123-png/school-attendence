import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { S } from "@/lib/styles";
import { cn } from "@/lib/cn";
import { useNavigate } from "react-router-dom";
import { Clock, Users, CheckCircle, AlertTriangle, BookOpen, ArrowRight, Calendar, Bell, Sparkles, Play, BarChart3, Trophy, UserX, FileText, UserSearch, PartyPopper } from "lucide-react";

interface Ann { id: string; title: string; message: string; type: string; timestamp: number; author: string }

export default function Dashboard() {
  const { profile, schoolId } = useAuth();
  const { timetable, students } = useSchoolData();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Ann[]>([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, total: 0 });
  const [now, setNow] = useState(new Date());

  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const today = days[now.getDay()];
  const todaySlots = timetable.filter((s) => s.day?.toLowerCase() === today).sort((a, b) => a.time.localeCompare(b.time));

  const timeStr = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  const nextClass = todaySlots.find((s) => s.time > timeStr) ?? todaySlots[0];

  useEffect(() => {
    if (!schoolId) return;
    const unsub1 = onValue(ref(db, `schools/${schoolId}/announcements`), (snap) => {
      const d = snap.val();
      if (d) setAnnouncements(Object.entries(d).map(([id, v]: [string, any]) => ({ id, ...v })).sort((a: Ann, b: Ann) => b.timestamp - a.timestamp).slice(0, 5));
      else setAnnouncements([]);
    });
    const todayDate = now.toISOString().split("T")[0];
    const unsub2 = onValue(ref(db, `schools/${schoolId}/attendance/${todayDate}`), (snap) => {
      const d = snap.val();
      let present = 0, absent = 0, total = 0;
      if (d) {
        const walk = (obj: any) => { for (const k in obj) { const v = obj[k]; if (typeof v === "object" && v !== null) { if (v.status) { total++; if (v.status === "present") present++; else absent++; } else walk(v); } } };
        walk(d);
      }
      setStats({ present, absent, total });
    });
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => { unsub1(); unsub2(); clearInterval(t); };
  }, [schoolId, now]);

  const greeting = now.getHours() < 12 ? "Morning" : now.getHours() < 17 ? "Afternoon" : "Evening";
  const rate = stats.total ? Math.round((stats.present / stats.total) * 100) : 0;
  const annColor = (t: string) => t === "urgent" ? "border-l-red-500 bg-red-50/50 dark:bg-red-900/10" : t === "exam" ? "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10" : t === "holiday" ? "border-l-green-500 bg-green-50/50 dark:bg-green-900/10" : "border-l-primary-500 bg-primary-50/30 dark:bg-primary-900/10";
  const annIcon = (t: string) => t === "urgent" ? "🔴" : t === "exam" ? "📝" : t === "holiday" ? "🎉" : "📢";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      {/* greeting */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Good {greeting}, <span className="bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">{profile?.name?.split(" ")[0] ?? "Teacher"}</span></h1>
          <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1 text-sm"><Calendar className="w-4 h-4" />{now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm"><Clock className="w-5 h-5 text-primary-600" /><span className="text-lg font-semibold text-gray-900 dark:text-gray-100">{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></div>
      </motion.div>

      {/* next class banner */}
      {nextClass && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 via-primary-700 to-accent-600 p-5 sm:p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />{nextClass.period}</span>
              <span className="text-white/70 text-xs">{nextClass.time}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">{nextClass.subject}</h2>
            <p className="text-white/80 text-sm mb-4">{nextClass.class} · Room {nextClass.room || "—"}</p>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/attendance")} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-primary-700 font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"><Play className="w-4 h-4 fill-primary-700" />Start Attendance</button>
              <button onClick={() => navigate("/schedule")} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all">View Schedule<ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        </motion.div>
      )}

      {/* stats */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Students", val: students.length, icon: Users, color: "bg-primary-100 text-primary-600", link: "/students" },
          { label: "Present Today", val: stats.present, icon: CheckCircle, color: "bg-green-100 text-green-600", link: "/attendance", extra: <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", rate >= 80 ? "text-green-600 bg-green-100" : rate >= 60 ? "text-yellow-600 bg-yellow-100" : "text-red-600 bg-red-100")}>{rate}%</span> },
          { label: "Today's Classes", val: todaySlots.length, icon: BookOpen, color: "bg-purple-100 text-purple-600", link: "/schedule" },
          { label: "Absent Today", val: stats.absent, icon: AlertTriangle, color: "bg-orange-100 text-orange-600", link: "/analytics" },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className={cn(S.cardHover)} onClick={() => navigate(c.link)}>
              <div className="flex items-center justify-between mb-3"><div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", c.color)}><Icon className="w-5 h-5" /></div>{c.extra}</div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.val}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.label}</p>
            </div>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* today schedule */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={S.card}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Calendar className="w-4 h-4 text-primary-600" />Today's Schedule</h3>
            <button onClick={() => navigate("/schedule")} className="text-xs text-primary-600 font-medium hover:underline">View All</button>
          </div>
          <div className="space-y-2">
            {todaySlots.length ? todaySlots.slice(0, 6).map((slot, idx) => (
              <motion.div key={slot.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => navigate("/attendance")}>
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-700"><span className="text-xs font-bold text-primary-600">{slot.period}</span></div>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{slot.subject}</p><p className="text-xs text-gray-500 dark:text-gray-400">{slot.class} · Room {slot.room || "—"}</p></div>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{slot.time}</span>
              </motion.div>
            )) : <div className="text-center py-8 text-gray-400 dark:text-gray-500"><Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No classes today</p></div>}
          </div>
        </motion.div>

        {/* announcements */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className={S.card}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Bell className="w-4 h-4 text-accent-600" />Announcements</h3>
            <button onClick={() => navigate("/announcements")} className="text-xs text-primary-600 font-medium hover:underline">View All</button>
          </div>
          <div className="space-y-2">
            {announcements.length ? announcements.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={cn("p-3 rounded-xl border-l-4 cursor-pointer", annColor(a.type))}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{annIcon(a.type)}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{a.title}</p><p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">{a.message}</p><p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{new Date(a.timestamp).toLocaleDateString()} · {a.author}</p></div>
                </div>
              </motion.div>
            )) : <div className="text-center py-8 text-gray-400 dark:text-gray-500"><Bell className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No announcements yet</p></div>}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary-600" />Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Report", icon: FileText, color: "from-blue-500 to-blue-600", link: "/report" },
            { label: "Leaderboard", icon: Trophy, color: "from-yellow-500 to-amber-500", link: "/leaderboard" },
            { label: "Top Bunkers", icon: UserX, color: "from-red-500 to-rose-500", link: "/bunkers" },
            { label: "Student Profile", icon: UserSearch, color: "from-purple-500 to-violet-500", link: "/student-profile" },
            { label: "Holidays", icon: PartyPopper, color: "from-green-500 to-emerald-500", link: "/holidays" },
          ].map((a, i) => {
            const Icon = a.icon;
            return (
              <button key={i} onClick={() => navigate(a.link)} className={cn(S.cardHover, "flex flex-col items-center justify-center py-4 gap-2 text-center")}>
                <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-sm", a.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{a.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* AI insights banner */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className={cn(S.card, "bg-gradient-to-r from-primary-50 to-accent-50 border-primary-100/50 dark:from-primary-900/20 dark:to-accent-900/20 dark:border-primary-800/30")}>
        <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary-600 to-accent-600 shadow-lg shrink-0"><Sparkles className="w-6 h-6 text-white" /></div>
          <div className="flex-1"><h3 className="font-semibold text-gray-900 dark:text-white">AI Smart Insights</h3><p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">Predictive analytics on performance, attendance trends, and early warnings.</p></div>
          <button onClick={() => navigate("/analytics")} className={cn(S.btnPrimary, "shrink-0")}><BarChart3 className="w-4 h-4" />View Insights</button>
        </div>
      </motion.div>
    </div>
  );
}

