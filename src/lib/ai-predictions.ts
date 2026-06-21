/** AI Prediction Engine — trend analysis & risk assessment */

export interface StudentPrediction {
  attendance: { predicted: number; trend: "up" | "down" | "stable"; risk: "low" | "medium" | "high" };
  performance: { expected: number; confidence: number; trend: "up" | "down" | "stable" };
  bunkRisk: { probability: number; level: "green" | "yellow" | "red" };
  tips: string[];
}

export function predict(
  attendanceDays: { present: boolean }[],
  marksList: { pct: number }[],
): StudentPrediction {
  /* ─ attendance ─ */
  const total = attendanceDays.length || 1;
  const rate = attendanceDays.filter((d) => d.present).length / total;
  const half = Math.floor(total / 2);
  const r1 = attendanceDays.slice(0, half).filter((d) => d.present).length / (half || 1);
  const r2 = attendanceDays.slice(half).filter((d) => d.present).length / ((total - half) || 1);
  const attTrend: "up" | "down" | "stable" = r2 > r1 + 0.05 ? "up" : r2 < r1 - 0.05 ? "down" : "stable";
  const predicted = Math.round((rate * 0.4 + r2 * 0.6) * 100);
  const risk: "low" | "medium" | "high" = predicted >= 80 ? "low" : predicted >= 60 ? "medium" : "high";

  /* ─ performance ─ */
  const pcts = marksList.map((m) => m.pct);
  const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
  const recent = pcts.slice(-3);
  const rAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : avg;
  const expected = Math.round(avg * 0.4 + rAvg * 0.6);
  const perfTrend: "up" | "down" | "stable" = rAvg > avg + 3 ? "up" : rAvg < avg - 3 ? "down" : "stable";
  const confidence = Math.min(95, 40 + pcts.length * 8 + (rate > 0.8 ? 15 : 0));

  /* ─ bunk risk ─ */
  const recentAbsent = attendanceDays.slice(-14).filter((d) => !d.present).length;
  const bunkP = Math.min(100, Math.round((recentAbsent / 14) * 100));
  const level: "green" | "yellow" | "red" = bunkP > 50 ? "red" : bunkP > 25 ? "yellow" : "green";

  /* ─ tips ─ */
  const tips: string[] = [];
  if (risk === "high") tips.push("⚠️ Schedule parent-teacher meeting immediately");
  if (attTrend === "down") tips.push("📉 Implement daily check-in system");
  if (expected < 50) tips.push("📚 Arrange extra tutoring sessions");
  if (bunkP > 30) tips.push("👀 Monitor during free periods");
  if (!tips.length) tips.push("✅ Student is on track — keep encouraging");

  return {
    attendance: { predicted, trend: attTrend, risk },
    performance: { expected, confidence, trend: perfTrend },
    bunkRisk: { probability: bunkP, level },
    tips,
  };
}
