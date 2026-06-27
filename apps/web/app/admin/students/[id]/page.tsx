"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

type AttendanceRecord = { date: string; markedAt: string };

type TestResult = {
  testName: string;
  testDate: string;
  rank: number | null;
  total: number;
  percentage: number;
  percentile: number | null;
  scores: Record<string, number>;
  subjectMaxes: Record<string, number> | null;
  totalInBatch: number | null;
};

type StudentProfile = {
  id: string;
  name: string;
  enrollmentNo: string;
  batch: string;
  center: string;
  parent: { name: string; phone: string; email: string | null } | null;
  attendancePct: number;
  presentDays: number;
  totalWorkingDays: number;
  lastSeen: string | null;
  results: TestResult[];
  attendanceLog: AttendanceRecord[];
  workingDays: string[];
};

// ── Key fix: compute real percentage from scores/maxes ─────────────────────────
// The stored `percentage` field can be corrupted if max marks were entered wrong
// during upload. Always recompute from the actual scores and subjectMaxes when
// those are available — that is the authoritative source.

function realPct(r: TestResult): number {
  const maxes = r.subjectMaxes;
  if (maxes && Object.keys(maxes).length > 0) {
    const totalScore = Object.values(r.scores).reduce((a, b) => a + b, 0);
    const totalMax   = Object.values(maxes).reduce((a, b) => a + b, 0);
    if (totalMax > 0) return Math.round((totalScore / totalMax) * 1000) / 10;
  }
  return r.percentage;
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

const SUBJECT_PALETTE = [
  "#6366F1", "#0D9488", "#EC4899", "#B45309",
  "#0891B2", "#8B5CF6", "#16A34A", "#DC2626",
];

function studentAccent(n: string) {
  const p = ["#6366F1","#0D9488","#8B5CF6","#B45309","#0891B2","#BE185D","#16A34A","#1D6BF3"];
  return p[(n.charCodeAt(0) + n.charCodeAt(n.length - 1)) % p.length];
}
function attColor(p: number)   { return p >= 75 ? "#16A34A" : p >= 50 ? "#D97706" : "#DC2626"; }
function attBg(p: number)      { return p >= 75 ? "rgba(22,163,74,0.09)"  : p >= 50 ? "rgba(217,119,6,0.09)"  : "rgba(220,38,38,0.09)"; }
function scoreColor(p: number) { return p >= 70 ? "#16A34A" : p >= 50 ? "#D97706" : "#DC2626"; }

function testAccent(name: string) {
  const u = name.toUpperCase();
  if (u.includes("CRT"))   return "#6366F1";
  if (u.includes("MINOR")) return "#059669";
  if (u.includes("MAJOR")) return "#F59E0B";
  if (u.includes("MOCK"))  return "#8B5CF6";
  if (u.includes("NEET"))  return "#EC4899";
  if (u.includes("JEE"))   return "#3B82F6";
  return "#64748B";
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function initials(n: string) {
  return n.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
function fmtDateFull(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}
function fmtAgo(ts: string | null) {
  if (!ts) return "Never";
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDayShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// ── Recharts tooltip components ────────────────────────────────────────────────

function BarTip({ active, payload, label }: Record<string, unknown>) {
  if (!(active as boolean) || !(payload as unknown[])?.length) return null;
  const v = ((payload as { value: number }[])[0])?.value;
  return (
    <div style={{ background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, padding: "8px 14px", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.14)" }}>
      <div style={{ color: "var(--admin-text-faint)", marginBottom: 2 }}>{label as string}</div>
      <div style={{ color: "var(--admin-text)", fontWeight: 600 }}>{v} avg marks</div>
    </div>
  );
}

function TrendTip({ active, payload, label }: Record<string, unknown>) {
  if (!(active as boolean) || !(payload as unknown[])?.length) return null;
  const v = ((payload as { value: number }[])[0])?.value;
  return (
    <div style={{ background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, padding: "8px 14px", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", maxWidth: 200 }}>
      <div style={{ color: "var(--admin-text-faint)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label as string}</div>
      <div style={{ color: "var(--admin-text)", fontWeight: 700 }}>{Number(v).toFixed(1)}%</div>
    </div>
  );
}

// ── Attendance Calendar ────────────────────────────────────────────────────────

function AttendanceSection({
  attendanceLog, workingDays, presentDays, totalWorkingDays,
}: {
  attendanceLog: AttendanceRecord[];
  workingDays: string[];
  presentDays: number;
  totalWorkingDays: number;
}) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const workingSet = useMemo(() => new Set(workingDays), [workingDays]);

  // Map date string → all scan records for that day (could be multiple)
  const attendanceMap = useMemo(() => {
    const m = new Map<string, AttendanceRecord[]>();
    for (const rec of attendanceLog) {
      if (!m.has(rec.date)) m.set(rec.date, []);
      m.get(rec.date)!.push(rec);
    }
    return m;
  }, [attendanceLog]);

  // Build 9-week grid (Mon–Sun), most-recent week last
  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay(); // 0=Sun,1=Mon,...
    const daysToMonday = dow === 0 ? 6 : dow - 1;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - daysToMonday);
    const startDate = new Date(thisMonday);
    startDate.setDate(startDate.getDate() - 8 * 7); // 8 full weeks back

    const result: Date[][] = [];
    const cur = new Date(startDate);
    for (let w = 0; w < 9; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      result.push(week);
    }
    return result;
  }, []);

  // Month labels: find where month changes in the grid
  const monthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const m = week[0].getMonth();
      if (m !== lastMonth) {
        labels.push({ col: wi, label: week[0].toLocaleDateString("en-IN", { month: "short" }) });
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks]);

  // Recent scan log (last 20 days, deduplicated per day)
  const scanLog = useMemo(() => {
    const seen = new Map<string, AttendanceRecord[]>();
    for (const rec of attendanceLog) {
      if (!seen.has(rec.date)) seen.set(rec.date, []);
      seen.get(rec.date)!.push(rec);
    }
    return Array.from(seen.entries()).slice(0, 20);
  }, [attendanceLog]);

  const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const today = new Date(); today.setHours(23, 59, 59, 999);

  return (
    <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "22px 24px", marginBottom: 20 }}>
      {/* Section header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Attendance Calendar</p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--admin-text-faint)" }}>
            {presentDays} of {totalWorkingDays} working days in last 60 days
          </p>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--admin-text-faint)", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "#16A34A", display: "inline-block" }} />
            Present
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "#DC2626", display: "inline-block", opacity: 0.7 }} />
            Absent
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, border: "1px solid var(--admin-card-border)", display: "inline-block" }} />
            No class
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 24 }}>

        {/* ── Calendar heatmap ────────────────────────────────────────── */}
        <div style={{ overflowX: "auto" }}>
          {/* Month labels row */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(9, 28px)`, gap: 4, marginBottom: 4, marginLeft: 28 }}>
            {weeks.map((_, wi) => {
              const label = monthLabels.find(l => l.col === wi);
              return (
                <div key={wi} style={{ fontSize: 9, fontWeight: 700, color: "var(--admin-text-faint)", textAlign: "left", letterSpacing: 0.3, gridColumn: wi + 1 }}>
                  {label?.label ?? ""}
                </div>
              );
            })}
          </div>

          {/* Grid: rows = day of week (Mo–Su), cols = week */}
          <div style={{ display: "flex", gap: 4 }}>
            {/* Day labels */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginRight: 0 }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{ height: 24, width: 20, display: "flex", alignItems: "center", justifyContent: "flex-end", fontSize: 9, fontWeight: 600, color: "var(--admin-text-faint)", paddingRight: 4 }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {week.map((date, di) => {
                  const dateStr = date.toISOString().slice(0, 10);
                  const isFuture  = date > today;
                  const isWorking = workingSet.has(dateStr);
                  const recs      = attendanceMap.get(dateStr) ?? [];
                  const isPresent = recs.length > 0;

                  let bg       = "var(--admin-card-border)";
                  let opacity  = 0.35;
                  let cursor   = "default";

                  if (!isFuture && isWorking) {
                    bg      = isPresent ? "#16A34A" : "#DC2626";
                    opacity = isPresent ? 0.88 : 0.55;
                    cursor  = "pointer";
                  }

                  const isHov = hoveredDate === dateStr;
                  const scanTimes = recs.map(r => fmtTime(r.markedAt));
                  const tooltipLines = [
                    fmtDayShort(dateStr),
                    isPresent
                      ? "✓ Present · " + scanTimes.join(", ")
                      : isWorking && !isFuture
                        ? "✗ Absent"
                        : isFuture
                          ? "—"
                          : "No class",
                  ].join("\n");

                  return (
                    <div
                      key={di}
                      title={tooltipLines}
                      onMouseEnter={() => setHoveredDate(dateStr)}
                      onMouseLeave={() => setHoveredDate(null)}
                      style={{
                        width: 24, height: 24, borderRadius: 6,
                        background: bg, opacity,
                        cursor,
                        transition: "transform 0.12s, opacity 0.12s",
                        transform: isHov ? "scale(1.25)" : "scale(1)",
                        position: "relative",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Hovered date detail bar */}
          {hoveredDate && (() => {
            const recs = attendanceMap.get(hoveredDate) ?? [];
            const isWorking = workingSet.has(hoveredDate);
            const isFuture  = new Date(hoveredDate + "T00:00:00") > today;
            return (
              <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--admin-input-bg)", borderRadius: 10, border: "1px solid var(--admin-card-border)", fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: "var(--admin-text)" }}>{fmtDayShort(hoveredDate)}</span>
                <span style={{ marginLeft: 10, color: recs.length > 0 ? "#16A34A" : isWorking && !isFuture ? "#DC2626" : "var(--admin-text-faint)" }}>
                  {recs.length > 0
                    ? `Present · ${recs.map(r => fmtTime(r.markedAt)).join(" · ")}`
                    : isWorking && !isFuture
                      ? "Absent"
                      : isFuture ? "—" : "No class"}
                </span>
              </div>
            );
          })()}
        </div>

        {/* ── Punch-in scan log ───────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>
            Recent Scans
          </p>
          {scanLog.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ fontSize: 12, color: "var(--admin-text-faint)", textAlign: "center" }}>No scan records</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, overflowY: "auto", maxHeight: 290 }}>
              {scanLog.map(([date, recs], i) => (
                <div key={date} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: i < scanLog.length - 1 ? "1px solid var(--admin-card-border)" : "none" }}>
                  {/* Color dot */}
                  <div style={{ width: 8, height: 8, borderRadius: 100, background: "#16A34A", flexShrink: 0, marginTop: 3 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text)", lineHeight: 1.3 }}>
                      {fmtDayShort(date)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 2 }}>
                      {recs.map(r => fmtTime(r.markedAt)).join(" · ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Test Analysis Card ─────────────────────────────────────────────────────────

function TestCard({
  result, subjectBest,
}: {
  result: TestResult;
  subjectBest: Record<string, number>;
}) {
  const accent  = testAccent(result.testName);
  const pct     = realPct(result);
  const entries = Object.entries(result.scores);
  const maxes   = result.subjectMaxes;

  return (
    <div
      style={{
        background: "var(--admin-card-bg)", borderRadius: 18,
        border: "1px solid var(--admin-card-border)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        transition: "box-shadow 0.18s, transform 0.18s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.1)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.transform = "none";
      }}
    >
      {/* Coloured top accent strip */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}60)`, flexShrink: 0 }} />

      <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Test name + rank badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {result.testName}
            </div>
            <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 4 }}>
              {fmtDateFull(result.testDate)}
            </div>
          </div>
          {result.rank != null && (
            <div style={{ background: `${accent}12`, border: `1px solid ${accent}35`, borderRadius: 12, padding: "6px 12px", textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                #{result.rank}
              </div>
              {result.totalInBatch && (
                <div style={{ fontSize: 9, color: "var(--admin-text-faint)", marginTop: 2 }}>of {result.totalInBatch}</div>
              )}
            </div>
          )}
        </div>

        {/* Score block */}
        <div style={{ background: "var(--admin-input-bg)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--admin-card-border)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: scoreColor(pct), letterSpacing: "-1.5px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {pct.toFixed(1)}<span style={{ fontSize: 20, fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 5 }}>
                {Object.values(result.scores).reduce((a, b) => a + b, 0)} / {
                  maxes ? Object.values(maxes).reduce((a, b) => a + b, 0) : result.total
                } marks
              </div>
            </div>
            {result.percentile != null && (
              <div style={{ textAlign: "right", paddingBottom: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--admin-text)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {result.percentile}<span style={{ fontSize: 11, fontWeight: 500, color: "var(--admin-text-faint)" }}>th</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--admin-text-faint)", marginTop: 2 }}>percentile</div>
              </div>
            )}
          </div>
          {/* Overall score bar */}
          <div style={{ height: 6, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: 100, background: `linear-gradient(90deg, ${scoreColor(pct)}, ${scoreColor(pct)}90)`, transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)" }} />
          </div>
        </div>

        {/* Subject breakdown */}
        {entries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 2 }}>
              Subject Scores
            </div>
            {entries.map(([subj, score], i) => {
              const max = maxes?.[subj] ?? null;
              // If maxes available: fill = score/max. Otherwise: relative to personal best.
              const fillPct = max != null
                ? Math.min(100, (score / max) * 100)
                : Math.min(100, (score / (subjectBest[subj] || score)) * 100);
              const barColor = SUBJECT_PALETTE[i % SUBJECT_PALETTE.length];
              return (
                <div key={subj}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "var(--admin-text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {subj}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", fontVariantNumeric: "tabular-nums", marginLeft: 10, flexShrink: 0 }}>
                      {score}
                      {max != null && (
                        <span style={{ fontWeight: 400, color: "var(--admin-text-faint)", fontSize: 11 }}>/{max}</span>
                      )}
                    </span>
                  </div>
                  <div style={{ height: 5, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${fillPct}%`, borderRadius: 100, background: barColor, opacity: 0.85, transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ padding: "28px 32px 80px", maxWidth: 1120, margin: "0 auto" }}>
      <div className="admin-skeleton" style={{ height: 14, width: 60, borderRadius: 6, marginBottom: 28 }} />
      <div className="admin-skeleton" style={{ height: 128, borderRadius: 20, marginBottom: 20 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="admin-skeleton" style={{ height: 100, borderRadius: 16 }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="admin-skeleton" style={{ height: 270, borderRadius: 16 }} />
        ))}
      </div>
      <div className="admin-skeleton" style={{ height: 240, borderRadius: 16, marginBottom: 20 }} />
      <div className="admin-skeleton" style={{ height: 20, width: 160, borderRadius: 6, marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="admin-skeleton" style={{ height: 380, borderRadius: 18 }} />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StudentProfilePage() {
  const params    = useParams();
  const router    = useRouter();
  const studentId = params["id"] as string;

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/students/${studentId}/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setProfile(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [studentId]);

  // Subject averages — use realPct for consistency but compute per-subject avg marks
  const subjectAvgs = useMemo(() => {
    if (!profile) return [];
    const tot: Record<string, { sum: number; count: number }> = {};
    for (const r of profile.results) {
      for (const [s, v] of Object.entries(r.scores)) {
        if (!tot[s]) tot[s] = { sum: 0, count: 0 };
        tot[s].sum += v;
        tot[s].count++;
      }
    }
    return Object.entries(tot)
      .map(([subject, d]) => ({ subject, avg: Math.round(d.sum / d.count) }))
      .sort((a, b) => b.avg - a.avg);
  }, [profile]);

  // Personal best score per subject (for bar scaling when subjectMaxes absent)
  const subjectBest = useMemo(() => {
    if (!profile) return {};
    const best: Record<string, number> = {};
    for (const r of profile.results) {
      for (const [s, v] of Object.entries(r.scores)) {
        best[s] = Math.max(best[s] ?? 0, v);
      }
    }
    return best;
  }, [profile]);

  // Score trend (oldest → newest) using corrected percentage
  const trendData = useMemo(() => {
    if (!profile) return [];
    return [...profile.results].reverse().map(r => ({
      name: r.testName,
      pct:  realPct(r),
    }));
  }, [profile]);

  if (loading) return <LoadingSkeleton />;

  if (!profile) return (
    <div style={{ padding: "28px 32px 80px", maxWidth: 1120, margin: "0 auto" }}>
      <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--admin-text-muted)", fontSize: 13, fontWeight: 500, padding: "4px 0", marginBottom: 40 }}>
        ← Back
      </button>
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <p style={{ fontSize: 36, margin: "0 0 10px" }}>👤</p>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "var(--admin-text)" }}>Student not found</p>
        <p style={{ margin: 0, color: "var(--admin-text-faint)", fontSize: 13 }}>This profile doesn&apos;t exist or was deleted.</p>
      </div>
    </div>
  );

  const accent = studentAccent(profile.name);

  // Use corrected percentage for avg computation
  const avgScore = profile.results.length
    ? Math.round(profile.results.reduce((s, r) => s + realPct(r), 0) / profile.results.length)
    : null;

  const bestRank = profile.results.reduce<number | null>(
    (b, r) => r.rank != null && (b === null || r.rank < b) ? r.rank : b,
    null
  );

  return (
    <div style={{ padding: "28px 32px 80px", maxWidth: 1120, margin: "0 auto", fontFamily: "var(--font-geist-sans,'Geist',system-ui,sans-serif)" }}>

      {/* ── Back ──────────────────────────────────────────────────────────── */}
      <button
        onClick={() => router.back()}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          color: "var(--admin-text-muted)", fontSize: 13, fontWeight: 500,
          padding: "4px 0", marginBottom: 24, transition: "color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--admin-text)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--admin-text-muted)")}
      >
        ← Back
      </button>

      {/* ── Student header ────────────────────────────────────────────────── */}
      <div style={{
        background: "var(--admin-card-bg)", borderRadius: 20,
        border: "1px solid var(--admin-card-border)",
        padding: "24px 28px", marginBottom: 20,
        overflow: "hidden", position: "relative",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}55, transparent)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          {/* Avatar */}
          <div style={{
            width: 68, height: 68, borderRadius: 20,
            background: `${accent}14`, color: accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, flexShrink: 0, letterSpacing: "0.5px",
          }}>
            {initials(profile.name)}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.5px" }}>
              {profile.name}
            </h1>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--admin-text-muted)", fontVariantNumeric: "tabular-nums" }}>
                {profile.enrollmentNo}
              </span>
              <span style={{ color: "var(--admin-card-border)" }}>·</span>
              <span style={{ background: `${accent}14`, color: accent, borderRadius: 100, padding: "3px 12px", fontSize: 12, fontWeight: 600 }}>
                {profile.batch}
              </span>
              <span style={{ background: "var(--admin-input-bg)", color: "var(--admin-text-muted)", borderRadius: 100, padding: "3px 12px", fontSize: 12, fontWeight: 500, border: "1px solid var(--admin-card-border)" }}>
                {profile.center}
              </span>
            </div>
            {profile.parent && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--admin-text-faint)" }}>
                Parent: <strong style={{ color: "var(--admin-text-muted)" }}>{profile.parent.name}</strong>
                {" · "}{profile.parent.phone}
                {profile.parent.email && <>{" · "}{profile.parent.email}</>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>

        {/* Attendance */}
        <div style={{ background: attBg(profile.attendancePct), borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "20px 22px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>Attendance</p>
          <p style={{ margin: 0, fontSize: 30, fontWeight: 700, color: attColor(profile.attendancePct), letterSpacing: "-0.8px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {profile.attendancePct}%
          </p>
          <p style={{ margin: "6px 0 12px", fontSize: 12, color: "var(--admin-text-faint)" }}>
            {profile.presentDays} of {profile.totalWorkingDays} days
          </p>
          <div style={{ height: 4, background: "rgba(0,0,0,0.08)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, profile.attendancePct)}%`, background: attColor(profile.attendancePct), borderRadius: 100 }} />
          </div>
        </div>

        {/* Avg Score */}
        <div style={{ background: avgScore != null ? `${scoreColor(avgScore)}0D` : "var(--admin-input-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "20px 22px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>Avg Score</p>
          <p style={{ margin: 0, fontSize: 30, fontWeight: 700, color: avgScore != null ? scoreColor(avgScore) : ("var(--admin-text-faint)" as string), letterSpacing: "-0.8px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {avgScore != null ? `${avgScore}%` : "—"}
          </p>
          <p style={{ margin: "6px 0 12px", fontSize: 12, color: "var(--admin-text-faint)" }}>
            {profile.results.length} test{profile.results.length !== 1 ? "s" : ""} taken
          </p>
          {avgScore != null && (
            <div style={{ height: 4, background: "rgba(0,0,0,0.08)", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, avgScore)}%`, background: scoreColor(avgScore), borderRadius: 100 }} />
            </div>
          )}
        </div>

        {/* Best Rank */}
        <div style={{ background: "rgba(29,107,243,0.07)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "20px 22px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>Best Rank</p>
          <p style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "#1D6BF3", letterSpacing: "-0.8px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {bestRank != null ? `#${bestRank}` : "—"}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--admin-text-faint)" }}>Across all tests</p>
        </div>

        {/* Last Seen */}
        <div style={{ background: "var(--admin-input-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "20px 22px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>Last Seen</p>
          <p style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--admin-text)" as string, letterSpacing: "-0.8px", lineHeight: 1 }}>
            {fmtAgo(profile.lastSeen)}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--admin-text-faint)" }}>
            {profile.lastSeen
              ? new Date(profile.lastSeen).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })
              : "No attendance"}
          </p>
        </div>
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      {profile.results.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

          {/* Subject Averages */}
          <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "22px 24px" }}>
            <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Subject Averages</p>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: "var(--admin-text-faint)" }}>Mean marks per subject · all tests</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={subjectAvgs} barSize={36} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 11, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTip />} cursor={{ fill: "rgba(128,128,128,0.06)", radius: 6 }} />
                <Bar dataKey="avg" radius={[8, 8, 0, 0]}>
                  {subjectAvgs.map((_, i) => (
                    <Cell key={i} fill={SUBJECT_PALETTE[i % SUBJECT_PALETTE.length]} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Score Trend */}
          <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "22px 24px" }}>
            <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Score Trend</p>
            <p style={{ margin: "0 0 18px", fontSize: 12, color: "var(--admin-text-faint)" }}>Performance over time · oldest → newest</p>
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={accent} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={accent} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TrendTip />} />
                  <Area
                    type="monotone" dataKey="pct" stroke={accent} strokeWidth={2.5}
                    fill="url(#sg)"
                    dot={{ fill: accent, r: 5, strokeWidth: 0 }}
                    activeDot={{ r: 7, fill: accent, stroke: "var(--admin-card-bg)", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <p style={{ margin: 0, fontSize: 52, fontWeight: 800, color: scoreColor(trendData[0]?.pct ?? 0), letterSpacing: "-2px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {trendData[0]?.pct.toFixed(1) ?? "—"}%
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-muted)" }}>{trendData[0]?.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--admin-text-faint)" }}>2+ tests needed for trend</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Attendance Calendar ───────────────────────────────────────────── */}
      <AttendanceSection
        attendanceLog={profile.attendanceLog ?? []}
        workingDays={profile.workingDays ?? []}
        presentDays={profile.presentDays}
        totalWorkingDays={profile.totalWorkingDays}
      />

      {/* ── Test Analysis ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.3px" }}>
          Test Analysis
        </p>
        {profile.results.length > 0 && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-faint)" }}>
            {profile.results.length} test{profile.results.length !== 1 ? "s" : ""} · most recent first · subject-wise breakdown
          </p>
        )}
      </div>

      {profile.results.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {profile.results.map(r => (
            <TestCard
              key={`${r.testName}-${r.testDate}`}
              result={r}
              subjectBest={subjectBest}
            />
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px dashed var(--admin-card-border)", padding: "72px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 36, margin: "0 0 12px" }}>🏆</p>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "var(--admin-text)" }}>No results yet</p>
          <p style={{ margin: 0, color: "var(--admin-text-faint)", fontSize: 13 }}>
            Upload test results from the Results page to see detailed analytics here.
          </p>
        </div>
      )}

    </div>
  );
}
