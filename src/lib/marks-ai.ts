export interface AiMarkRecord {
  score: number;
  maxScore: number;
  type?: string;
  examName?: string;
  date?: string;
  timestamp?: number;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  rate: number;
}

export interface MarkPrediction {
  status: "need-first" | "ready";
  nextExam: string;
  expectedPercent: number;
  expectedScore: number;
  confidence: number;
  trend: "up" | "down" | "stable";
  attendance: AttendanceSummary;
  attendanceMessage: string;
  explanation: string[];
  suggestions: string[];
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const pct = (m: AiMarkRecord) => (Number(m.maxScore) > 0 ? (Number(m.score) / Number(m.maxScore)) * 100 : 0);

const DEFAULT_SEQUENCE = ["Unit Test 1", "Unit Test 2", "Mid Term", "Unit Test 3", "Unit Test 4", "Final Term"];

export function getAttendanceSummary(attendanceData: any, studentId: string, subject?: string): AttendanceSummary {
  let total = 0;
  let present = 0;
  let absent = 0;
  let late = 0;

  if (attendanceData) {
    for (const date of Object.keys(attendanceData)) {
      const byClass = attendanceData[date] || {};
      for (const cls of Object.keys(byClass)) {
        const byPeriod = byClass[cls] || {};
        for (const period of Object.keys(byPeriod)) {
          const rec = byPeriod[period]?.[studentId];
          if (!rec) continue;
          if (subject && rec.subject && String(rec.subject).toLowerCase() !== subject.toLowerCase()) continue;
          total += 1;
          if (rec.status === "present") present += 1;
          else if (rec.status === "late") {
            late += 1;
            present += 0.5; // late counts as half-present for prediction only
          } else absent += 1;
        }
      }
    }
  }

  return { total, present, absent, late, rate: total ? present / total : 0 };
}

export function attendanceTargetMessage(summary: AttendanceSummary, target = 0.75) {
  if (summary.total === 0) return "No attendance history yet. Start marking attendance for accurate guidance.";

  if (summary.rate >= target) {
    const canMiss = Math.floor((summary.present - target * summary.total) / target);
    return `Current attendance is ${Math.round(summary.rate * 100)}%. Student is above 75%. They can miss about ${Math.max(0, canMiss)} more period(s) before dropping below target.`;
  }

  const need = Math.ceil((target * summary.total - summary.present) / (1 - target));
  return `Current attendance is ${Math.round(summary.rate * 100)}%. Student needs about ${Math.max(0, need)} consecutive present period(s) to reach 75%.`;
}

function regressionForecast(values: number[]) {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const n = values.length;
  const xs = values.map((_, i) => i + 1);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  const numerator = xs.reduce((sum, x, i) => sum + (x - xMean) * (values[i] - yMean), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0) || 1;
  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;
  return clamp(intercept + slope * (n + 1), 0, 100);
}

function nextExamName(records: AiMarkRecord[]) {
  const used = new Set(records.map((r) => String(r.examName || r.type || "").toLowerCase()));
  return DEFAULT_SEQUENCE.find((x) => !used.has(x.toLowerCase()) && !used.has(x.replaceAll(" ", "_").toLowerCase())) || "Next Assessment";
}

export function predictNextMark(recordsInput: AiMarkRecord[], attendance: AttendanceSummary, nextMaxScore: number): MarkPrediction {
  const records = [...recordsInput].sort((a, b) => {
    const at = a.timestamp || (a.date ? new Date(a.date).getTime() : 0);
    const bt = b.timestamp || (b.date ? new Date(b.date).getTime() : 0);
    return at - bt;
  });

  const nextExam = nextExamName(records);
  const attendanceMessage = attendanceTargetMessage(attendance);

  if (!records.length) {
    return {
      status: "need-first",
      nextExam: "Unit Test 1",
      expectedPercent: 0,
      expectedScore: 0,
      confidence: 0,
      trend: "stable",
      attendance,
      attendanceMessage,
      explanation: [
        "No previous marks are available for this student and subject.",
        "Enter Unit Test 1 marks first. After UT1 plus attendance history, the app can predict Mid Term more safely.",
      ],
      suggestions: [
        "Add UT1 marks with the correct max marks.",
        "Keep attendance updated for every period.",
        "Add older class marks if available to improve prediction quality.",
      ],
    };
  }

  const values = records.map(pct);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const recent = values.slice(-3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const forecast = regressionForecast(values);

  // Attendance impact: below 75 hurts prediction, above 90 helps slightly.
  const attendancePercent = attendance.total ? attendance.rate * 100 : 75;
  const attendanceAdjusted = clamp(50 + (attendancePercent - 50) * 0.9, 0, 100);

  const expectedPercent = Math.round(clamp(recentAvg * 0.5 + forecast * 0.3 + attendanceAdjusted * 0.2, 0, 100));
  const expectedScore = Math.round((expectedPercent / 100) * Math.max(1, Number(nextMaxScore || 100)));
  const last = values[values.length - 1];
  const first = values[0];
  const trend: "up" | "down" | "stable" = last > first + 5 ? "up" : last < first - 5 ? "down" : "stable";
  const confidence = Math.round(clamp(35 + records.length * 12 + Math.min(20, attendance.total * 1.2), 40, 92));

  const explanation = [
    `Based on ${records.length} mark record(s), recent average is ${Math.round(recentAvg)}%.`,
    `Regression trend forecast is ${Math.round(forecast)}%.`,
    `Attendance contribution used ${Math.round(attendancePercent)}% attendance.`,
  ];

  const suggestions: string[] = [];
  if (attendance.rate < 0.75 && attendance.total > 0) suggestions.push("Improve attendance first; low attendance is reducing the prediction.");
  if (trend === "down") suggestions.push("Trend is going down. Revise weak chapters and take a small weekly test.");
  if (expectedPercent < 50) suggestions.push("Arrange remedial practice and parent-teacher follow-up.");
  if (expectedPercent >= 75) suggestions.push("Student is on a good path. Maintain attendance and revision consistency.");
  if (!suggestions.length) suggestions.push("Practice previous papers and review mistakes from the last test.");

  return { status: "ready", nextExam, expectedPercent, expectedScore, confidence, trend, attendance, attendanceMessage, explanation, suggestions };
}
