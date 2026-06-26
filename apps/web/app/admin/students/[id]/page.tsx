"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

type TestResult = {
  testName: string; testDate: string;
  rank: number | null; total: number;
  percentage: number; percentile: number | null;
  scores: Record<string, number>; totalInBatch: number | null;
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

const PALETTE = ["#1D6BF3","#7C3AED","#0D9488","#B45309","#0891B2","#BE185D","#16A34A","#DC2626"];

function initials(n: string) {
  return n.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
function studentAccent(n: string) {
  return PALETTE[(n.charCodeAt(0) + n.charCodeAt(n.length - 1)) % PALETTE.length];
}
function attColor(p: number)  { return p >= 75 ? "#16A34A" : p >= 50 ? "#D97706" : "#DC2626"; }
function attBg(p: number)     { return p >= 75 ? "rgba(22,163,74,0.1)" : p >= 50 ? "rgba(217,119,6,0.1)" : "rgba(220,38,38,0.1)"; }
function scoreColor(p: number){ return p >= 70 ? "#16A34A" : p >= 50 ? "#D97706" : "#DC2626"; }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}
function fmtAgo(ts: string | null) {
  if (!ts) return "Never";
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return "Today"; if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!(active as boolean) || !(payload as unknown[])?.length) return null;
  const val = ((payload as { value: number }[])[0])?.value;
  return (
    <div style={{
      background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)",
      borderRadius: 10, padding: "8px 14px", fontSize: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    }}>
      <div style={{ color: "var(--admin-text-muted)", marginBottom: 2 }}>{label as string}</div>
      <div style={{ color: "var(--admin-text)", fontWeight: 600 }}>{val}</div>
    </div>
  );
}

function LineTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!(active as boolean) || !(payload as unknown[])?.length) return null;
  const val = ((payload as { value: number }[])[0])?.value;
  return (
    <div style={{
      background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)",
      borderRadius: 10, padding: "8px 14px", fontSize: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    }}>
      <div style={{ color: "var(--admin-text-muted)", marginBottom: 2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label as string}</div>
      <div style={{ color: "var(--admin-text)", fontWeight: 600 }}>{Number(val).toFixed(1)}%</div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ w, h, radius = 8 }: { w?: string | number; h: number; radius?: number }) {
  return (
    <div className="admin-skeleton" style={{ width: w ?? "100%", height: h, borderRadius: radius }} />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StudentProfilePage() {
  const params    = useParams();
  const router    = useRouter();
  const studentId = params["id"] as string;

  const [profile,  setProfile]  = useState<StudentProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [openTest, setOpenTest] = useState<string | null>(null);

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
    return Object.entries(tot).map(([subject, d]) => ({ subject, avg: Math.round(d.sum / d.count) }));
  }, [profile]);

  const trendData = useMemo(() => {
    if (!profile) return [];
    return [...profile.results].reverse().map(r => ({
      name: r.testName,
      pct: Math.round(r.percentage * 10) / 10,
    }));
  }, [profile]);

  const avgScore = profile?.results.length
    ? Math.round(profile.results.reduce((s, r) => s + r.percentage, 0) / profile.results.length)
    : null;

  const bestRank = profile?.results.reduce<number | null>(
    (b, r) => r.rank != null && (b === null || r.rank < b) ? r.rank : b, null
  ) ?? null;

  const accent = profile ? studentAccent(profile.name) : "#1D6BF3";

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding: "28px 32px 64px", maxWidth: 1100, margin: "0 auto" }}>
      <Skeleton w={80} h={18} radius={6} />
      <div style={{ marginTop: 28, background: "var(--admin-card-bg)", borderRadius: 20, border: "1px solid var(--admin-card-border)", padding: "24px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Skeleton w={64} h={64} radius={18} />
          <div style={{ flex: 1 }}>
            <Skeleton w="45%" h={22} radius={6} />
            <div style={{ marginTop: 8 }}><Skeleton w="30%" h={14} radius={6} /></div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "18px 20px", height: 90 }}><Skeleton w="60%" h={10} radius={4} /><div style={{ marginTop: 10 }}><Skeleton w="40%" h={26} radius={6} /></div></div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {Array.from({ length: 2 }).map((_, i) => <div key={i} style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: 24, height: 280 }}><Skeleton w="40%" h={14} radius={4} /><div style={{ marginTop: 16 }}><Skeleton h={220} radius={8} /></div></div>)}
      </div>
    </div>
  );

  if (!profile) return (
    <div style={{ padding: "28px 32px 64px", maxWidth: 1100, margin: "0 auto" }}>
      <button onClick={() => router.back()} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--admin-text-muted)", fontSize: 13, fontWeight: 500, padding: "4px 0", marginBottom: 40 }}>
        ← Back
      </button>
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <p style={{ fontSize: 40, margin: "0 0 12px" }}>👤</p>
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--admin-text)", margin: "0 0 6px" }}>Student not found</p>
        <p style={{ fontSize: 13, color: "var(--admin-text-faint)", margin: 0 }}>This student profile doesn&apos;t exist or was deleted.</p>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "28px 32px 80px", maxWidth: 1100, margin: "0 auto", fontFamily: "var(--font-geist-sans,'Geist',system-ui,sans-serif)" }}>

      {/* Back button */}
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

      {/* Student header card */}
      <div style={{
        background: "var(--admin-card-bg)", borderRadius: 20,
        border: "1px solid var(--admin-card-border)", padding: "24px 28px",
        marginBottom: 20, overflow: "hidden", position: "relative",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}55, transparent)` }} />
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: `${accent}15`, color: accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, flexShrink: 0, letterSpacing: "0.5px",
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
              <span style={{
                background: `${accent}15`, color: accent,
                borderRadius: 100, padding: "3px 12px",
                fontSize: 12, fontWeight: 600,
              }}>{profile.batch}</span>
              <span style={{
                background: "var(--admin-input-bg)", color: "var(--admin-text-muted)",
                borderRadius: 100, padding: "3px 12px",
                fontSize: 12, fontWeight: 500,
                border: "1px solid var(--admin-card-border)",
              }}>{profile.center}</span>
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

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {[
          {
            label: "Attendance",
            value: `${profile.attendancePct}%`,
            sub: `${profile.presentDays} of ${profile.totalWorkingDays} days`,
            color: attColor(profile.attendancePct),
            bg: attBg(profile.attendancePct),
          },
          {
            label: "Avg Score",
            value: avgScore != null ? `${avgScore}%` : "—",
            sub: `${profile.results.length} test${profile.results.length !== 1 ? "s" : ""} taken`,
            color: avgScore != null ? scoreColor(avgScore) : "var(--admin-text-faint)" as string,
            bg: avgScore != null ? `${scoreColor(avgScore)}10` : "var(--admin-input-bg)",
          },
          {
            label: "Best Rank",
            value: bestRank != null ? `#${bestRank}` : "—",
            sub: "Across all tests",
            color: "#1D6BF3",
            bg: "rgba(29,107,243,0.08)",
          },
          {
            label: "Last Seen",
            value: fmtAgo(profile.lastSeen),
            sub: profile.lastSeen
              ? new Date(profile.lastSeen).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
              : "No attendance",
            color: "var(--admin-text)" as string,
            bg: "var(--admin-input-bg)",
          },
        ].map((stat, i) => (
          <div key={i} style={{
            background: stat.bg, borderRadius: 16,
            border: "1px solid var(--admin-card-border)", padding: "18px 20px",
          }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>
              {stat.label}
            </p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: stat.color, letterSpacing: "-0.5px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {stat.value}
            </p>
            <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--admin-text-faint)" }}>
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Subject Averages */}
        <div style={{
          background: "var(--admin-card-bg)", borderRadius: 16,
          border: "1px solid var(--admin-card-border)", padding: 24,
        }}>
          <p style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Subject Averages</p>
          {subjectAvgs.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={subjectAvgs} barSize={36} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" vertical={false} />
                <XAxis dataKey="subject" tick={{ fontSize: 11, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(128,128,128,0.06)" }} />
                <Bar dataKey="avg" name="Avg Marks" radius={[7, 7, 0, 0]}>
                  {subjectAvgs.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <p style={{ fontSize: 28, margin: 0 }}>📊</p>
              <p style={{ margin: 0, color: "var(--admin-text-faint)", fontSize: 13 }}>No test data yet</p>
            </div>
          )}
        </div>

        {/* Score Trend */}
        <div style={{
          background: "var(--admin-card-bg)", borderRadius: 16,
          border: "1px solid var(--admin-card-border)", padding: 24,
        }}>
          <p style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Score Trend</p>
          {trendData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                <Tooltip content={<LineTooltip />} />
                <Line
                  type="monotone" dataKey="pct" stroke={accent} strokeWidth={2.5}
                  dot={{ fill: accent, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: accent, stroke: "var(--admin-card-bg)", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : trendData.length === 1 ? (
            <div style={{ height: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <p style={{ margin: 0, fontSize: 48, fontWeight: 700, color: scoreColor(trendData[0].pct), letterSpacing: "-1px", fontVariantNumeric: "tabular-nums" }}>
                {trendData[0].pct.toFixed(1)}%
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--admin-text-muted)" }}>{trendData[0].name}</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--admin-text-faint)" }}>Only 1 test — trend needs 2+</p>
            </div>
          ) : (
            <div style={{ height: 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <p style={{ fontSize: 28, margin: 0 }}>📈</p>
              <p style={{ margin: 0, color: "var(--admin-text-faint)", fontSize: 13 }}>No test data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Test History */}
      <div style={{
        background: "var(--admin-card-bg)", borderRadius: 16,
        border: "1px solid var(--admin-card-border)", padding: 24,
      }}>
        <p style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
          Test History
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: "var(--admin-text-faint)", background: "var(--admin-input-bg)", borderRadius: 100, padding: "2px 10px", border: "1px solid var(--admin-card-border)" }}>
            {profile.results.length}
          </span>
        </p>

        {profile.results.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 36, margin: "0 0 10px" }}>🏆</p>
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "var(--admin-text)" }}>No results yet</p>
            <p style={{ margin: 0, color: "var(--admin-text-faint)", fontSize: 13 }}>Test results will appear here once uploaded.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {profile.results.map((r) => {
              const key  = `${r.testName}-${r.testDate}`;
              const open = openTest === key;
              const entries = Object.entries(r.scores as Record<string, number>);
              const perSubjMax = r.total / (entries.length || 1);

              return (
                <div key={key} style={{
                  background: "var(--admin-input-bg)", borderRadius: 14,
                  border: "1px solid var(--admin-card-border)", overflow: "hidden",
                  transition: "box-shadow 0.15s",
                }}>
                  {/* Row header */}
                  <div
                    onClick={() => setOpenTest(open ? null : key)}
                    style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
                  >
                    {/* Colored dot */}
                    <div style={{ width: 8, height: 8, borderRadius: 100, background: scoreColor(r.percentage), flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.testName}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--admin-text-faint)", marginTop: 2 }}>
                        {fmtDate(r.testDate)}
                      </div>
                    </div>

                    {/* Rank badge */}
                    {r.rank != null && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 100,
                        background: r.rank === 1 ? "rgba(217,119,6,0.12)" : "var(--admin-card-bg)",
                        color: r.rank === 1 ? "#B45309" : "var(--admin-text-muted)",
                        border: "1px solid var(--admin-card-border)", flexShrink: 0,
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        #{r.rank}{r.totalInBatch ? `/${r.totalInBatch}` : ""}
                      </span>
                    )}

                    {/* Score */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(r.percentage), letterSpacing: "-0.3px", fontVariantNumeric: "tabular-nums" }}>
                        {r.percentage.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 1 }}>
                        {r.total} marks{r.percentile != null ? ` · ${r.percentile}p` : ""}
                      </div>
                    </div>

                    {/* Chevron */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--admin-text-faint)" strokeWidth="2.5" strokeLinecap="round"
                      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>

                  {/* Expanded subject breakdown */}
                  {open && (
                    <div style={{ padding: "4px 20px 18px", borderTop: "1px solid var(--admin-card-border)" }}>
                      <div style={{ paddingTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                        {entries.map(([subj, score]) => {
                          const pct = Math.min(100, Math.round((score / perSubjMax) * 100));
                          return (
                            <div key={subj} style={{
                              background: "var(--admin-card-bg)", borderRadius: 12, padding: "12px 16px",
                              border: "1px solid var(--admin-card-border)",
                            }}>
                              <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginBottom: 6 }}>{subj}</div>
                              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.3px", fontVariantNumeric: "tabular-nums" }}>
                                {score}
                              </div>
                              <div style={{ marginTop: 8, height: 4, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, borderRadius: 100, background: scoreColor(pct), transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
