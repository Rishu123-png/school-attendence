import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ref, onValue, push, set, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Megaphone, Bell, Plus, X, Send, Clock, User, AlertCircle, GraduationCap, Calendar, Award, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";
import toast from "react-hot-toast";

interface Ann { id: string; title: string; message: string; type: string; audience: string; timestamp: number; author: string }

export default function AnnouncementsPage() {
  const { profile, isAdmin, schoolId } = useAuth();
  const [announcements, setAnnouncements] = useState<Ann[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", message: "", type: "general", audience: "all" });
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    const unsub = onValue(ref(db, `schools/${schoolId}/announcements`), (snap) => {
      const d = snap.val();
      if (d) setAnnouncements(Object.entries(d).map(([id, v]: [string, any]) => ({ id, ...v })).sort((a: Ann, b: Ann) => b.timestamp - a.timestamp));
      else setAnnouncements([]);
    });
    return () => unsub();
  }, [schoolId]);

  const filtered = filter === "all" ? announcements : announcements.filter((a) => a.type === filter);

  const postAnn = async () => {
    if (!form.title.trim() || !form.message.trim()) { toast.error("Fill in all fields"); return; }
    if (!schoolId) { toast.error("No school selected"); return; }
    setPosting(true);
    try {
      const newRef = push(ref(db, `schools/${schoolId}/announcements`));
      await set(newRef, { ...form, author: profile?.name ?? "Unknown", timestamp: Date.now() });
      toast.success("Posted! 📢"); setForm({ title: "", message: "", type: "general", audience: "all" }); setShowCreate(false);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    setPosting(false);
  };

  const deleteAnn = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    try {
      await remove(ref(db, `schools/${schoolId}/announcements/${id}`));
      toast.success("Deleted announcement");
    } catch (e: any) { toast.error(e.message ?? "Failed to delete"); }
  };

  const icon = (t: string) => {
    switch (t) { case "urgent": return <AlertCircle className="w-5 h-5 text-red-500" />; case "exam": return <Award className="w-5 h-5 text-yellow-500" />; case "holiday": return <Calendar className="w-5 h-5 text-green-500" />; case "event": return <GraduationCap className="w-5 h-5 text-purple-500" />; default: return <Megaphone className="w-5 h-5 text-primary-500" />; }
  };
  const borderColor = (t: string) => {
    switch (t) { case "urgent": return "#ef4444"; case "exam": return "#f59e0b"; case "holiday": return "#10b981"; case "event": return "#8b5cf6"; default: return "#6366f1"; }
  };
  const bgColor = (t: string) => {
    switch (t) { case "urgent": return "bg-red-50/50 dark:bg-red-900/10"; case "exam": return "bg-yellow-50/50 dark:bg-yellow-900/10"; case "holiday": return "bg-green-50/50 dark:bg-green-900/10"; case "event": return "bg-purple-50/50 dark:bg-purple-900/10"; default: return "bg-primary-50/30 dark:bg-primary-900/10"; }
  };
  const badgeClass = (t: string) => {
    switch (t) { case "urgent": return S.badgeRed; case "exam": return S.badgeYellow; case "holiday": return S.badgeGreen; case "event": return S.badgePurple; default: return S.badgeBlue; }
  };
  const timeAgo = (ts: number) => { const d = Date.now() - ts; const m = Math.floor(d / 60000); if (m < 60) return `${m}m`; const h = Math.floor(d / 3600000); if (h < 24) return `${h}h`; return `${Math.floor(d / 86400000)}d`; };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">📢 Announcements</h1><p className="text-gray-500 dark:text-gray-400 text-sm">Stay updated with school news</p></div>
        {isAdmin && <button onClick={() => setShowCreate(!showCreate)} className={S.btnPrimary}><Plus className="w-4 h-4" />New Announcement</button>}
      </motion.div>

      {/* create panel */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className={cn(S.card, "space-y-4 bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/10 dark:to-gray-900")}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary-600" />Post Announcement</h3>
                <button onClick={() => setShowCreate(false)} className={cn(S.btnGhost, "p-1")}><X className="w-4 h-4" /></button>
              </div>
              <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Title…" className={S.input} />
              <textarea value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} placeholder="Message…" rows={3} className={cn(S.input, "resize-none")} />
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[140px]"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className={cn(S.input, "py-2")}><option value="general">General</option><option value="exam">Exam</option><option value="holiday">Holiday</option><option value="urgent">Urgent</option><option value="event">Event</option></select></div>
                <div className="flex-1 min-w-[140px]"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Audience</label>
                  <select value={form.audience} onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value }))} className={cn(S.input, "py-2")}><option value="all">Everyone</option><option value="teachers">Teachers</option><option value="students">Students</option></select></div>
                <div className="flex items-end"><button onClick={postAnn} disabled={posting} className={S.btnPrimary}><Send className="w-4 h-4" />{posting ? "Posting…" : "Post"}</button></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { v: "all", l: "All" }, { v: "general", l: "📢 General" }, { v: "exam", l: "📝 Exams" },
          { v: "holiday", l: "🎉 Holidays" }, { v: "event", l: "🎪 Events" }, { v: "urgent", l: "🔴 Urgent" },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => setFilter(v)}
            className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
              filter === v ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 shadow-sm" : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700")}>
            {l}
          </button>
        ))}
      </div>

      {/* feed */}
      <div className="space-y-3">
        {filtered.length ? filtered.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className={cn(S.card, "border-l-4 cursor-pointer hover:shadow-md", bgColor(a.type))}
            style={{ borderLeftColor: borderColor(a.type) }}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center">{icon(a.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{a.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(badgeClass(a.type), "text-[10px]")}>{a.type}</span>
                      <span className={cn(S.badgeBlue, "text-[10px]")}>{a.audience}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(a.timestamp)}</span>
                    {isAdmin && <button onClick={(e) => { e.stopPropagation(); deleteAnn(a.id); }} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">{a.message}</p>
                <div className="flex items-center gap-2 mt-3 text-xs text-gray-400 dark:text-gray-500"><User className="w-3 h-3" />{a.author}</div>
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500"><Bell className="w-12 h-12 mx-auto mb-3 opacity-40" /><p className="text-base font-medium">No announcements yet</p></div>
        )}
      </div>
    </div>
  );
}
