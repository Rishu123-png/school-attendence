import { useState } from "react";
import { motion } from "framer-motion";
import { useSchoolData } from "@/hooks/useSchoolData";
import { CalendarDays, MapPin, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { S } from "@/lib/styles";

export default function SchedulePage() {
  const { timetable, classes } = useSchoolData();
  const [selectedDay, setSelectedDay] = useState(["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date().getDay()]);
  const [selectedClass, setSelectedClass] = useState("");

  const days = ["monday","tuesday","wednesday","thursday","friday","saturday"];
  const dayIdx = days.indexOf(selectedDay);

  const slots = timetable.filter((s) => s.day?.toLowerCase() === selectedDay && (!selectedClass || s.class === selectedClass)).sort((a, b) => a.time.localeCompare(b.time));

  const colors = ["bg-primary-100 text-primary-700 border-primary-200","bg-accent-100 text-accent-700 border-accent-200","bg-green-100 text-green-700 border-green-200","bg-orange-100 text-orange-700 border-orange-200","bg-purple-100 text-purple-700 border-purple-200","bg-teal-100 text-teal-700 border-teal-200","bg-cyan-100 text-cyan-700 border-cyan-200","bg-pink-100 text-pink-700 border-pink-200"];
  const pColor = (p: string) => colors[(parseInt(p.replace(/\D/g, "")) - 1) % colors.length];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">📅 Timetable</h1><p className="text-gray-500 text-sm">Weekly class schedule</p></div>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className={cn(S.input, "py-2 w-auto")}>
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={S.card}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => dayIdx > 0 && setSelectedDay(days[dayIdx - 1])} disabled={dayIdx <= 0} className={cn(S.btnGhost, "p-2")}><ChevronLeft className="w-5 h-5" /></button>
          <div className="text-center"><h2 className="text-lg font-bold text-gray-900 capitalize">{selectedDay}</h2><p className="text-xs text-gray-400">{slots.length} periods</p></div>
          <button onClick={() => dayIdx < days.length - 1 && setSelectedDay(days[dayIdx + 1])} disabled={dayIdx >= days.length - 1} className={cn(S.btnGhost, "p-2")}><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {days.map((d) => (
            <button key={d} onClick={() => setSelectedDay(d)}
              className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                selectedDay === d ? "bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100")}>
              {d.charAt(0).toUpperCase() + d.slice(1, 3)}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
        {slots.length ? slots.map((slot, i) => (
          <motion.div key={slot.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            className={cn(S.cardHover, "flex items-center gap-4")}>
            <div className="flex flex-col items-center min-w-[60px]"><span className="text-xs text-gray-400">{slot.period}</span><span className="text-sm font-bold text-gray-900">{slot.time}</span></div>
            <div className={cn("px-3 py-2 rounded-lg border text-sm font-semibold", pColor(slot.period))}>{slot.period}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{slot.subject}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs text-gray-500"><Users className="w-3 h-3" />{slot.class || "—"}</span>
                <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin className="w-3 h-3" />Room {slot.room || "—"}</span>
                {slot.type && <span className={S.badgeBlue + " text-[10px]"}>{slot.type}</span>}
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="text-center py-16 text-gray-400"><CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-40" /><p className="text-base font-medium">No classes scheduled</p></div>
        )}
      </motion.div>
    </div>
  );
}
