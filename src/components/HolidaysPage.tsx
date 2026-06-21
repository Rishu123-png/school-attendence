import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ref, onValue, push, set, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarDays, Plus, Trash2, PartyPopper, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";
import toast from "react-hot-toast";

interface Holiday { id: string; date: string; reason: string; type: string; createdAt: number }

export default function HolidaysPage() {
  const { schoolId, isAdmin } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], reason: "", type: "public" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    const unsub = onValue(ref(db, `schools/${schoolId}/holidays`), (snap) => {
      const d = snap.val();
      if (d) setHolidays(Object.entries(d).map(([id, v]: [string, any]) => ({ id, ...v })).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")));
      else setHolidays([]);
    });
    return () => unsub();
  }, [schoolId]);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = holidays.filter((h) => h.date >= today);
  const past = holidays.filter((h) => h.date < today);

  const add = async () => {
    if (!form.reason.trim()) return toast.error("Reason required");
    setBusy(true);
    try {
      const r = push(ref(db, `schools/${schoolId}/holidays`));
      await set(r, { ...form, reason: form.reason.trim(), createdAt: Date.now() });
      toast.success("Holiday added 🎉"); setForm({ date: new Date().toISOString().split("T")[0], reason: "", type: "public" });
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this holiday?")) return;
    try { await remove(ref(db, `schools/${schoolId}/holidays/${id}`)); toast.success("Deleted"); }
    catch (e: any) { toast.error(e.message); }
  };

  const typeColor = (t: string) => t === "festival" ? S.badgePurple : t === "special" ? S.badgeYellow : t === "vacation" ? S.badgeGreen : S.badgeBlue;
  const typeIcon = (t: string) => t === "festival" ? "🎊" : t === "special" ? "⭐" : t === "vacation" ? "🏖️" : "🇮🇳";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📅 Holiday Calendar</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Manage school holidays</p>
      </motion.div>

      {/* Add form (admin only) */}
      {isAdmin && (
        <div className={S.card}>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary-600" />Add Holiday</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div><label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={cn(S.input, "py-2")} /></div>
            <div className="sm:col-span-2"><label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Reason</label>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Diwali" className={cn(S.input, "py-2")} /></div>
            <div><label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={cn(S.input, "py-2")}>
                <option value="public">Public</option><option value="festival">Festival</option><option value="vacation">Vacation</option><option value="special">Special</option>
              </select></div>
            <div className="sm:col-span-4 flex justify-end">
              <button onClick={add} disabled={busy} className={S.btnPrimary}><Plus className="w-4 h-4" />{busy ? "Adding…" : "Add Holiday"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className={cn(S.card, "p-0 overflow-hidden")}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><PartyPopper className="w-4 h-4 text-green-600" />Upcoming Holidays</h3>
          <span className={cn(S.badgeGreen, "text-xs")}>{upcoming.length}</span>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800">
          {upcoming.length ? upcoming.map((h, i) => (
            <motion.div key={h.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/20 dark:to-accent-900/20 shrink-0">
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">{new Date(h.date).toLocaleDateString("en-US", { month: "short" })}</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white leading-none">{new Date(h.date).getDate()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{typeIcon(h.type)} {h.reason}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(typeColor(h.type), "text-[10px] capitalize")}>{h.type}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(h.date).toLocaleDateString("en-US", { weekday: "long" })}</span>
                </div>
              </div>
              {isAdmin && <button onClick={() => del(h.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>}
            </motion.div>
          )) : <div className="text-center py-12 text-gray-400 dark:text-gray-500"><CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">No upcoming holidays</p></div>}
        </div>
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div className={cn(S.card, "p-0 overflow-hidden opacity-70")}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Past Holidays</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">{past.length}</span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {past.slice(-10).reverse().map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs text-gray-400 dark:text-gray-500 w-24">{new Date(h.date).toLocaleDateString()}</span>
                <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">{typeIcon(h.type)} {h.reason}</span>
                {isAdmin && <button onClick={() => del(h.id)} className="p-1.5 text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
