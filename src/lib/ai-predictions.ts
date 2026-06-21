/**
 * AI Prediction Engine — trend analysis & risk assessment
 * Enhanced with day-of-week patterns, subject-wise analysis, streaks
 */

export interface StudentPrediction {
  attendance: { predicted: number; trend: "up" | "down" | "stable"; risk: "low" | "medium" | "high" };
  performance: { expected: number; confidence: number; trend: "up" | "down" | "stable" };
  bunkRisk: { probability: number; level: "green" | "yellow" | "red" };
  tips: string[];
  streak: { current: number; type: "present" | "absent" | "none" };
  dayPattern: { worstDay: string; worstDayRate: number };
}

interface AttendanceDay {
  present: boolean;
  date?: string;    // YYYY-MM-DD
  subject?: string;
}

interface MarkEntry {
  pct: number;
  subject?: string;
  date?: string;
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function predict(
  attendanceDays: AttendanceDay[],
  marksList: MarkEntry[],
): StudentPrediction {
  const total = attendanceDays.length || 1;
  const presentCount = attendanceDays.filter((d) => d.present).length;
  const rate = presentCount / total;

  /* ── Trend: compare first half vs second half ── */
  const half = Math.floor(total / 2);
  const r1 = attendanceDays.slice(0, half).filter((d) => d.present).length / (half || 1);
  const r2 = attendanceDays.slice(half).filter((d) => d.present).length / ((total - half) || 1);
  const attTrend: "up" | "down" | "stable" = r2 > r1 + 0.05 ? "up" : r2 < r1 - 0.05 ? "down" : "stable";
  const predicted = Math.round((rate * 0.4 + r2 * 0.6) * 100);
  const risk: "low" | "medium" | "high" = predicted >= 80 ? "low" : predicted >= 60 ? "medium" : "high";

  /* ── Performance ── */
  const pcts = marksList.map((m) => m.pct);
  const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
  const recent = pcts.slice(-3);
  const rAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : avg;
  const expected = Math.round(avg * 0.4 + rAvg * 0.6);
  const perfTrend: "up" | "down" | "stable" = rAvg > avg + 3 ? "up" : rAvg < avg - 3 ? "down" : "stable";
  const confidence = Math.min(95, 40 + pcts.length * 8 + (rate > 0.8 ? 15 : 0));

  /* ── Bunk risk: weighted recent 14 days more heavily ── */
  const recent14 = attendanceDays.slice(-14);
  const recentAbsent = recent14.filter((d) => !d.present).length;
  const bunkP = Math.min(100, Math.round((recentAbsent / (recent14.length || 1)) * 100));
  const level: "green" | "yellow" | "red" = bunkP > 50 ? "red" : bunkP > 25 ? "yellow" : "green";

  /* ── Streak detection ── */
  let streak = 0;
  let streakType: "present" | "absent" | "none" = "none";
  if (attendanceDays.length > 0) {
    const last = attendanceDays[attendanceDays.length - 1];
    streakType = last.present ? "present" : "absent";
    for (let i = attendanceDays.length - 1; i >= 0; i--) {
      if (attendanceDays[i].present === last.present) streak++;
      else break;
    }
  }

  /* ── Day-of-week pattern: which day are they most absent ── */
  const dayBuckets: Record<string, { total: number; absent: number }> = {};
  for (const d of attendanceDays) {
    if (!d.date) continue;
    const dayIdx = new Date(d.date).getDay();
    const dayName = DAY_NAMES[dayIdx];
    if (!dayBuckets[dayName]) dayBuckets[dayName] = { total: 0, absent: 0 };
    dayBuckets[dayName].total++;
    if (!d.present) dayBuckets[dayName].absent++;
  }
  let worstDay = "";
  let worstDayRate = 0;
  for (const [day, b] of Object.entries(dayBuckets)) {
    const absRate = b.total > 0 ? b.absent / b.total : 0;
    if (absRate > worstDayRate && b.total >= 2) {
      worstDayRate = Math.round(absRate * 100);
      worstDay = day;
    }
  }

  /* ── Subject-wise bunk pattern ── */
  const subjectAbsence: Record<string, { total: number; absent: number }> = {};
  for (const d of attendanceDays) {
    if (!d.subject) continue;
    if (!subjectAbsence[d.subject]) subjectAbsence[d.subject] = { total: 0, absent: 0 };
    subjectAbsence[d.subject].total++;
    if (!d.present) subjectAbsence[d.subject].absent++;
  }
  let worstSubject = "";
  let worstSubjectRate = 0;
  for (const [sub, b] of Object.entries(subjectAbsence)) {
    const absRate = b.total > 0 ? b.absent / b.total : 0;
    if (absRate > worstSubjectRate && b.total >= 2) {
      worstSubjectRate = Math.round(absRate * 100);
      worstSubject = sub;
    }
  }

  /* ── Tips ── */
  const tips: string[] = [];
  if (risk === "high") tips.push("⚠️ Schedule parent-teacher meeting immediately");
  if (attTrend === "down") tips.push("📉 Implement daily check-in system");
  if (expected < 50) tips.push("📚 Arrange extra tutoring sessions");
  if (bunkP > 30) tips.push("👀 Monitor during free periods");
  if (streakType === "absent" && streak >= 3) tips.push(`🚨 ${streak}-day absence streak — contact parents now`);
  if (worstDay) tips.push(`📅 Most absent on ${worstDay}s (${worstDayRate}% absence rate)`);
  if (worstSubject) tips.push(`📖 Frequently skips ${worstSubject} (${worstSubjectRate}% absence rate)`);
  if (!tips.length) tips.push("✅ Student is on track — keep encouraging");

  return {
    attendance: { predicted, trend: attTrend, risk },
    performance: { expected, confidence, trend: perfTrend },
    bunkRisk: { probability: bunkP, level },
    tips,
    streak: { current: streak, type: streakType },
    dayPattern: { worstDay, worstDayRate },
  };
}
