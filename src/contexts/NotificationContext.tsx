import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { ref, onValue, push, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

/* ── types ──────────────────────────────────────── */
export interface AppNotification {
  id: string;
  kind: "reminder" | "late-alert" | "announcement" | "info";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

interface Ctx {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<Ctx | undefined>(undefined);

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const REMINDER_MIN = 10;   // remind teacher 10 min before class
const LATE_GRACE_MIN = 10; // alert admin if not marked 10 min after class start

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
function toMin(t: string) {
  if (!t || !t.includes(":")) return -1;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { schoolId, profile, user } = useAuth();
  const isAdmin = profile?.role === "schoolAdmin";

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<any>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // track which keys we've already fired so we don't spam
  const firedKeys = useRef<Set<string>>(new Set());

  // load dismissed from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("schoolos_dismissed");
      if (raw) setDismissed(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  const persistDismissed = (s: Set<string>) => {
    try { localStorage.setItem("schoolos_dismissed", JSON.stringify([...s])); } catch {}
  };

  /* ── live data ── */
  useEffect(() => {
    if (!schoolId) return;
    const root = `schools/${schoolId}`;
    const u1 = onValue(ref(db, `${root}/timetables`), (s) => {
      const d = s.val();
      setTimetable(d ? Object.entries(d).map(([id, v]: [string, any]) => ({ id, ...v })) : []);
    });
    const u2 = onValue(ref(db, `${root}/teachers`), (s) => {
      const d = s.val();
      setTeachers(d ? Object.entries(d).map(([id, v]: [string, any]) => ({ id, ...v })) : []);
    });
    const u3 = onValue(ref(db, `${root}/attendance/${todayStr()}`), (s) => setAttendanceToday(s.val() ?? {}));
    // announcements → notifications
    const u4 = onValue(ref(db, `${root}/announcements`), (s) => {
      const d = s.val();
      if (!d) return;
      const recent = Object.entries(d)
        .map(([id, v]: [string, any]) => ({ id, ...v }))
        .filter((a: any) => Date.now() - (a.timestamp || 0) < 1000 * 60 * 60 * 24) // last 24h
        .sort((a: any, b: any) => b.timestamp - a.timestamp);
      recent.forEach((a: any) => {
        const key = `ann-${a.id}`;
        if (firedKeys.current.has(key) || dismissed.has(key)) return;
        firedKeys.current.add(key);
        addNotification({ id: key, kind: "announcement", title: `📢 ${a.title || "Announcement"}`, message: a.message || "", timestamp: a.timestamp || Date.now(), read: false });
      });
    });
    return () => { u1(); u2(); u3(); u4(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const addNotification = useCallback((n: AppNotification) => {
    setNotifications((prev) => {
      if (prev.some((x) => x.id === n.id)) return prev;
      return [n, ...prev].slice(0, 50);
    });
    // browser notification (best-effort)
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification(n.title, { body: n.message }); } catch {}
    }
  }, []);

  // ask for browser notification permission once
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  /* ── the engine: runs every 30s ── */
  useEffect(() => {
    if (!schoolId || !profile) return;

    const tick = () => {
      const dayKey = DAYS[new Date().getDay()];
      const nm = nowMinutes();
      const todaySlots = timetable.filter((s) => (s.day || "").toLowerCase() === dayKey);

      /* TEACHER reminders — for slots belonging to current teacher */
      if (!isAdmin && user) {
        const myUid = user.uid;
        // match by teacherUid OR by email→teacher record
        const myTeacher = teachers.find((t) => t.email?.toLowerCase() === profile.email?.toLowerCase());
        const mySlots = todaySlots.filter((s) =>
          s.teacherUid === myUid ||
          (myTeacher && s.teacherUid === myTeacher.id) ||
          (myTeacher?.assignedClasses?.includes(s.class) && myTeacher?.assignedSubjects?.includes(s.subject)),
        );
        mySlots.forEach((slot) => {
          const start = toMin(slot.time);
          if (start < 0) return;
          const diff = start - nm;
          // upcoming reminder window
          if (diff <= REMINDER_MIN && diff >= 0) {
            const key = `rem-${slot.id}-${todayStr()}`;
            if (firedKeys.current.has(key) || dismissed.has(key)) return;
            firedKeys.current.add(key);
            addNotification({
              id: key, kind: "reminder",
              title: `⏰ Class starting soon`,
              message: `${slot.subject} for ${slot.class} (${slot.period}) starts at ${slot.time} — Room ${slot.room || "—"}. Get ready to mark attendance!`,
              timestamp: Date.now(), read: false,
            });
          }
        });
      }

      /* ADMIN late-alerts — teacher hasn't marked attendance after grace */
      if (isAdmin) {
        todaySlots.forEach((slot) => {
          const start = toMin(slot.time);
          if (start < 0) return;
          if (nm < start + LATE_GRACE_MIN) return; // grace not passed
          // is attendance marked for this class/period?
          const marked = attendanceToday?.[slot.class]?.[slot.period];
          if (marked && Object.keys(marked).length > 0) return;
          const key = `late-${slot.id}-${todayStr()}`;
          if (firedKeys.current.has(key) || dismissed.has(key)) return;
          firedKeys.current.add(key);
          const tName = teachers.find((t) => t.id === slot.teacherUid)?.name || slot.teacher || "A teacher";
          addNotification({
            id: key, kind: "late-alert",
            title: `🚨 Teacher Late Alert`,
            message: `${tName} has not marked attendance for ${slot.subject} (${slot.class}, ${slot.period}) scheduled at ${slot.time}.`,
            timestamp: Date.now(), read: false,
          });
          // persist to Firebase teacherAlerts
          const aRef = push(ref(db, `schools/${schoolId}/teacherAlerts`));
          set(aRef, {
            teacherUid: slot.teacherUid || "", teacherName: tName, class: slot.class,
            subject: slot.subject, period: slot.period, time: slot.time, date: todayStr(),
            status: "open", createdAt: Date.now(),
          }).catch(() => {});
        });
      }
    };

    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, profile, isAdmin, timetable, teachers, attendanceToday, dismissed, user]);

  /* ── actions ── */
  const markRead = (id: string) => setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const markAllRead = () => setNotifications((p) => p.map((n) => ({ ...n, read: true })));
  const dismiss = (id: string) => {
    setNotifications((p) => p.filter((n) => n.id !== id));
    setDismissed((prev) => { const s = new Set(prev); s.add(id); persistDismissed(s); return s; });
  };
  const clearAll = () => {
    setDismissed((prev) => {
      const s = new Set(prev);
      notifications.forEach((n) => s.add(n.id));
      persistDismissed(s);
      return s;
    });
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, dismiss, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const c = useContext(NotificationContext);
  if (!c) throw new Error("useNotifications must be inside NotificationProvider");
  return c;
}
