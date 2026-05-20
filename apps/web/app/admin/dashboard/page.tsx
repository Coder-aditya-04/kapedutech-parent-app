"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type Student = { id: string; name: string; enrollmentNo: string; batch: string; parent: { phone: string; name: string } };
type AttendanceRecord = { id: string; studentId: string; date: string; type: "PUNCH_IN" | "PUNCH_OUT"; markedAt: string; student: Student };
type StudentSummary = { student: Student; punchIn: string | null; punchOut: string | null };
type BatchAnalytics = { id: string; name: string; totalStudents: number; avgAttendancePct: number; totalWorkingDays?: number };
type TestMeta = { testName: string; testDate: string; count: number };
type SubjectAvg = { subject: string; avg: number; fill: string };

const PALETTE = ["#6366F1","#0D9488","#F59E0B","#0891B2","#8B5CF6","#BE185D","#08BD80","#EC4899"];
function batchColor(name: string, all: string[]) { return PALETTE[all.indexOf(name) % PALETTE.length] ?? "#6366F1"; }
function attColor(p: number) { return p >= 75 ? "#08BD80" : p >= 50 ? "#F59E0B" : "#FB923C"; }
function attBg(p: number) { return p >= 75 ? "rgba(8,189,128,0.08)" : p >= 50 ? "rgba(245,158,11,0.08)" : "rgba(251,146,60,0.08)"; }
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Sparkline({ data, color = "#3B82F6", w = 120, h = 36 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return <svg width={w} height={h} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pad = 4;
  const pts = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (w - pad * 2),
    h - pad - ((v - min) / range) * (h - pad * 2),
  ] as [number, number]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line}L${pts.at(-1)![0]},${h}L${pts[0]![0]},${h}Z`;
  const gid = `spk${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="2.5" fill={color} />
    </svg>
  );
}

const CENTERS = ["All", "College Road", "Nashik Road"];

export default function DashboardPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [batches, setBatches] = useState<BatchAnalytics[]>([]);
  const [batchNames, setBatchNames] = useState<string[]>(["All"]);
  const [tests, setTests] = useState<TestMeta[]>([]);
  const [sparkData, setSparkData] = useState<{ date: string; label: string; present: number }[]>([]);
  const [subjectAvgs, setSubjectAvgs] = useState<SubjectAvg[]>([]);
  const [subjectRaw, setSubjectRaw] = useState<{ scores: Record<string, number>; student?: { batch: string } }[]>([]);
  const [subjectBatch, setSubjectBatch] = useState("All");
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState("All");
  const [center, setCenter] = useState("All");
  const [batchCenter, setBatchCenter] = useState("All");
  const [batchChartBatches, setBatchChartBatches] = useState<BatchAnalytics[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const cp = center !== "All" ? `?center=${encodeURIComponent(center)}` : "";
      const [sRes, aRes, bRes, tRes] = await Promise.all([
        fetch(`/api/admin/students${cp}`),
        fetch(`/api/admin/attendance/today${cp}`),
        fetch(`/api/admin/batches/analytics${cp}`),
        fetch(`/api/admin/results/tests${cp}`),
      ]);
      const stu: Student[] = sRes.ok ? await sRes.json() : [];
      const att: AttendanceRecord[] = aRes.ok ? await aRes.json() : [];
      const bat: BatchAnalytics[] = bRes.ok ? await bRes.json() : [];
      const tst: TestMeta[] = tRes.ok ? await tRes.json() : [];
      setStudents(stu); setRecords(att); setBatches(bat); setTests(tst);
      setBatchNames(["All", ...bat.map(b => b.name)]);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }, [center]);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  useEffect(() => {
    const cp = batchCenter !== "All" ? `?center=${encodeURIComponent(batchCenter)}` : "";
    fetch(`/api/admin/batches/analytics${cp}`)
      .then(r => r.ok ? r.json() : [])
      .then((b: BatchAnalytics[]) => setBatchChartBatches(b))
      .catch(() => {});
  }, [batchCenter]);

  useEffect(() => {
    async function fetchSpark() {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-IN", { weekday: "short" }) };
      });
      try {
        const cp = center !== "All" ? `&center=${encodeURIComponent(center)}` : "";
        const results = await Promise.all(days.map(async ({ date, label }) => {
          const res = await fetch(`/api/admin/attendance/date?date=${date}${cp}`);
          const recs: AttendanceRecord[] = res.ok ? await res.json() : [];
          return { date, label, present: new Set(recs.filter(r => r.type === "PUNCH_IN").map(r => r.studentId)).size };
        }));
        setSparkData(results);
      } catch {}
    }
    fetchSpark();
  }, [center]);

  useEffect(() => {
    if (!tests.length) return;
    const latest = tests[0];
    const cp = center !== "All" ? `&center=${encodeURIComponent(center)}` : "";
    fetch(`/api/admin/results/test/${encodeURIComponent(latest.testName)}?date=${latest.testDate}${cp}`)
      .then(r => r.ok ? r.json() : [])
      .then((results: { scores: Record<string, number>; student?: { batch: string } }[]) => {
        if (!results.length) return;
        setSubjectRaw(results);
      }).catch(() => {});
  }, [tests, center]);

  useEffect(() => {
    if (!subjectRaw.length) return;
    const filtered = subjectBatch === "All" ? subjectRaw : subjectRaw.filter(r => r.student?.batch === subjectBatch);
    if (!filtered.length) { setSubjectAvgs([]); return; }
    const subs = Object.keys(filtered[0].scores ?? {});
    const COLORS = ["#6366F1","#08BD80","#F59E0B","#0891B2","#8B5CF6"];
    setSubjectAvgs(subs.map((s, i) => ({
      subject: s,
      avg: Math.round(filtered.reduce((a, r) => a + (r.scores[s] ?? 0), 0) / filtered.length),
      fill: COLORS[i % COLORS.length],
    })));
  }, [subjectRaw, subjectBatch]);

  const allPresentIds = new Set(records.filter(r => r.type === "PUNCH_IN").map(r => r.studentId));
  const filtered = batch === "All" ? records : records.filter(r => r.student?.batch === batch);
  const summaryMap = new Map<string, StudentSummary>();
  filtered.forEach(r => {
    if (!summaryMap.has(r.studentId)) summaryMap.set(r.studentId, { student: r.student, punchIn: null, punchOut: null });
    const s = summaryMap.get(r.studentId)!;
    const time = new Date(r.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    if (r.type === "PUNCH_IN") s.punchIn = time;
    if (r.type === "PUNCH_OUT") s.punchOut = time;
  });
  const summaries = Array.from(summaryMap.values());
  const attPct = students.length > 0 ? Math.round(allPresentIds.size / students.length * 100) : 0;
  const atRiskBatches = batches.filter(b => b.totalStudents > 0 && b.avgAttendancePct < 75).sort((a, b) => a.avgAttendancePct - b.avgAttendancePct);
  const batchChartData = (batchChartBatches.length > 0 ? batchChartBatches : batches)
    .filter(b => b.totalStudents > 0)
    .map(b => ({ name: b.name.length > 12 ? b.name.slice(0, 11) + "…" : b.name, fullName: b.name, pct: b.avgAttendancePct, fill: attColor(b.avgAttendancePct) }))
    .sort((a, b) => b.pct - a.pct);
  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const refreshStr = lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const sparkNums = sparkData.map(d => d.present);
  const todaySparkMax = sparkData.length > 0 ? Math.max(...sparkNums) : 0;

  /* ── card shared style ── */
  const card: React.CSSProperties = {
    background: "var(--admin-card-bg)",
    border: "1px solid var(--admin-card-border)",
    borderRadius: 16,
  };

  return (
    <div className="admin-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: 18,
        background: [
          "radial-gradient(circle at 8% 20%, rgba(8,189,128,0.55), transparent 45%)",
          "radial-gradient(circle at 100% 35%, rgba(99,102,241,0.45), transparent 55%)",
          "radial-gradient(circle at 75% 110%, rgba(236,72,153,0.30), transparent 55%)",
          "radial-gradient(circle at 30% 110%, rgba(245,158,11,0.22), transparent 50%)",
          "linear-gradient(135deg, #0E1A22 0%, #0B1B1E 50%, #0A1A1F 100%)",
        ].join(","),
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "22px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}>
        {/* Concentric rings — same pattern as AI Caller */}
        <div style={{ position: "absolute", right: -20, top: "50%", transform: "translateY(-50%)", opacity: 0.07, pointerEvents: "none" }}>
          <svg width="220" height="220" viewBox="0 0 220 220" fill="none">
            <circle cx="110" cy="110" r="106" stroke="white" strokeWidth="1"/>
            <circle cx="110" cy="110" r="78" stroke="white" strokeWidth="1"/>
            <circle cx="110" cy="110" r="50" stroke="white" strokeWidth="1"/>
            <circle cx="110" cy="110" r="24" stroke="white" strokeWidth="1"/>
          </svg>
        </div>
        {/* Subtle left glow */}
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 160, background: "linear-gradient(90deg, rgba(8,189,128,0.08), transparent)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>{greeting()}, Admin</h2>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "#4ADE80", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.22)", borderRadius: 100, padding: "2px 8px", fontWeight: 700, letterSpacing: 0.5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />
                LIVE
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.40)" }}>{students.length} students enrolled · {dateStr}</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, position: "relative" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 2 }}>Present Today</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "#fff", letterSpacing: "-1.5px", lineHeight: 1 }}>
              {loading ? "—" : allPresentIds.size}
              <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.30)", marginLeft: 4 }}>/ {students.length}</span>
            </div>
            <div style={{ fontSize: 11, color: attPct >= 75 ? "#4ADE80" : attPct >= 50 ? "#FCD34D" : "#FBBF24", fontWeight: 600, marginTop: 3 }}>
              {attPct}% attendance rate
            </div>
          </div>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh · {refreshStr}
          </button>
        </div>
      </div>

      {/* ── Center filter ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8, marginRight: 4 }}>Center</span>
        {CENTERS.map(c => (
          <button key={c} onClick={() => setCenter(c)} style={{
            padding: "5px 14px", borderRadius: 100, border: "1px solid",
            borderColor: center === c ? "var(--admin-accent)" : "var(--admin-card-border)",
            background: center === c ? "var(--admin-accent)" : "var(--admin-input-bg)",
            color: center === c ? "#fff" : "var(--admin-text-muted)",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{c}</button>
        ))}
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────────── */}
      <div className="stat-grid">
        {([
          {
            label: "Total Students",
            color: "#0EA5E9",
            value: loading ? "—" : students.length,
            sub: `${batches.length} batch${batches.length !== 1 ? "es" : ""}`,
            progress: 100,
            icon: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>,
            onClick: () => router.push("/admin/students"),
          },
          {
            label: "Present Today",
            color: "#08BD80",
            value: loading ? "—" : `${attPct}%`,
            sub: `${allPresentIds.size} of ${students.length} students`,
            progress: attPct,
            icon: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
            onClick: () => router.push("/admin/attendance"),
          },
          {
            label: "Need Attention",
            color: atRiskBatches.length > 0 ? "#F59E0B" : "#08BD80",
            value: loading ? "—" : atRiskBatches.length,
            sub: atRiskBatches.length > 0 ? `batch${atRiskBatches.length !== 1 ? "es" : ""} below 75%` : "All batches on track",
            progress: batches.length > 0 ? Math.round((batches.length - atRiskBatches.length) / batches.length * 100) : 100,
            icon: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
            onClick: () => router.push("/admin/batches"),
          },
          {
            label: "Tests Uploaded",
            color: "#8B5CF6",
            value: loading ? "—" : tests.length,
            sub: tests.length > 0 ? `Latest: ${tests[0]?.testName}` : "No tests yet",
            progress: Math.min(tests.length * 10, 100),
            icon: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
            onClick: () => router.push("/admin/results"),
          },
        ] as { label: string; color: string; value: string | number; sub: string; progress: number; icon: React.ReactNode; onClick: () => void }[]).map((s, i) => (
          <div
            key={i}
            onClick={s.onClick}
            style={{ ...card, padding: "18px 20px", position: "relative", overflow: "hidden", cursor: "pointer", transition: "box-shadow 0.2s, transform 0.2s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 28px ${s.color}18`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--admin-text-faint)", letterSpacing: 0.9, textTransform: "uppercase" }}>{s.label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: `${s.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
              </div>
            </div>
            {/* Value in foreground color — not the accent color */}
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-1.5px", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 5, marginBottom: 12 }}>{s.sub}</div>
            {/* Progress bar at bottom like AI Caller */}
            <div style={{ height: 3, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${s.progress}%`, background: s.color, borderRadius: 100, transition: "width 0.8s ease" }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Main content 2-column ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 332px", gap: 16, alignItems: "start" }}>

        {/* LEFT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Batch attendance chart — vertical */}
          <div style={{ ...card, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Batch Performance</div>
                <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 2 }}>Average attendance % · last 30 days</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Center dropdown */}
                <select
                  value={batchCenter}
                  onChange={e => setBatchCenter(e.target.value)}
                  style={{ padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "var(--admin-input-bg)", border: "1px solid var(--admin-card-border)", color: "var(--admin-text)", cursor: "pointer", outline: "none" }}
                >
                  {["All", "College Road", "Nashik Road"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {[{ label: "≥75%", color: "#08BD80" }, { label: "50–75%", color: "#F59E0B" }, { label: "<50%", color: "#FB923C" }].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--admin-text-faint)" }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
            {batchChartData.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--admin-text-faint)", fontSize: 13 }}>No batch data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, batchChartData.length * 52)}>
                <BarChart data={batchChartData} margin={{ top: 4, right: 8, left: 0, bottom: batchChartData.length > 4 ? 50 : 16 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.10)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }}
                    axisLine={false}
                    tickLine={false}
                    angle={batchChartData.length > 4 ? -35 : 0}
                    textAnchor={batchChartData.length > 4 ? "end" : "middle"}
                    interval={0}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={36} />
                  <Tooltip
                    cursor={{ fill: "rgba(128,128,128,0.05)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>
                          <div style={{ fontWeight: 700, color: "var(--admin-text)", marginBottom: 2 }}>{d.fullName}</div>
                          <div style={{ color: d.fill, fontWeight: 700 }}>{d.pct}% attendance</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="pct" name="Attendance" radius={[6, 6, 0, 0]} maxBarSize={40}
                    label={{ position: "top", fontSize: 10, fontWeight: 700, formatter: (v: unknown) => `${v}%`, fill: "var(--admin-text-faint)" as string }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* At-risk batches */}
          {atRiskBatches.length > 0 && (
            <div style={{ ...card, padding: 22, borderColor: "rgba(245,158,11,0.22)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flexShrink: 0 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Needs Attention</div>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#F59E0B", background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 100, padding: "2px 8px", fontWeight: 700 }}>
                  {atRiskBatches.length} below 75%
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {atRiskBatches.map((b, i) => (
                  <div
                    key={b.id}
                    onClick={() => router.push(`/admin/batches/${encodeURIComponent(b.name)}`)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: attBg(b.avgAttendancePct), borderRadius: 10, border: `1px solid ${attColor(b.avgAttendancePct)}20`, cursor: "pointer", transition: "opacity 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${attColor(b.avgAttendancePct)}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: attColor(b.avgAttendancePct), flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: "var(--admin-text-faint)" }}>{b.totalStudents} students</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: attColor(b.avgAttendancePct), letterSpacing: "-0.5px" }}>{b.avgAttendancePct}%</div>
                      <div style={{ fontSize: 10, color: "var(--admin-text-faint)" }}>avg att.</div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={attColor(b.avgAttendancePct)} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subject performance */}
          {subjectRaw.length > 0 && (
            <div style={{ ...card, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Subject Performance</div>
                  <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 2 }}>
                    Average scores · {tests[0]?.testName} ({tests[0]?.testDate})
                  </div>
                </div>
                <select
                  value={subjectBatch}
                  onChange={e => setSubjectBatch(e.target.value)}
                  style={{ padding: "4px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "var(--admin-input-bg)", border: "1px solid var(--admin-card-border)", color: "var(--admin-text)", cursor: "pointer", outline: "none" }}
                >
                  {["All", ...Array.from(new Set(subjectRaw.map(r => r.student?.batch).filter((b): b is string => !!b)))].map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              {subjectAvgs.length === 0 ? (
                <div style={{ padding: "16px 0", textAlign: "center", color: "var(--admin-text-faint)", fontSize: 12 }}>No results for this batch</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[...subjectAvgs].sort((a, b) => b.avg - a.avg).map(s => {
                    const maxAvg = Math.max(...subjectAvgs.map(x => x.avg), 1);
                    const pct = Math.round(s.avg / maxAvg * 100);
                    return (
                      <div key={s.subject}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text)" }}>{s.subject}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: s.fill }}>{s.avg} avg</span>
                        </div>
                        <div style={{ height: 5, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: s.fill, borderRadius: 100, transition: "width 0.8s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* 7-day trend */}
          <div style={{ ...card, padding: 22 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>Attendance Trend</div>
              <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 2 }}>Students present · last 7 days</div>
            </div>
            {sparkData.length > 0 ? (
              <>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <Sparkline data={sparkNums} color="var(--admin-accent)" w={268} h={52} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                  {sparkData.map((d, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: i === 6 ? "var(--admin-accent)" : "var(--admin-text)", letterSpacing: "-0.5px" }}>{d.present}</div>
                      <div style={{ fontSize: 9, color: "var(--admin-text-faint)", marginTop: 1 }}>{d.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--admin-input-bg)", borderRadius: 8, border: "1px solid var(--admin-card-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--admin-text-faint)" }}>Peak this week</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-accent)" }}>{todaySparkMax} students</span>
                </div>
              </>
            ) : (
              <div style={{ padding: "20px 0", display: "flex", gap: 3, alignItems: "flex-end", justifyContent: "center", height: 60 }}>
                {[30, 50, 45, 62, 55, 70, 65].map((h, i) => (
                  <div key={i} className="admin-skeleton" style={{ width: 22, height: `${h}%`, borderRadius: 4 }} />
                ))}
              </div>
            )}
          </div>

          {/* Recent tests */}
          <div style={{ ...card, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>Recent Tests</div>
              <button onClick={() => router.push("/admin/results")} style={{ fontSize: 11, color: "var(--admin-accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>View all →</button>
            </div>
            {tests.length === 0 ? (
              <div style={{ padding: "16px 0", textAlign: "center", color: "var(--admin-text-faint)", fontSize: 12 }}>No tests uploaded yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {tests.slice(0, 5).map((t, i) => (
                  <div
                    key={i}
                    onClick={() => router.push(`/admin/results?test=${encodeURIComponent(t.testName)}&date=${t.testDate}`)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--admin-input-bg)", borderRadius: 10, border: "1px solid var(--admin-card-border)", cursor: "pointer", transition: "border-color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--admin-accent)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--admin-card-border)")}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${PALETTE[i % PALETTE.length]}16`, color: PALETTE[i % PALETTE.length], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 800 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.testName}</div>
                      <div style={{ fontSize: 10, color: "var(--admin-text-faint)" }}>{t.testDate} · {t.count} students</div>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--admin-text-faint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ ...card, padding: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", marginBottom: 12 }}>Quick Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[
                { label: "View All Students", href: "/admin/students", color: "#0EA5E9" },
                { label: "Mark Attendance", href: "/admin/attendance", color: "#08BD80" },
                { label: "Upload Test Results", href: "/admin/results", color: "#8B5CF6" },
                { label: "Generate QR Codes", href: "/admin/qr-codes", color: "#0891B2" },
              ].map(a => (
                <button
                  key={a.href}
                  onClick={() => router.push(a.href)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: `${a.color}08`, border: `1px solid ${a.color}18`, borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "background 0.15s, border-color 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${a.color}14`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${a.color}36`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${a.color}08`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${a.color}18`; }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text)" }}>{a.label}</span>
                  <svg style={{ marginLeft: "auto" }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Live Attendance Table ─────────────────────────────────────────── */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--admin-card-border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Live Attendance</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "#059669", background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.18)", borderRadius: 100, padding: "3px 10px", fontWeight: 600 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
              Auto-refresh · {refreshStr}
            </span>
          </div>
          <div style={{ display: "flex", gap: 5, overflowX: "auto", scrollbarWidth: "none" }}>
            {batchNames.map(b => (
              <button key={b} onClick={() => setBatch(b)} style={{ padding: "4px 12px", borderRadius: 100, border: "1px solid", borderColor: batch === b ? "var(--admin-accent)" : "var(--admin-card-border)", background: batch === b ? "var(--admin-accent)" : "transparent", color: batch === b ? "#fff" : "var(--admin-text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{b}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--admin-input-bg)" }}>
                {["Student", "Enrollment", "Batch", "Punch In", "Punch Out", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 18px", textAlign: "left", color: "var(--admin-text-faint)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid var(--admin-card-border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "var(--admin-text-faint)" }}>Loading…</td></tr>
              ) : summaries.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: "center" }}>
                  <div style={{ color: "var(--admin-text-faint)", fontSize: 14, fontWeight: 500 }}>No attendance records for today</div>
                  <div style={{ color: "var(--admin-text-faint)", fontSize: 12, marginTop: 4, opacity: 0.6 }}>Records appear as students scan their QR codes</div>
                </td></tr>
              ) : summaries.map(s => {
                const status = s.punchIn && s.punchOut ? "Complete" : s.punchIn ? "In Progress" : "Absent";
                const sc = {
                  Complete: { color: "#08BD80", bg: "rgba(8,189,128,0.08)", label: "✓ Complete" },
                  "In Progress": { color: "#F59E0B", bg: "rgba(245,158,11,0.08)", label: "● In Progress" },
                  Absent: { color: "#FB923C", bg: "rgba(251,146,60,0.08)", label: "○ Absent" },
                }[status] ?? { color: "#FB923C", bg: "rgba(251,146,60,0.08)", label: "Absent" };
                return (
                  <tr key={s.student.id} style={{ borderTop: "1px solid var(--admin-card-border)", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--admin-input-bg)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "11px 18px", fontWeight: 600, color: "var(--admin-text)" }}>{s.student.name}</td>
                    <td style={{ padding: "11px 18px", color: "var(--admin-text-muted)", fontFamily: "monospace", fontSize: 12 }}>{s.student.enrollmentNo}</td>
                    <td style={{ padding: "11px 18px" }}>
                      <span style={{ background: batchColor(s.student.batch, batchNames.slice(1)), color: "#fff", borderRadius: 100, padding: "3px 10px", fontSize: 10, fontWeight: 700, display: "inline-block" }}>{s.student.batch || "—"}</span>
                    </td>
                    <td style={{ padding: "11px 18px", color: s.punchIn ? "#08BD80" : "var(--admin-text-faint)", fontWeight: s.punchIn ? 600 : 400 }}>{s.punchIn ?? "—"}</td>
                    <td style={{ padding: "11px 18px", color: s.punchOut ? "#3B82F6" : "var(--admin-text-faint)", fontWeight: s.punchOut ? 600 : 400 }}>{s.punchOut ?? "—"}</td>
                    <td style={{ padding: "11px 18px" }}>
                      <span style={{ background: sc.bg, color: sc.color, borderRadius: 100, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{sc.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
