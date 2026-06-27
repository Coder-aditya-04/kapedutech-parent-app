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

// ── Correct percentage: sum(scores)/sum(maxes) ────────────────────────────────

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

const SUBJ_COLORS = ["#6366F1","#0D9488","#EC4899","#B45309","#0891B2","#8B5CF6","#16A34A","#DC2626"];

const ACCENT_POOL = ["#6366F1","#0D9488","#8B5CF6","#B45309","#0891B2","#BE185D","#16A34A","#1D6BF3"];
function studentAccent(n: string) {
  return ACCENT_POOL[(n.charCodeAt(0) + n.charCodeAt(n.length - 1)) % ACCENT_POOL.length];
}
function attColor(p: number)   { return p >= 75 ? "#22C55E" : p >= 50 ? "#F59E0B" : "#EF4444"; }
function scoreColor(p: number) { return p >= 70 ? "#22C55E" : p >= 50 ? "#F59E0B" : "#EF4444"; }
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
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: sp } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };

// ── Animated count-up ─────────────────────────────────────────────────────────

const AnimatedNumber = memo(function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const mv  = useMotionValue(0);
  const sv  = useSpring(mv, { stiffness: 55, damping: 20 });
  const out = useTransform(sv, v => String(Math.round(v)));
  useEffect(() => {
    const t = setTimeout(() => mv.set(target), 500);
    return () => clearTimeout(t);
  }, [target, mv]);
  return <><motion.span style={{ fontVariantNumeric: "tabular-nums" }}>{out}</motion.span>{suffix}</>;
});

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTip({ active, payload, label, suffix = "" }: Record<string, unknown> & { suffix?: string }) {
  if (!(active as boolean) || !(payload as unknown[])?.length) return null;
  const v = ((payload as { value: number }[])[0])?.value;
  return (
    <div style={{ background: "#0F172A", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 16px", fontSize: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.45)" }}>
      <div style={{ color: "rgba(255,255,255,0.45)", marginBottom: 4, fontWeight: 500 }}>{label as string}</div>
      <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{typeof v === "number" ? v.toFixed(1) : v}{suffix}</div>
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
      for (let d = 0; d < 7; d++) { col.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
      cols.push(col);
    }
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    cols.forEach((col, ci) => {
      const m = col[0].getMonth();
      if (m !== lastMonth) { labels.push({ col: ci, label: col[0].toLocaleDateString("en-IN", { month: "short" }) }); lastMonth = m; }
    });
    return { weeks: cols, monthLabels: labels };
  }, []);

  const scanLog = useMemo(() => {
    const seen = new Map<string, AttendanceRecord[]>();
    for (const rec of attendanceLog) {
      if (!seen.has(rec.date)) seen.set(rec.date, []);
      seen.get(rec.date)!.push(rec);
    }
    return Array.from(seen.entries()).slice(0, 16);
  }, [attendanceLog]);

  const now = new Date(); now.setHours(23, 59, 59, 999);
  const DAY_LABELS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

  return (
    <motion.div variants={fadeUp} style={{ background: "var(--admin-card-bg)", borderRadius: 20, border: "1px solid var(--admin-card-border)", padding: "24px 28px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.2px" }}>Attendance Calendar</p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--admin-text-faint)" }}>{presentDays} of {totalWorkingDays} working days · last 60 days</p>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--admin-text-faint)", alignItems: "center" }}>
          {[["#22C55E","Present"],["#EF4444","Absent"]].map(([c,l]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c, display: "inline-block", opacity: l === "Absent" ? 0.6 : 1 }} />{l}
            </span>
          ))}
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, border: "1px solid var(--admin-card-border)", display: "inline-block" }} />No class
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 28 }}>
        <div>
          <div style={{ display: "flex", gap: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 20, marginRight: 2 }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{ height: 22, width: 18, display: "flex", alignItems: "center", justifyContent: "flex-end", fontSize: 9, fontWeight: 700, color: "var(--admin-text-faint)", paddingRight: 4 }}>{d}</div>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(9,26px)", gap: 4, height: 16, marginBottom: 4 }}>
                {weeks.map((_, wi) => {
                  const ml = monthLabels.find(m => m.col === wi);
                  return <div key={wi} style={{ fontSize: 9, fontWeight: 700, color: "var(--admin-text-faint)", letterSpacing: 0.4 }}>{ml?.label ?? ""}</div>;
                })}
              </div>
              <div style={{ display: "grid", gridTemplateRows: "repeat(7,22px)", gridTemplateColumns: "repeat(9,26px)", gap: 4, gridAutoFlow: "column" }}>
                {weeks.flatMap((col, wi) => col.map((date, di) => {
                  const ds = date.toISOString().slice(0, 10);
                  const isFut = date > now;
                  const isWork = workingSet.has(ds);
                  const recs = attMap.get(ds) ?? [];
                  const isOk = recs.length > 0;
                  let bg = "var(--admin-card-border)"; let op = 0.3;
                  if (!isFut && isWork) { bg = isOk ? "#22C55E" : "#EF4444"; op = isOk ? 0.9 : 0.55; }
                  return (
                    <div key={`${wi}-${di}`} title={fmtDayShort(ds)}
                      onMouseEnter={() => setHovered(ds)} onMouseLeave={() => setHovered(null)}
                      style={{ width: 22, height: 22, borderRadius: 5, background: bg, opacity: op, cursor: isWork && !isFut ? "pointer" : "default", transition: "transform 0.1s ease", transform: hovered === ds ? "scale(1.35)" : "scale(1)" }}
                    />
                  );
                }))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, height: 36, display: "flex", alignItems: "center" }}>
            {hovered && (() => {
              const recs = attMap.get(hovered) ?? [];
              const isWork = workingSet.has(hovered);
              const isFut = new Date(hovered + "T00:00:00") > now;
              return (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
                  style={{ padding: "8px 14px", background: "var(--admin-input-bg)", borderRadius: 10, border: "1px solid var(--admin-card-border)", fontSize: 12, display: "inline-flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: "var(--admin-text)" }}>{fmtDayShort(hovered)}</span>
                  <span style={{ color: recs.length > 0 ? "#22C55E" : isWork && !isFut ? "#EF4444" : "var(--admin-text-faint)" }}>
                    {recs.length > 0 ? `Present · ${recs.map(r => fmtTime(r.markedAt)).join(" · ")}` : isWork && !isFut ? "Absent" : isFut ? "—" : "No class"}
                  </span>
                </motion.div>
              );
            })()}
          </div>
        </div>

        <div>
          <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 800, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 1.2 }}>Recent Scans</p>
          {scanLog.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--admin-text-faint)", margin: 0 }}>No records</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", maxHeight: 230, overflowY: "auto" }}>
              {scanLog.map(([date, recs], i) => (
                <div key={date} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < scanLog.length - 1 ? "1px solid var(--admin-card-border)" : "none", alignItems: "flex-start" }}>
                  <div style={{ width: 7, height: 7, borderRadius: 100, background: "#22C55E", flexShrink: 0, marginTop: 4 }} />
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

const TestCard = memo(function TestCard({ result, subjectBest }: { result: TestResult; subjectBest: Record<string, number> }) {
  const accent  = testAccent(result.testName);
  const pct     = realPct(result);
  const entries = Object.entries(result.scores);
  const maxes   = result.subjectMaxes;
  const total   = entries.reduce((s, [, v]) => s + v, 0);
  const maxTotal = maxes ? Object.values(maxes).reduce((s, v) => s + v, 0) : result.total;

  return (
    <motion.div variants={fadeUp} whileHover={{ y: -4, boxShadow: "0 24px 64px rgba(0,0,0,0.16)" }} transition={{ duration: 0.2 }}
      style={{ background: "var(--admin-card-bg)", borderRadius: 18, border: "1px solid var(--admin-card-border)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ height: 4, background: `linear-gradient(90deg,${accent},${accent}50)`, flexShrink: 0 }} />
      <div style={{ padding: "18px 20px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{result.testName}</div>
            <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 4 }}>{fmtDate(result.testDate)}</div>
          </div>
          {result.rank != null && (
            <div style={{ background: `${accent}15`, border: `1px solid ${accent}35`, borderRadius: 12, padding: "6px 12px", textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: accent, lineHeight: 1 }}>#{result.rank}</div>
              {result.totalInBatch && <div style={{ fontSize: 9, color: "var(--admin-text-faint)", marginTop: 2 }}>of {result.totalInBatch}</div>}
            </div>
          )}
        </div>
        <div style={{ background: "var(--admin-input-bg)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--admin-card-border)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 38, fontWeight: 900, color: scoreColor(pct), letterSpacing: "-2px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {pct.toFixed(1)}<span style={{ fontSize: 20, fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 5 }}>{total} / {maxTotal} marks</div>
            </div>
            {result.percentile != null && (
              <div style={{ textAlign: "right", paddingBottom: 2 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)", lineHeight: 1 }}>{result.percentile}<span style={{ fontSize: 11, color: "var(--admin-text-faint)", fontWeight: 400 }}>th</span></div>
                <div style={{ fontSize: 10, color: "var(--admin-text-faint)", marginTop: 2 }}>percentile</div>
              </div>
            )}
          </div>
          <div style={{ height: 6, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, pct / 100) }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              style={{ height: "100%", width: "100%", borderRadius: 100, background: scoreColor(pct), transformOrigin: "left center" }}
            />
          </div>
        </div>
        {entries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 2 }}>Subjects</div>
            {entries.map(([subj, score], i) => {
              const max = maxes?.[subj] ?? null;
              const fill = max != null ? Math.min(100, (score / max) * 100) : Math.min(100, (score / (subjectBest[subj] || score)) * 100);
              return (
                <div key={subj}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--admin-text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subj}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", fontVariantNumeric: "tabular-nums", marginLeft: 8, flexShrink: 0 }}>
                      {score}{max != null && <span style={{ fontWeight: 400, color: "var(--admin-text-faint)", fontSize: 11 }}>/{max}</span>}
                    </span>
                  </div>
                  <div style={{ height: 5, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
                    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: fill / 100 }}
                      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.45 + i * 0.07 }}
                      style={{ height: "100%", width: "100%", borderRadius: 100, background: SUBJ_COLORS[i % SUBJ_COLORS.length], opacity: 0.9, transformOrigin: "left center" }}
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
    <div style={{ padding: "28px 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div className="admin-skeleton" style={{ height: 14, width: 60, borderRadius: 6, marginBottom: 28 }} />
      <div className="admin-skeleton" style={{ height: 210, borderRadius: 24, marginBottom: 20 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {[1,2].map(i => <div key={i} className="admin-skeleton" style={{ height: 260, borderRadius: 18 }} />)}
      </div>
      <div className="admin-skeleton" style={{ height: 240, borderRadius: 20, marginBottom: 20 }} />
      <div className="admin-skeleton" style={{ height: 22, width: 160, borderRadius: 6, marginBottom: 18 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {[1,2,3].map(i => <div key={i} className="admin-skeleton" style={{ height: 380, borderRadius: 18 }} />)}
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
    const tot: Record<string, { sum: number; cnt: number }> = {};
    for (const r of profile.results) for (const [s, v] of Object.entries(r.scores)) {
      if (!tot[s]) tot[s] = { sum: 0, cnt: 0 };
      tot[s].sum += v; tot[s].cnt++;
    }
    return Object.entries(tot).map(([subject, d]) => ({ subject, avg: Math.round(d.sum / d.cnt) })).sort((a, b) => b.avg - a.avg);
  }, [profile]);

  const subjectBest = useMemo(() => {
    if (!profile) return {};
    const b: Record<string, number> = {};
    for (const r of profile.results) for (const [s, v] of Object.entries(r.scores)) b[s] = Math.max(b[s] ?? 0, v);
    return b;
  }, [profile]);

  const trendData = useMemo(() => {
    if (!profile) return [];
    return [...profile.results].reverse().map(r => ({ name: r.testName, pct: realPct(r) }));
  }, [profile]);

  const [trendMin, trendMax] = useMemo(() => {
    if (!trendData.length) return [0, 100];
    const pcts = trendData.map(d => d.pct);
    const lo = Math.min(...pcts); const hi = Math.max(...pcts);
    const pad = Math.max(8, (hi - lo) * 0.4);
    return [Math.max(0, Math.floor(lo - pad)), Math.min(100, Math.ceil(hi + pad))];
  }, [trendData]);

  if (loading) return <LoadingSkeleton />;

  if (!profile) return (
    <div style={{ padding: "28px 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--admin-text-muted)", fontSize: 13, fontWeight: 500, padding: "4px 0", marginBottom: 40 }}>← Back</button>
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <p style={{ fontSize: 36, margin: "0 0 10px" }}>👤</p>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "var(--admin-text)" }}>Student not found</p>
        <p style={{ margin: 0, color: "var(--admin-text-faint)", fontSize: 13 }}>This profile doesn&apos;t exist or was deleted.</p>
      </div>
    </div>
  );

  const accent   = studentAccent(profile.name);
  const avgScore = profile.results.length ? Math.round(profile.results.reduce((s, r) => s + realPct(r), 0) / profile.results.length) : null;
  const bestRank = profile.results.reduce<number | null>((b, r) => r.rank != null && (b === null || r.rank < b) ? r.rank : b, null);

  const stats = [
    { label: "Attendance", value: <AnimatedNumber target={profile.attendancePct} suffix="%" />, sub: `${profile.presentDays} / ${profile.totalWorkingDays} days`, color: attColor(profile.attendancePct) },
    { label: "Avg Score",  value: avgScore != null ? <AnimatedNumber target={avgScore} suffix="%" /> : <span>—</span>, sub: `${profile.results.length} test${profile.results.length !== 1 ? "s" : ""}`, color: avgScore != null ? scoreColor(avgScore) : "rgba(255,255,255,0.35)" },
    { label: "Best Rank",  value: <span style={{ fontVariantNumeric: "tabular-nums" }}>{bestRank != null ? `#${bestRank}` : "—"}</span>, sub: "across all tests", color: "#60A5FA" },
    { label: "Last Seen",  value: <span>{fmtAgo(profile.lastSeen)}</span>, sub: profile.lastSeen ? new Date(profile.lastSeen).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "no records", color: "rgba(255,255,255,0.9)" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      style={{ padding: "28px 32px 80px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Back */}
      <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...sp, delay: 0.04 }}
        whileHover={{ x: -2 }} whileTap={{ scale: 0.97 }} onClick={() => router.back()}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--admin-text-muted)", fontSize: 13, fontWeight: 500, padding: "4px 0", marginBottom: 22 }}>
        ← Back
      </motion.button>

      <motion.div variants={stagger} initial="hidden" animate="show">

        {/* ── HERO — dark gradient card with integrated stats ─────────────── */}
        <motion.div variants={fadeUp} style={{
          borderRadius: 24, marginBottom: 20, overflow: "hidden",
          background: `linear-gradient(140deg, #0E1A22 0%, #111d2a 55%, ${accent}1a 100%)`,
          border: `1px solid ${accent}28`,
          boxShadow: `0 8px 48px rgba(0,0,0,0.35), 0 0 0 1px ${accent}12`,
          position: "relative",
        }}>
          {/* Decorative glow orbs */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle, ${accent}15 0%, transparent 65%)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -20, left: 120, width: 200, height: 130, background: `radial-gradient(ellipse, ${accent}08 0%, transparent 70%)`, pointerEvents: "none" }} />

          {/* Avatar + name row */}
          <div style={{ padding: "28px 32px 24px", display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", position: "relative" }}>
            <div style={{
              width: 78, height: 78, borderRadius: 22, flexShrink: 0,
              background: `${accent}22`, color: accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, fontWeight: 900, letterSpacing: "0.5px",
              border: `2px solid ${accent}45`,
              boxShadow: `0 0 0 4px ${accent}14`,
            }}>
              {initials(profile.name)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#FFFFFF", letterSpacing: "-1px", lineHeight: 1.1 }}>
                {profile.name}
              </h1>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{profile.enrollmentNo}</span>
                <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
                <span style={{ background: `${accent}25`, color: accent, borderRadius: 100, padding: "3px 12px", fontSize: 12, fontWeight: 700, border: `1px solid ${accent}38` }}>{profile.batch}</span>
                <span style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)", borderRadius: 100, padding: "3px 12px", fontSize: 12, fontWeight: 500, border: "1px solid rgba(255,255,255,0.1)" }}>{profile.center}</span>
              </div>
              {profile.parent && (
                <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
                  Parent: <strong style={{ color: "rgba(255,255,255,0.52)", fontWeight: 600 }}>{profile.parent.name}</strong>
                  {" · "}{profile.parent.phone}
                  {profile.parent.email && <>{" · "}{profile.parent.email}</>}
                </div>
              )}
            </div>
          </div>

          {/* Stats bar — bottom of hero */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", display: "grid", gridTemplateColumns: "repeat(4,1fr)", position: "relative" }}>
            {stats.map((s, i) => (
              <div key={s.label} style={{ padding: "18px 26px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1.3, marginBottom: 7 }}>{s.label}</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: s.color, letterSpacing: "-1.2px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 5 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Charts ───────────────────────────────────────────────────────── */}
        {profile.results.length > 0 && (
          <motion.div variants={stagger} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

            <motion.div variants={fadeUp} style={{ background: "var(--admin-card-bg)", borderRadius: 18, border: "1px solid var(--admin-card-border)", padding: "22px 24px", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: `linear-gradient(180deg,${accent},${accent}20)`, borderRadius: "18px 0 0 18px" }} />
              <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Subject Averages</p>
              <p style={{ margin: "0 0 18px", fontSize: 12, color: "var(--admin-text-faint)" }}>Mean marks across all tests</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={subjectAvgs} barSize={34} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 11, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip suffix=" avg" />} cursor={{ fill: "rgba(128,128,128,0.06)", radius: 6 }} />
                  <Bar dataKey="avg" radius={[8,8,0,0]}>
                    {subjectAvgs.map((_, i) => <Cell key={i} fill={SUBJ_COLORS[i % SUBJ_COLORS.length]} fillOpacity={0.9} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div variants={fadeUp} style={{ background: "var(--admin-card-bg)", borderRadius: 18, border: "1px solid var(--admin-card-border)", padding: "22px 24px", overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: "linear-gradient(180deg,#6366F1,#6366F120)", borderRadius: "18px 0 0 18px" }} />
              <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Score Trend</p>
              <p style={{ margin: "0 0 18px", fontSize: 12, color: "var(--admin-text-faint)" }}>Performance over time · oldest → newest</p>
              {trendData.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                    <defs>
                      <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#6366F1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6366F1" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[trendMin, trendMax]} tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip suffix="%" />} />
                    <Area type="monotone" dataKey="pct" stroke="#6366F1" strokeWidth={2.5} fill="url(#tg)"
                      dot={{ fill: "#6366F1", r: 5, strokeWidth: 0 }}
                      activeDot={{ r: 7, fill: "#6366F1", stroke: "var(--admin-card-bg)", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 52, fontWeight: 900, color: scoreColor(trendData[0]?.pct ?? 0), letterSpacing: "-2px", lineHeight: 1 }}>
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

        {/* ── Test Analysis ─────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} style={{ marginBottom: 18, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)", letterSpacing: "-0.5px" }}>Test Analysis</p>
          {profile.results.length > 0 && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-faint)" }}>
              {profile.results.length} test{profile.results.length !== 1 ? "s" : ""} · subject-wise breakdown
            </p>
          )}
        </motion.div>

        {profile.results.length > 0 ? (
          <motion.div variants={stagger} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
            {profile.results.map(r => (
              <TestCard key={`${r.testName}-${r.testDate}`} result={r} subjectBest={subjectBest} />
            ))}
          </motion.div>
        ) : (
          <motion.div variants={fadeUp} style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px dashed var(--admin-card-border)", padding: "72px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 36, margin: "0 0 12px" }}>🏆</p>
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "var(--admin-text)" }}>No results yet</p>
            <p style={{ margin: 0, color: "var(--admin-text-faint)", fontSize: 13 }}>Upload test results from the Results page to see analytics here.</p>
          </motion.div>
        )}

      </motion.div>
    </motion.div>
  );
}
