"use client";

import { useState, useEffect, useMemo, memo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
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

// ── Correct percentage: sum(scores)/sum(maxes) beats the stored field ──────────

function realPct(r: TestResult): number {
  const maxes = r.subjectMaxes;
  if (maxes && Object.keys(maxes).length > 0) {
    const totalScore = Object.values(r.scores).reduce((a, b) => a + b, 0);
    const totalMax   = Object.values(maxes).reduce((a, b) => a + b, 0);
    if (totalMax > 0) return Math.round((totalScore / totalMax) * 1000) / 10;
  }
  return r.percentage;
}

// ── Colour palette ─────────────────────────────────────────────────────────────

const SUBJ_COLORS = [
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

// ── Animation variants ─────────────────────────────────────────────────────────

const sp = { type: "spring" as const, stiffness: 100, damping: 22 };

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: sp },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

// ── Spring count-up number ─────────────────────────────────────────────────────

const AnimatedNumber = memo(function AnimatedNumber({
  target, suffix = "",
}: { target: number; suffix?: string }) {
  const mv  = useMotionValue(0);
  const sv  = useSpring(mv, { stiffness: 60, damping: 20 });
  const out = useTransform(sv, v => String(Math.round(v)));
  useEffect(() => {
    const t = setTimeout(() => mv.set(target), 400);
    return () => clearTimeout(t);
  }, [target, mv]);
  return (
    <><motion.span style={{ fontVariantNumeric: "tabular-nums" }}>{out}</motion.span>{suffix}</>
  );
});

// ── Recharts tooltip ───────────────────────────────────────────────────────────

function BarTip({ active, payload, label }: Record<string, unknown>) {
  if (!(active as boolean) || !(payload as unknown[])?.length) return null;
  const v = ((payload as { value: number }[])[0])?.value;
  return (
    <div style={{
      background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)",
      borderRadius: 12, padding: "10px 16px", fontSize: 12,
      boxShadow: "0 12px 36px rgba(0,0,0,0.15)",
    }}>
      <div style={{ color: "var(--admin-text-faint)", marginBottom: 4, fontWeight: 500 }}>{label as string}</div>
      <div style={{ color: "var(--admin-text)", fontWeight: 700, fontSize: 15 }}>{v} avg</div>
    </div>
  );
}

function TrendTip({ active, payload, label }: Record<string, unknown>) {
  if (!(active as boolean) || !(payload as unknown[])?.length) return null;
  const v = ((payload as { value: number }[])[0])?.value;
  return (
    <div style={{
      background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)",
      borderRadius: 12, padding: "10px 16px", fontSize: 12,
      boxShadow: "0 12px 36px rgba(0,0,0,0.15)", maxWidth: 200,
    }}>
      <div style={{ color: "var(--admin-text-faint)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{label as string}</div>
      <div style={{ color: "var(--admin-text)", fontWeight: 700, fontSize: 15 }}>{Number(v).toFixed(1)}%</div>
    </div>
  );
}

// ── Attendance calendar ────────────────────────────────────────────────────────

function AttendanceSection({
  attendanceLog, workingDays, presentDays, totalWorkingDays,
}: {
  attendanceLog: AttendanceRecord[];
  workingDays: string[];
  presentDays: number;
  totalWorkingDays: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const workingSet = useMemo(() => new Set(workingDays), [workingDays]);

  const attMap = useMemo(() => {
    const m = new Map<string, AttendanceRecord[]>();
    for (const rec of attendanceLog) {
      if (!m.has(rec.date)) m.set(rec.date, []);
      m.get(rec.date)!.push(rec);
    }
    return m;
  }, [attendanceLog]);

  // 9 weeks × 7 days — GitHub contribution graph orientation
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const daysToMon = dow === 0 ? 6 : dow - 1;
    const thisMon = new Date(today);
    thisMon.setDate(today.getDate() - daysToMon);
    const start = new Date(thisMon);
    start.setDate(start.getDate() - 8 * 7);

    const cols: Date[][] = [];
    const cur = new Date(start);
    for (let w = 0; w < 9; w++) {
      const col: Date[] = [];
      for (let d = 0; d < 7; d++) {
        col.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      cols.push(col);
    }

    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    cols.forEach((col, ci) => {
      const m = col[0].getMonth();
      if (m !== lastMonth) {
        labels.push({ col: ci, label: col[0].toLocaleDateString("en-IN", { month: "short" }) });
        lastMonth = m;
      }
    });

    return { weeks: cols, monthLabels: labels };
  }, []);

  const scanLog = useMemo(() => {
    const seen = new Map<string, AttendanceRecord[]>();
    for (const rec of attendanceLog) {
      if (!seen.has(rec.date)) seen.set(rec.date, []);
      seen.get(rec.date)!.push(rec);
    }
    return Array.from(seen.entries()).slice(0, 18);
  }, [attendanceLog]);

  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  return (
    <motion.div
      variants={fadeUp}
      style={{
        background: "var(--admin-card-bg)", borderRadius: 20,
        border: "1px solid var(--admin-card-border)",
        padding: "24px 28px", marginBottom: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.2px" }}>Attendance Calendar</p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--admin-text-faint)" }}>
            {presentDays} of {totalWorkingDays} working days · last 60 days
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--admin-text-faint)", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "#16A34A", display: "inline-block" }} />
            Present
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "#DC2626", display: "inline-block", opacity: 0.65 }} />
            Absent
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, border: "1px solid var(--admin-card-border)", display: "inline-block" }} />
            No class
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 256px", gap: 28 }}>

        {/* GitHub-style heatmap: day rows × week columns */}
        <div>
          <div style={{ display: "flex", gap: 5 }}>
            {/* Day labels */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 20, marginRight: 2 }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{ height: 22, width: 18, display: "flex", alignItems: "center", justifyContent: "flex-end", fontSize: 9, fontWeight: 700, color: "var(--admin-text-faint)", paddingRight: 4 }}>
                  {d}
                </div>
              ))}
            </div>

            <div style={{ flex: 1 }}>
              {/* Month labels */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 26px)", gap: 4, height: 16, marginBottom: 4 }}>
                {weeks.map((_, wi) => {
                  const ml = monthLabels.find(m => m.col === wi);
                  return (
                    <div key={wi} style={{ fontSize: 9, fontWeight: 700, color: "var(--admin-text-faint)", letterSpacing: 0.4 }}>
                      {ml?.label ?? ""}
                    </div>
                  );
                })}
              </div>

              {/* 7 rows × 9 cols with column-first flow */}
              <div style={{
                display: "grid",
                gridTemplateRows: "repeat(7, 22px)",
                gridTemplateColumns: "repeat(9, 26px)",
                gap: 4,
                gridAutoFlow: "column",
              }}>
                {weeks.flatMap((col, wi) =>
                  col.map((date, di) => {
                    const dateStr  = date.toISOString().slice(0, 10);
                    const isFuture = date > now;
                    const isWork   = workingSet.has(dateStr);
                    const recs     = attMap.get(dateStr) ?? [];
                    const isOk     = recs.length > 0;

                    let bg  = "var(--admin-card-border)";
                    let op  = 0.3;
                    if (!isFuture && isWork) {
                      bg = isOk ? "#16A34A" : "#DC2626";
                      op = isOk ? 0.9 : 0.55;
                    }
                    const isHov = hovered === dateStr;
                    const tip = [
                      fmtDayShort(dateStr),
                      isOk       ? "✓ Present · " + recs.map(r => fmtTime(r.markedAt)).join(", ")
                        : isWork && !isFuture ? "✗ Absent"
                        : isFuture ? "—" : "No class",
                    ].join("\n");

                    return (
                      <div
                        key={`${wi}-${di}`}
                        title={tip}
                        onMouseEnter={() => setHovered(dateStr)}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                          width: 22, height: 22, borderRadius: 5,
                          background: bg, opacity: op,
                          cursor: isWork && !isFuture ? "pointer" : "default",
                          transition: "transform 0.1s ease, opacity 0.1s ease",
                          transform: isHov ? "scale(1.35)" : "scale(1)",
                        }}
                      />
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Hover detail strip */}
          <div style={{ marginTop: 12, height: 38 }}>
            {hovered && (() => {
              const recs   = attMap.get(hovered) ?? [];
              const isWork = workingSet.has(hovered);
              const isFut  = new Date(hovered + "T00:00:00") > now;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ padding: "9px 14px", background: "var(--admin-input-bg)", borderRadius: 10, border: "1px solid var(--admin-card-border)", fontSize: 12, display: "inline-flex", gap: 10, alignItems: "center" }}
                >
                  <span style={{ fontWeight: 700, color: "var(--admin-text)" }}>{fmtDayShort(hovered)}</span>
                  <span style={{ color: recs.length > 0 ? "#16A34A" : isWork && !isFut ? "#DC2626" : "var(--admin-text-faint)" }}>
                    {recs.length > 0
                      ? `Present · ${recs.map(r => fmtTime(r.markedAt)).join(" · ")}`
                      : isWork && !isFut ? "Absent"
                      : isFut ? "—" : "No class"}
                  </span>
                </motion.div>
              );
            })()}
          </div>
        </div>

        {/* Scan log */}
        <div>
          <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 800, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 1.2 }}>
            Recent Scans
          </p>
          {scanLog.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--admin-text-faint)", margin: 0 }}>No records</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", maxHeight: 250, overflowY: "auto" }}>
              {scanLog.map(([date, recs], i) => (
                <div key={date} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < scanLog.length - 1 ? "1px solid var(--admin-card-border)" : "none", alignItems: "flex-start" }}>
                  <div style={{ width: 7, height: 7, borderRadius: 100, background: "#16A34A", flexShrink: 0, marginTop: 4 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text)", lineHeight: 1.3 }}>{fmtDayShort(date)}</div>
                    <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 2 }}>{recs.map(r => fmtTime(r.markedAt)).join(" · ")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Test card ─────────────────────────────────────────────────────────────────

const TestCard = memo(function TestCard({
  result, subjectBest,
}: { result: TestResult; subjectBest: Record<string, number> }) {
  const accent  = testAccent(result.testName);
  const pct     = realPct(result);
  const entries = Object.entries(result.scores);
  const maxes   = result.subjectMaxes;
  const total   = entries.reduce((s, [, v]) => s + v, 0);
  const maxTotal = maxes ? Object.values(maxes).reduce((s, v) => s + v, 0) : result.total;

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, boxShadow: "0 20px 56px rgba(0,0,0,0.13)" }}
      transition={{ duration: 0.2 }}
      style={{
        background: "var(--admin-card-bg)", borderRadius: 18,
        border: "1px solid var(--admin-card-border)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      {/* Top accent strip */}
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
            <div style={{ background: `${accent}12`, border: `1px solid ${accent}30`, borderRadius: 12, padding: "6px 12px", textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>#{result.rank}</div>
              {result.totalInBatch && <div style={{ fontSize: 9, color: "var(--admin-text-faint)", marginTop: 2 }}>of {result.totalInBatch}</div>}
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
                {total} / {maxTotal} marks
              </div>
            </div>
            {result.percentile != null && (
              <div style={{ textAlign: "right", paddingBottom: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {result.percentile}<span style={{ fontSize: 11, color: "var(--admin-text-faint)", fontWeight: 500 }}>th</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--admin-text-faint)", marginTop: 2 }}>percentile</div>
              </div>
            )}
          </div>
          {/* Overall score bar — animated */}
          <div style={{ height: 6, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.min(1, pct / 100) }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              style={{ height: "100%", width: "100%", borderRadius: 100, background: `linear-gradient(90deg,${scoreColor(pct)},${scoreColor(pct)}80)`, transformOrigin: "left center" }}
            />
          </div>
        </div>

        {/* Subject breakdown */}
        {entries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 2 }}>
              Subject Scores
            </div>
            {entries.map(([subj, score], i) => {
              const max     = maxes?.[subj] ?? null;
              const fillPct = max != null
                ? Math.min(100, (score / max) * 100)
                : Math.min(100, (score / (subjectBest[subj] || score)) * 100);
              return (
                <div key={subj}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "var(--admin-text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subj}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", fontVariantNumeric: "tabular-nums", marginLeft: 10, flexShrink: 0 }}>
                      {score}
                      {max != null && <span style={{ fontWeight: 400, color: "var(--admin-text-faint)", fontSize: 11 }}>/{max}</span>}
                    </span>
                  </div>
                  <div style={{ height: 5, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: fillPct / 100 }}
                      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.45 + i * 0.07 }}
                      style={{ height: "100%", width: "100%", borderRadius: 100, background: SUBJ_COLORS[i % SUBJ_COLORS.length], opacity: 0.88, transformOrigin: "left center" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ padding: "28px 32px 80px", maxWidth: 1120, margin: "0 auto" }}>
      <div className="admin-skeleton" style={{ height: 14, width: 60, borderRadius: 6, marginBottom: 28 }} />
      <div className="admin-skeleton" style={{ height: 130, borderRadius: 20, marginBottom: 20 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="admin-skeleton" style={{ height: 106, borderRadius: 16 }} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="admin-skeleton" style={{ height: 274, borderRadius: 16 }} />)}
      </div>
      <div className="admin-skeleton" style={{ height: 240, borderRadius: 20, marginBottom: 20 }} />
      <div className="admin-skeleton" style={{ height: 22, width: 160, borderRadius: 6, marginBottom: 18 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="admin-skeleton" style={{ height: 390, borderRadius: 18 }} />)}
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

  const subjectAvgs = useMemo(() => {
    if (!profile) return [];
    const tot: Record<string, { sum: number; count: number }> = {};
    for (const r of profile.results) {
      for (const [s, v] of Object.entries(r.scores)) {
        if (!tot[s]) tot[s] = { sum: 0, count: 0 };
        tot[s].sum += v; tot[s].count++;
      }
    }
    return Object.entries(tot)
      .map(([subject, d]) => ({ subject, avg: Math.round(d.sum / d.count) }))
      .sort((a, b) => b.avg - a.avg);
  }, [profile]);

  const subjectBest = useMemo(() => {
    if (!profile) return {};
    const best: Record<string, number> = {};
    for (const r of profile.results) {
      for (const [s, v] of Object.entries(r.scores)) best[s] = Math.max(best[s] ?? 0, v);
    }
    return best;
  }, [profile]);

  const trendData = useMemo(() => {
    if (!profile) return [];
    return [...profile.results].reverse().map(r => ({ name: r.testName, pct: realPct(r) }));
  }, [profile]);

  // Adaptive Y-axis: tight range around actual scores so small differences show
  const [trendMin, trendMax] = useMemo(() => {
    if (!trendData.length) return [0, 100];
    const pcts = trendData.map(d => d.pct);
    const lo = Math.min(...pcts);
    const hi = Math.max(...pcts);
    const pad = Math.max(8, (hi - lo) * 0.4);
    return [Math.max(0, Math.floor(lo - pad)), Math.min(100, Math.ceil(hi + pad))];
  }, [trendData]);

  if (loading) return <LoadingSkeleton />;

  if (!profile) return (
    <div style={{ padding: "28px 32px 80px", maxWidth: 1120, margin: "0 auto" }}>
      <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--admin-text-muted)", fontSize: 13, fontWeight: 500, padding: "4px 0", marginBottom: 40 }}>← Back</button>
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <p style={{ fontSize: 36, margin: "0 0 10px" }}>👤</p>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "var(--admin-text)" }}>Student not found</p>
        <p style={{ margin: 0, color: "var(--admin-text-faint)", fontSize: 13 }}>This profile doesn&apos;t exist or was deleted.</p>
      </div>
    </div>
  );

  const accent   = studentAccent(profile.name);
  const avgScore = profile.results.length
    ? Math.round(profile.results.reduce((s, r) => s + realPct(r), 0) / profile.results.length)
    : null;
  const bestRank = profile.results.reduce<number | null>(
    (b, r) => r.rank != null && (b === null || r.rank < b) ? r.rank : b, null
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ padding: "28px 32px 80px", maxWidth: 1120, margin: "0 auto", fontFamily: "var(--font-geist-sans,'Geist',system-ui,sans-serif)" }}
    >

      {/* Back */}
      <motion.button
        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
        transition={{ ...sp, delay: 0.04 }}
        whileHover={{ x: -2 }} whileTap={{ scale: 0.97 }}
        onClick={() => router.back()}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--admin-text-muted)", fontSize: 13, fontWeight: 500, padding: "4px 0", marginBottom: 24 }}
      >
        ← Back
      </motion.button>

      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* ── Header card ─────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} style={{
          background: "var(--admin-card-bg)", borderRadius: 20,
          border: "1px solid var(--admin-card-border)",
          padding: "26px 30px", marginBottom: 20,
          overflow: "hidden", position: "relative",
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        }}>
          {/* Gradient accent top strip */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}55, transparent)` }} />
          {/* Subtle corner glow */}
          <div style={{ position: "absolute", top: 0, left: 0, width: 320, height: 160, background: `radial-gradient(ellipse at 0% 0%, ${accent}10, transparent 70%)`, pointerEvents: "none" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", position: "relative" }}>
            {/* Avatar with accent ring */}
            <div style={{
              width: 72, height: 72, borderRadius: 22,
              background: `${accent}14`, color: accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 800, letterSpacing: "0.5px", flexShrink: 0,
              boxShadow: `0 0 0 3px var(--admin-card-bg), 0 0 0 5px ${accent}30`,
            }}>
              {initials(profile.name)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--admin-text)", letterSpacing: "-0.8px", lineHeight: 1.1 }}>
                {profile.name}
              </h1>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--admin-text-muted)", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                  {profile.enrollmentNo}
                </span>
                <span style={{ color: "var(--admin-card-border)" }}>·</span>
                <span style={{ background: `${accent}14`, color: accent, borderRadius: 100, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                  {profile.batch}
                </span>
                <span style={{ background: "var(--admin-input-bg)", color: "var(--admin-text-muted)", borderRadius: 100, padding: "3px 12px", fontSize: 12, fontWeight: 500, border: "1px solid var(--admin-card-border)" }}>
                  {profile.center}
                </span>
              </div>
              {profile.parent && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--admin-text-faint)" }}>
                  Parent: <strong style={{ color: "var(--admin-text-muted)", fontWeight: 600 }}>{profile.parent.name}</strong>
                  {" · "}{profile.parent.phone}
                  {profile.parent.email && <>{" · "}{profile.parent.email}</>}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Stat cards ───────────────────────────────────────────────────── */}
        <motion.div variants={stagger} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>

          {/* Attendance */}
          <motion.div variants={fadeUp} style={{ background: attBg(profile.attendancePct), borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "20px 22px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: attColor(profile.attendancePct), textTransform: "uppercase", letterSpacing: 1.2 }}>Attendance</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: attColor(profile.attendancePct), letterSpacing: "-1.2px", lineHeight: 1 }}>
              <AnimatedNumber target={profile.attendancePct} suffix="%" />
            </p>
            <p style={{ margin: "6px 0 12px", fontSize: 12, color: "var(--admin-text-faint)" }}>
              {profile.presentDays} of {profile.totalWorkingDays} days
            </p>
            <div style={{ height: 4, background: "rgba(0,0,0,0.09)", borderRadius: 100, overflow: "hidden" }}>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.min(1, profile.attendancePct / 100) }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                style={{ height: "100%", width: "100%", background: attColor(profile.attendancePct), borderRadius: 100, transformOrigin: "left center" }}
              />
            </div>
          </motion.div>

          {/* Avg Score */}
          <motion.div variants={fadeUp} style={{ background: avgScore != null ? `${scoreColor(avgScore)}0D` : "var(--admin-input-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "20px 22px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: avgScore != null ? scoreColor(avgScore) : "var(--admin-text-faint)" as string, textTransform: "uppercase", letterSpacing: 1.2 }}>Avg Score</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: avgScore != null ? scoreColor(avgScore) : "var(--admin-text-faint)" as string, letterSpacing: "-1.2px", lineHeight: 1 }}>
              {avgScore != null ? <AnimatedNumber target={avgScore} suffix="%" /> : "—"}
            </p>
            <p style={{ margin: "6px 0 12px", fontSize: 12, color: "var(--admin-text-faint)" }}>
              {profile.results.length} test{profile.results.length !== 1 ? "s" : ""} taken
            </p>
            {avgScore != null && (
              <div style={{ height: 4, background: "rgba(0,0,0,0.09)", borderRadius: 100, overflow: "hidden" }}>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.min(1, avgScore / 100) }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
                  style={{ height: "100%", width: "100%", background: scoreColor(avgScore), borderRadius: 100, transformOrigin: "left center" }}
                />
              </div>
            )}
          </motion.div>

          {/* Best Rank */}
          <motion.div variants={fadeUp} style={{ background: "rgba(29,107,243,0.07)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "20px 22px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: "#1D6BF3", textTransform: "uppercase", letterSpacing: 1.2 }}>Best Rank</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: "#1D6BF3", letterSpacing: "-1.2px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {bestRank != null ? `#${bestRank}` : "—"}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--admin-text-faint)" }}>Across all tests</p>
          </motion.div>

          {/* Last Seen */}
          <motion.div variants={fadeUp} style={{ background: "var(--admin-input-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "20px 22px" }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, color: "var(--admin-text-faint)" as string, textTransform: "uppercase", letterSpacing: 1.2 }}>Last Seen</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: "var(--admin-text)" as string, letterSpacing: "-1.2px", lineHeight: 1 }}>
              {fmtAgo(profile.lastSeen)}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--admin-text-faint)" }}>
              {profile.lastSeen
                ? new Date(profile.lastSeen).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })
                : "No attendance"}
            </p>
          </motion.div>
        </motion.div>

        {/* ── Charts ───────────────────────────────────────────────────────── */}
        {profile.results.length > 0 && (
          <motion.div variants={stagger} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

            {/* Subject Averages */}
            <motion.div variants={fadeUp} style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "22px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.2px" }}>Subject Averages</p>
              <p style={{ margin: "0 0 18px", fontSize: 12, color: "var(--admin-text-faint)" }}>Mean marks across all tests</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={subjectAvgs} barSize={36} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 11, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTip />} cursor={{ fill: "rgba(128,128,128,0.06)", radius: 6 }} />
                  <Bar dataKey="avg" radius={[8, 8, 0, 0]}>
                    {subjectAvgs.map((_, i) => (
                      <Cell key={i} fill={SUBJ_COLORS[i % SUBJ_COLORS.length]} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Score Trend — adaptive Y-axis so small differences are visible */}
            <motion.div variants={fadeUp} style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "22px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.2px" }}>Score Trend</p>
              <p style={{ margin: "0 0 18px", fontSize: 12, color: "var(--admin-text-faint)" }}>Performance over time · oldest → newest</p>
              {trendData.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                    <defs>
                      <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={accent} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={accent} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[trendMin, trendMax]} tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TrendTip />} />
                    <Area
                      type="monotone" dataKey="pct" stroke={accent} strokeWidth={2.5}
                      fill="url(#tg)"
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
            </motion.div>
          </motion.div>
        )}

        {/* ── Attendance calendar ───────────────────────────────────────────── */}
        <AttendanceSection
          attendanceLog={profile.attendanceLog ?? []}
          workingDays={profile.workingDays ?? []}
          presentDays={profile.presentDays}
          totalWorkingDays={profile.totalWorkingDays}
        />

        {/* ── Test analysis title ───────────────────────────────────────────── */}
        <motion.div variants={fadeUp} style={{ marginBottom: 18, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)", letterSpacing: "-0.4px" }}>
            Test Analysis
          </p>
          {profile.results.length > 0 && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-faint)" }}>
              {profile.results.length} test{profile.results.length !== 1 ? "s" : ""} · subject-wise marks breakdown
            </p>
          )}
        </motion.div>

        {/* ── Test cards grid ───────────────────────────────────────────────── */}
        {profile.results.length > 0 ? (
          <motion.div variants={stagger} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {profile.results.map(r => (
              <TestCard key={`${r.testName}-${r.testDate}`} result={r} subjectBest={subjectBest} />
            ))}
          </motion.div>
        ) : (
          <motion.div variants={fadeUp} style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px dashed var(--admin-card-border)", padding: "72px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 36, margin: "0 0 12px" }}>🏆</p>
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "var(--admin-text)" }}>No results yet</p>
            <p style={{ margin: 0, color: "var(--admin-text-faint)", fontSize: 13 }}>
              Upload test results from the Results page to see detailed analytics here.
            </p>
          </motion.div>
        )}

      </motion.div>
    </motion.div>
  );
}
