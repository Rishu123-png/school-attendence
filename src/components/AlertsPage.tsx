import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ref, onValue, set, push } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolData } from "@/hooks/useSchoolData";
import { Bell, AlertTriangle, Users, Zap, Send, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";
import toast from "react-hot-toast";

interface TeacherAlert { teacher: string; class: string; subject: string; period: string; time: string }
interface ParentNotif { id: string; studentName: string; rollNo: number; class: string; subject: string; period: string; date: string; status: "queued" | "sent" }

export default function AlertsPage() {
  const { schoolId, isAdmin } = useAuth();
  const { timetable, students, teachers } = useSchoolData();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [threshold, setThreshold] = useState(15);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [notifData, setNotifData] = useState<ParentNotif[]>([]);
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    const u1 = onValue(ref(db, `schools/${schoolId}/attendance/${date}`), (s) => setAttendanceData(s.val() ?? {}));
    const u2 = onValue(ref(db, `schools/${schoolId}/parentNotifications`), (s) => {
      const d = s.val();
      if (d) setNotifData(Object.entries(d).map(([id, v]: [string, any]) => ({ id, ...v })).sort((a: ParentNotif, b: ParentNotif) => (b.date ?? "").localeCompare(a.date ?? "")));
      else setNotifData([]);
    });
    return () => { u1(); u2(); };
  }, [schoolId, date]);

  /* ── compute late-alerts ── */
  const teacherAlerts: TeacherAlert[] = useMemo(() => {
    const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const dayName = days[new Date(date).getDay()];
    const todaySlots = timetable.filter((s) => s.day?.toLowerCase() === dayName);
    const now = new Date();
    const sameDay = date === new Date().toISOString().split("T")[0];
    const alerts: TeacherAlert[] = [];

    todaySlots.forEach((slot) => {
      // only check slots whose time + threshold has passed
      const [hh, mm] = slot.time.split(":").map(Number);
      const slotEnd = new Date(date); slotEnd.setHours(hh, (mm || 0) + threshold, 0, 0);
      if (sameDay && now < slotEnd) return;
      // is attendance marked?
      const cls = attendanceData?.[slot.class];
      const periodData = cls?.[slot.period];
      if (!periodData || Object.keys(periodData).length === 0) {
        alerts.push({ teacher: slot.teacher || "(unassigned)", class: slot.class, subject: slot.subject, period: slot.period, time: slot.time });
      }
    });
    return alerts;
  }, [timetable, attendanceData, date, threshold]);

  /* ── compute pending parent notifications from today's absences ── */
  const todayAbsences = useMemo(() => {
    const list: ParentNotif[] = [];
    if (!attendanceData) return list;
    for (const cls in attendanceData) {
      for (const period in attendanceData[cls]) {
        for (const sid in attendanceData[cls][period]) {
          const rec = attendanceData[cls][period][sid];
          if (rec?.status !== "absent") continue;
          const stu = students.find((s) => s.id === sid);
          if (!stu) continue;
          // skip already-queued
          const exists = notifData.find((n) => n.studentName === stu.name && n.date === date && n.period === period && n.subject === (rec.subject ?? ""));
          if (exists) continue;
          list.push({ id: `${sid}-${period}-${date}`, studentName: stu.name, rollNo: stu.rollNo, class: cls, subject: rec.subject ?? "—", period, date, status: "queued" });
        }
      }
    }
    return list;
  }, [attendanceData, students, notifData, date]);

  /* ── run sweep: persist parent notifications & teacher alerts ── */
  const runSweep = async () => {
    if (!schoolId) return;
    setSweeping(true);
    try {
      let added = 0;
      for (const n of todayAbsences) {
        const r = push(ref(db, `schools/${schoolId}/parentNotifications`));
        await set(r, { studentName: n.studentName, rollNo: n.rollNo, class: n.class, subject: n.subject, period: n.period, date: n.date, status: "queued", createdAt: Date.now() });
        added++;
      }
      // log teacher alerts
      for (const a of teacherAlerts) {
        const r = push(ref(db, `schools/${schoolId}/teacherAlerts`));
        await set(r, { ...a, date, createdAt: Date.now() });
      }
      toast.success(`Sweep complete: ${added} parent notifications queued, ${teacherAlerts.length} alerts logged`);
    } catch (e: any) { toast.error(e.message); }
    setSweeping(false);
  };

  const markSent = async (id: string) => {
    if (!schoolId) return;
    try {
      await set(ref(db, `schools/${schoolId}/parentNotifications/${id}/status`), "sent");
      toast.success("Marked as sent");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Bell className="w-6 h-6 text-yellow-500" />Alert System</h1>
        <p className="text-gray-500 text-sm">Teacher late alerts & parent notification queue</p>
      </motion.div>

      {/* controls */}
      <div className={S.card}>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-primary-600" />Alert Controls</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="block text-xs text-gray-500 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(S.input, "py-2")} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Late Threshold (min)</label>
            <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={cn(S.input, "py-2 w-32")} /></div>
          {isAdmin && (
            <button onClick={runSweep} disabled={sweeping} className={S.btnPrimary}>
              <Zap className="w-4 h-4" />{sweeping ? "Running…" : "Run Sweep"}
            </button>
          )}
        </div>
      </div>

      {/* Teacher Late Alerts */}
      <div className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />Teacher Late Alerts</h3>
            <p className="text-xs text-gray-400 mt-0.5">Teachers who haven't marked attendance after grace period</p>
          </div>
          <span className={cn(teacherAlerts.length > 0 ? S.badgeRed : S.badgeGreen, "text-xs")}>{teacherAlerts.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Teacher</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Class</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Subject</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Period</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Time</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {teacherAlerts.length ? teacherAlerts.map((a, i) => (
                <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-gray-50">
                  <td className="px-3 py-3 text-sm font-medium text-gray-900">{a.teacher}</td>
                  <td className="px-3 py-3 text-sm text-gray-600">{a.class}</td>
                  <td className="px-3 py-3 text-sm text-gray-600">{a.subject}</td>
                  <td className="px-3 py-3 text-center text-sm text-gray-700">{a.period}</td>
                  <td className="px-3 py-3 text-center text-sm text-gray-500">{a.time}</td>
                  <td className="px-3 py-3 text-center"><span className={cn(S.badgeRed, "text-[10px]")}><Clock className="w-3 h-3" />Pending</span></td>
                </motion.tr>
              )) : (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400"><CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-40 text-green-400" /><p className="text-sm">All clear! No pending teacher alerts</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parent Notification Queue */}
      <div className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-primary-600" />Parent Notification Queue</h3>
            <p className="text-xs text-gray-400 mt-0.5">Auto-generated when a student is marked absent</p>
          </div>
          <span className={cn(S.badgeBlue, "text-xs")}>{notifData.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Student</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Class</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Subject</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Date</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Period</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Status</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {notifData.length ? notifData.slice(0, 30).map((n) => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-bold">{n.rollNo}</div><span className="text-sm font-medium text-gray-900">{n.studentName}</span></div></td>
                  <td className="px-3 py-3 text-sm text-gray-600">{n.class}</td>
                  <td className="px-3 py-3 text-sm text-gray-600">{n.subject}</td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500">{new Date(n.date).toLocaleDateString()}</td>
                  <td className="px-3 py-3 text-center text-xs text-gray-700">{n.period}</td>
                  <td className="px-3 py-3 text-center"><span className={cn(n.status === "sent" ? S.badgeGreen : S.badgeYellow, "text-[10px]")}>{n.status}</span></td>
                  <td className="px-3 py-3 text-center">
                    {n.status === "queued" && <button onClick={() => markSent(n.id)} className="text-xs text-primary-600 hover:underline font-medium inline-flex items-center gap-1"><Send className="w-3 h-3" />Mark Sent</button>}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">No parent notifications yet</p>{todayAbsences.length > 0 && <p className="text-xs mt-1 text-yellow-600">{todayAbsences.length} pending — click "Run Sweep" above</p>}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {teachers.length === 0 && (
        <div className="text-center text-xs text-gray-400">Tip: Add teachers and timetable in Admin Panel to enable late alerts.</div>
      )}
    </div>
  );
}
