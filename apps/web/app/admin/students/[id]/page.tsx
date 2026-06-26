"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

type TestResult = {
  testName: string; testDate: string;
  rank: number | null; total: number;
  percentage: number; percentile: number | null;
  scores: Record<string, number>;
  subjectMaxes: Record<string, number> | null;
  totalInBatch: number | null;
};

type StudentProfile = {
  id: string; name: string; enrollmentNo: string;
  batch: string; center: string;
  parent: { name: string; phone: string; email: string | null } | null;
  attendancePct: number; presentDays: number; totalWorkingDays: number;
  lastSeen: string | null;
  results: TestResult[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const SUBJECT_PALETTE = ["#6366F1","#0D9488","#EC4899","#B45309","#0891B2","#8B5CF6","#16A34A","#DC2626"];

function initials(n: string) {
  return n.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
function studentAccent(n: string) {
  const p = ["#6366F1","#0D9488","#8B5CF6","#B45309","#0891B2","#BE185D","#16A34A","#1D6BF3"];
  return p[(n.charCodeAt(0) + n.charCodeAt(n.length - 1)) % p.length];
}
function attColor(p: number)   { return p >= 75 ? "#16A34A" : p >= 50 ? "#D97706" : "#DC2626"; }
function attBg(p: number)      { return p >= 75 ? "rgba(22,163,74,0.09)" : p >= 50 ? "rgba(217,119,6,0.09)" : "rgba(220,38,38,0.09)"; }
function scoreColor(p: number) { return p >= 70 ? "#16A34A" : p >= 50 ? "#D97706" : "#DC2626"; }
function fmtDate(d: string)    { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }); }
function fmtDateFull(d: string){ return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" }); }
function fmtAgo(ts: string | null) {
  if (!ts) return "Never";
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7)  return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
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

// ── Recharts tooltips ──────────────────────────────────────────────────────────

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

// ── Test Analysis Card ────────────────────────────────────────────────────────

function TestCard({
  result, subjectBest,
}: { result: TestResult; subjectBest: Record<string, number> }) {
  const accent  = testAccent(result.testName);
  const entries = Object.entries(result.scores as Record<string, number>);
  const maxes   = result.subjectMaxes as Record<string, number> | null;

  return (
    <div style={{
      background: "var(--admin-card-bg)", borderRadius: 18,
      border: "1px solid var(--admin-card-border)",
      overflow: "hidden", display: "flex", flexDirection: "column",
      transition: "box-shadow 0.2s, transform 0.2s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.1)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}
    >
      {/* Top accent strip */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}60)`, flexShrink: 0 }} />

      <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Test name + rank */}
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
            <div style={{
              background: `${accent}12`, border: `1px solid ${accent}35`,
              borderRadius: 12, padding: "6px 12px", textAlign: "center", flexShrink: 0,
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                #{result.rank}
              </div>
              {result.totalInBatch && (
                <div style={{ fontSize: 9, color: "var(--admin-text-faint)", marginTop: 2 }}>
                  of {result.totalInBatch}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Score block */}
        <div style={{ background: "var(--admin-input-bg)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--admin-card-border)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, color: scoreColor(result.percentage), letterSpacing: "-1.5px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {result.percentage.toFixed(1)}<span style={{ fontSize: 20 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 5 }}>
                {result.total} total marks
              </div>
            </div>
            {result.percentile != null && (
              <div style={{ textAlign: "right", paddingBottom: 4 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--admin-text)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {result.percentile}
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--admin-text-faint)" }}>th</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--admin-text-faint)", marginTop: 2 }}>percentile</div>
              </div>
            )}
          </div>
          {/* Score fill bar */}
          <div style={{ height: 6, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${Math.min(100, result.percentage)}%`, borderRadius: 100,
              background: `linear-gradient(90deg, ${scoreColor(result.percentage)}, ${scoreColor(result.percentage)}80)`,
              transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)",
            }} />
          </div>
        </div>

        {/* Subject breakdown */}
        {entries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
              Subject Scores
            </div>
            {entries.map(([subj, score], i) => {
              const max = maxes?.[subj] ?? null;
              const pct = max != null
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
                      {score}{max != null ? <span style={{ fontWeight: 400, color: "var(--admin-text-faint)", fontSize: 11 }}>/{max}</span> : ""}
                    </span>
                  </div>
                  <div style={{ height: 5, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${pct}%`, borderRadius: 100,
                      background: barColor, opacity: 0.85,
                      transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)",
                    }} />
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
    <div style={{ padding: "28px 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div className="admin-skeleton" style={{ height: 14, width: 60, borderRadius: 6, marginBottom: 28 }} />
      <div className="admin-skeleton" style={{ height: 130, borderRadius: 20, marginBottom: 20 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="admin-skeleton" style={{ height: 96, borderRadius: 16 }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="admin-skeleton" style={{ height: 280, borderRadius: 16 }} />
        ))}
      </div>
      <div className="admin-skeleton" style={{ height: 18, width: 140, borderRadius: 6, marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="admin-skeleton" style={{ height: 360, borderRadius: 18 }} />
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

  // Subject averages across all tests
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

  // Best score per subject (used for bar scaling when no subjectMaxes)
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

  // Score trend (chronological order)
  const trendData = useMemo(() => {
    if (!profile) return [];
    return [...profile.results].reverse().map(r => ({
      name: r.testName,
      pct: Math.round(r.percentage * 10) / 10,
    }));
  }, [profile]);

  if (loading) return <LoadingSkeleton />;

  if (!profile) return (
    <div style={{ padding: "28px 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
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

  const accent   = studentAccent(profile.name);
  const avgScore = profile.results.length
    ? Math.round(profile.results.reduce((s, r) => s + r.percentage, 0) / profile.results.length)
    : null;
  const bestRank = profile.results.reduce<number | null>(
    (b, r) => r.rank != null && (b === null || r.rank < b) ? r.rank : b, null
  );

  return (
    <div style={{ padding: "28px 32px 80px", maxWidth: 1100, margin: "0 auto", fontFamily: "var(--font-geist-sans,'Geist',system-ui,sans-serif)" }}>

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
        <div style={{ background: attBg(profile.attendancePct), borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "18px 20px" }}>
          <p style={{ margin: "0 0 7px", fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>Attendance</p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: attColor(profile.attendancePct), letterSpacing: "-0.6px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {profile.attendancePct}%
          </p>
          <p style={{ margin: "5px 0 10px", fontSize: 12, color: "var(--admin-text-faint)" }}>
            {profile.presentDays} of {profile.totalWorkingDays} days
          </p>
          <div style={{ height: 4, background: "rgba(0,0,0,0.09)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, profile.attendancePct)}%`, background: attColor(profile.attendancePct), borderRadius: 100 }} />
          </div>
        </div>

        {/* Avg Score */}
        <div style={{ background: avgScore != null ? `${scoreColor(avgScore)}0D` : "var(--admin-input-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "18px 20px" }}>
          <p style={{ margin: "0 0 7px", fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>Avg Score</p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: avgScore != null ? scoreColor(avgScore) : ("var(--admin-text-faint)" as string), letterSpacing: "-0.6px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {avgScore != null ? `${avgScore}%` : "—"}
          </p>
          <p style={{ margin: "5px 0 10px", fontSize: 12, color: "var(--admin-text-faint)" }}>
            {profile.results.length} test{profile.results.length !== 1 ? "s" : ""} taken
          </p>
          {avgScore != null && (
            <div style={{ height: 4, background: "rgba(0,0,0,0.09)", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, avgScore)}%`, background: scoreColor(avgScore), borderRadius: 100 }} />
            </div>
          )}
        </div>

        {/* Best Rank */}
        <div style={{ background: "rgba(29,107,243,0.07)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "18px 20px" }}>
          <p style={{ margin: "0 0 7px", fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>Best Rank</p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#1D6BF3", letterSpacing: "-0.6px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {bestRank != null ? `#${bestRank}` : "—"}
          </p>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--admin-text-faint)" }}>Across all tests</p>
        </div>

        {/* Last Seen */}
        <div style={{ background: "var(--admin-input-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "18px 20px" }}>
          <p style={{ margin: "0 0 7px", fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>Last Seen</p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--admin-text)" as string, letterSpacing: "-0.6px", lineHeight: 1 }}>
            {fmtAgo(profile.lastSeen)}
          </p>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--admin-text-faint)" }}>
            {profile.lastSeen
              ? new Date(profile.lastSeen).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
              : "No attendance"}
          </p>
        </div>
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      {profile.results.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>

          {/* Subject Averages */}
          <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "22px 24px" }}>
            <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Subject Averages</p>
            <p style={{ margin: "0 0 20px", fontSize: 12, color: "var(--admin-text-faint)" }}>Average marks across all tests</p>
            <ResponsiveContainer width="100%" height={210}>
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
            <p style={{ margin: "0 0 20px", fontSize: 12, color: "var(--admin-text-faint)" }}>Performance over time · all tests</p>
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor={accent} stopOpacity={0.22} />
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
              <div style={{ height: 210, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
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

      {/* ── Test Analysis ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 6, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.3px" }}>
          Test Analysis
        </p>
        {profile.results.length > 0 && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-faint)" }}>
            {profile.results.length} test{profile.results.length !== 1 ? "s" : ""} · most recent first
          </p>
        )}
      </div>
      <p style={{ margin: "4px 0 20px", fontSize: 12, color: "var(--admin-text-faint)" }}>
        {profile.results.length > 0
          ? "Subject-wise breakdown with marks and progress bars"
          : "No test results recorded yet"}
      </p>

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
        <div style={{
          background: "var(--admin-card-bg)", borderRadius: 16,
          border: "1px dashed var(--admin-card-border)",
          padding: "72px 24px", textAlign: "center",
        }}>
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
