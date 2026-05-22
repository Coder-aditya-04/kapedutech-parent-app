"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";

type Student = { id: string; name: string; batch: string; center: string };
type AttRecord = { studentId: string; type: "PUNCH_IN" | "PUNCH_OUT"; markedAt: string; student: Student };
type BatchAnalytics = { id: string; name: string; totalStudents: number; avgAttendancePct: number };
type TestMeta = { testName: string; testDate: string; count: number };
type TestResult = { studentId: string; scores: Record<string, number>; student: { name: string; enrollmentNo: string; batch: string; center: string } };
type SparkPoint = { date: string; label: string; cr: number; nr: number; total: number };

const CR_COLOR = "#08BD80";
const NR_COLOR = "#6366F1";

function attColor(p: number) { return p >= 75 ? "#08BD80" : p >= 50 ? "#F59E0B" : "#FB923C"; }

const card: React.CSSProperties = {
  background: "var(--admin-card-bg)",
  border: "1px solid var(--admin-card-border)",
  borderRadius: 16,
};

function Select({ value, onChange, options, style }: { value: string; onChange: (v: string) => void; options: string[]; style?: React.CSSProperties }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
        background: "var(--admin-input-bg)", border: "1px solid var(--admin-card-border)",
        color: "var(--admin-text)", cursor: "pointer", outline: "none",
        ...style,
      }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttRecord[]>([]);
  const [batches, setBatches] = useState<BatchAnalytics[]>([]);
  const [tests, setTests] = useState<TestMeta[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [sparkData, setSparkData] = useState<SparkPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<7 | 14>(7);
  const [selectedTest, setSelectedTest] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("All");
  const [rankCenter, setRankCenter] = useState("All");
  const [rankBatches, setRankBatches] = useState<BatchAnalytics[]>([]);

  const load = useCallback(async () => {
    try {
      const [sRes, aRes, bRes, tRes] = await Promise.all([
        fetch("/api/admin/students"),
        fetch("/api/admin/attendance/today"),
        fetch("/api/admin/batches/analytics"),
        fetch("/api/admin/results/tests"),
      ]);
      const stu: Student[] = sRes.ok ? await sRes.json() : [];
      const att: AttRecord[] = aRes.ok ? await aRes.json() : [];
      const bat: BatchAnalytics[] = bRes.ok ? await bRes.json() : [];
      const tst: TestMeta[] = tRes.ok ? await tRes.json() : [];
      setStudents(stu);
      setTodayRecords(att);
      setBatches(bat);
      setTests(tst);
      if (tst.length > 0) setSelectedTest(`${tst[0].testName}|||${tst[0].testDate}`);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Batch ranking filtered by center
  useEffect(() => {
    const cp = rankCenter !== "All" ? `?center=${encodeURIComponent(rankCenter)}` : "";
    fetch(`/api/admin/batches/analytics${cp}`)
      .then(r => r.ok ? r.json() : [])
      .then((b: BatchAnalytics[]) => setRankBatches(b))
      .catch(() => {});
  }, [rankCenter]);

  // Fetch center-split sparkline data
  useEffect(() => {
    async function fetchSpark() {
      const days = Array.from({ length: range }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (range - 1 - i));
        return {
          date: d.toISOString().slice(0, 10),
          label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        };
      });
      try {
        const results = await Promise.all(days.map(async ({ date, label }) => {
          const [rAll, rCR, rNR] = await Promise.all([
            fetch(`/api/admin/attendance/date?date=${date}`).then(r => r.ok ? r.json() : []),
            fetch(`/api/admin/attendance/date?date=${date}&center=College+Road`).then(r => r.ok ? r.json() : []),
            fetch(`/api/admin/attendance/date?date=${date}&center=Nashik+Road`).then(r => r.ok ? r.json() : []),
          ]);
          const count = (recs: AttRecord[]) => new Set(recs.filter(r => r.type === "PUNCH_IN").map(r => r.studentId)).size;
          return { date, label, total: count(rAll), cr: count(rCR), nr: count(rNR) };
        }));
        setSparkData(results);
      } catch {}
    }
    fetchSpark();
  }, [range]);

  // Fetch test results when selected test changes
  useEffect(() => {
    if (!selectedTest) return;
    const [name, date] = selectedTest.split("|||");
    fetch(`/api/admin/results/test/${encodeURIComponent(name)}?date=${date}`)
      .then(r => r.ok ? r.json() : [])
      .then((res: TestResult[]) => setTestResults(res))
      .catch(() => {});
  }, [selectedTest]);

  /* ── Derived ── */
  const presentIds = new Set(todayRecords.filter(r => r.type === "PUNCH_IN").map(r => r.studentId));
  const completedIds = new Set([...presentIds].filter(id => todayRecords.some(r => r.studentId === id && r.type === "PUNCH_OUT")));
  const inProgressCount = presentIds.size - completedIds.size;
  const absentCount = Math.max(students.length - presentIds.size, 0);

  const crStudents = students.filter(s => s.center === "College Road");
  const nrStudents = students.filter(s => s.center === "Nashik Road");
  const crPresent = todayRecords.filter(r => r.type === "PUNCH_IN" && crStudents.some(s => s.id === r.studentId)).length;
  const nrPresent = todayRecords.filter(r => r.type === "PUNCH_IN" && nrStudents.some(s => s.id === r.studentId)).length;

  const pieData = [
    { name: "Full Day", value: completedIds.size, color: "#08BD80" },
    { name: "In Progress", value: inProgressCount, color: "#F59E0B" },
    { name: "Absent", value: absentCount, color: "#EF4444" },
  ].filter(d => d.value > 0);

  // Subject averages, filtered by batch
  const filteredResults = selectedBatch === "All"
    ? testResults
    : testResults.filter(r => r.student?.batch === selectedBatch);

  const allBatches = ["All", ...Array.from(new Set(testResults.map(r => r.student?.batch).filter(Boolean)))];

  const sortedRankBatches = [...(rankBatches.length > 0 ? rankBatches : batches)]
    .filter(b => b.totalStudents > 0)
    .sort((a, b) => b.avgAttendancePct - a.avgAttendancePct);

  const subjectAvgs = filteredResults.length > 0
    ? (() => {
        const COLORS = ["#6366F1", "#08BD80", "#F59E0B", "#0891B2", "#8B5CF6", "#EC4899"];
        const subs = Object.keys(filteredResults[0]?.scores ?? {});
        return subs.map((s, i) => ({
          subject: s,
          avg: Math.round(filteredResults.reduce((a, r) => a + (r.scores[s] ?? 0), 0) / filteredResults.length),
          fill: COLORS[i % COLORS.length],
        }));
      })()
    : [];

  const sparkMax = sparkData.length > 0 ? Math.max(...sparkData.map(d => Math.max(d.cr, d.nr, d.total)), 1) : 10;
  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="admin-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.3px" }}>Analytics</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--admin-text-faint)" }}>{dateStr} · {students.length} students enrolled</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {([7, 14] as const).map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid var(--admin-card-border)",
              background: range === r ? "var(--admin-accent)" : "var(--admin-input-bg)",
              color: range === r ? "#fff" : "var(--admin-text-muted)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>Last {r} days</button>
          ))}
        </div>
      </div>

      {/* ── Center comparison hero ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {[
          { label: "College Road", present: crPresent, total: crStudents.length, color: CR_COLOR, softColor: "rgba(8,189,128,0.12)" },
          { label: "Nashik Road",  present: nrPresent, total: nrStudents.length, color: NR_COLOR, softColor: "rgba(99,102,241,0.12)" },
        ].map(c => {
          const pct = c.total > 0 ? Math.round(c.present / c.total * 100) : 0;
          return (
            <div key={c.label} style={{ ...card, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: c.softColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{c.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-1px", lineHeight: 1 }}>{c.present}</span>
                  <span style={{ fontSize: 13, color: "var(--admin-text-faint)" }}>/ {c.total}</span>
                  <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, color: c.color }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden", marginTop: 8 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: c.color, borderRadius: 100, transition: "width 0.9s ease" }} />
                </div>
                <div style={{ fontSize: 10, color: "var(--admin-text-faint)", marginTop: 5 }}>Present today · {c.total} enrolled</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Row 1: Funnel + Donut ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Attendance Funnel</div>
              <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 3 }}>Today's step-by-step breakdown</div>
            </div>
            <span style={{ fontSize: 10, color: "var(--admin-text-faint)", background: "var(--admin-input-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 6, padding: "4px 10px", fontWeight: 600 }}>Today</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "Total Enrolled",  value: students.length,    pct: 100, color: "var(--admin-accent)" },
              { label: "Arrived Today",   value: presentIds.size,    pct: students.length > 0 ? Math.round(presentIds.size / students.length * 100) : 0, color: "#08BD80" },
              { label: "Full Attendance", value: completedIds.size,  pct: students.length > 0 ? Math.round(completedIds.size / students.length * 100) : 0, color: "#6366F1" },
              { label: "Absent",          value: absentCount,         pct: students.length > 0 ? Math.round(absentCount / students.length * 100) : 0, color: "#EF4444" },
            ].map((f, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "var(--admin-text-muted)", fontWeight: 500 }}>{f.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--admin-text)" }}>{loading ? "—" : f.value}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: f.color, minWidth: 36, textAlign: "right" }}>{f.pct}%</span>
                  </div>
                </div>
                <div style={{ height: 6, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: loading ? "0%" : `${f.pct}%`, background: f.color, borderRadius: 100, transition: "width 0.9s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)", marginBottom: 3 }}>Outcome Breakdown</div>
          <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginBottom: 20 }}>Today's attendance status</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            {loading || students.length === 0 ? (
              <div style={{ width: 130, height: 130, borderRadius: "50%", background: "var(--admin-input-bg)", border: "2px solid var(--admin-card-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "var(--admin-text-faint)", fontSize: 12 }}>—</span>
              </div>
            ) : (
              <div style={{ position: "relative", width: 130, height: 130 }}>
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie data={pieData.length > 0 ? pieData : [{ name: "No data", value: 1, color: "var(--admin-card-border)" }]} cx={60} cy={60} innerRadius={42} outerRadius={60} paddingAngle={2} dataKey="value" strokeWidth={0}>
                      {(pieData.length > 0 ? pieData : [{ color: "var(--admin-card-border)" }]).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-1px", lineHeight: 1 }}>{presentIds.size}</div>
                  <div style={{ fontSize: 9, color: "var(--admin-text-faint)", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>present</div>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Full Day",    value: completedIds.size, color: "#08BD80" },
              { label: "In Progress", value: inProgressCount,   color: "#F59E0B" },
              { label: "Absent",      value: absentCount,        color: "#EF4444" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>{item.label}</span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>{item.value}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: item.color, minWidth: 34, textAlign: "right" }}>
                    {students.length > 0 ? `${Math.round(item.value / students.length * 100)}%` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Center Comparison Chart ── */}
      <div style={{ ...card, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Center Comparison</div>
            <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 3 }}>Students present · last {range} days</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--admin-text-faint)" }}>
              <div style={{ width: 16, height: 3, background: CR_COLOR, borderRadius: 2 }} /> College Road
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--admin-text-faint)" }}>
              <div style={{ width: 16, height: 3, background: NR_COLOR, borderRadius: 2 }} /> Nashik Road
            </div>
          </div>
        </div>
        {sparkData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={sparkData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, Math.max(sparkMax + 2, 10)]} tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div style={{ background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
                      <div style={{ color: "var(--admin-text-faint)", marginBottom: 6, fontWeight: 600 }}>{payload[0]?.payload?.label}</div>
                      {payload.map((p, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color as string }} />
                          <span style={{ color: "var(--admin-text-muted)" }}>{p.name}:</span>
                          <span style={{ fontWeight: 700, color: p.color as string }}>{p.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                }} />
                <Line type="monotone" dataKey="cr" name="College Road" stroke={CR_COLOR} strokeWidth={2} dot={{ r: 3, fill: CR_COLOR, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="nr" name="Nashik Road" stroke={NR_COLOR} strokeWidth={2} dot={{ r: 3, fill: NR_COLOR, strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>

            {/* Summary strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--admin-card-border)" }}>
              {[
                { label: "CR Peak",   value: `${Math.max(...sparkData.map(d => d.cr))} students`,  color: CR_COLOR },
                { label: "NR Peak",   value: `${Math.max(...sparkData.map(d => d.nr))} students`,  color: NR_COLOR },
                { label: "CR Avg",    value: `${Math.round(sparkData.reduce((a, d) => a + d.cr, 0) / sparkData.length)} students`, color: CR_COLOR },
                { label: "NR Avg",    value: `${Math.round(sparkData.reduce((a, d) => a + d.nr, 0) / sparkData.length)} students`, color: NR_COLOR },
              ].map((s, i) => (
                <div key={i} style={{ padding: "10px 14px", background: "var(--admin-input-bg)", borderRadius: 10, border: "1px solid var(--admin-card-border)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text-faint)", fontSize: 13 }}>Loading data…</div>
        )}
      </div>

      {/* ── Center vs Center bar comparison ── */}
      {sparkData.length > 0 && (
        <div style={{ ...card, padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Daily Attendance by Center</div>
            <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 3 }}>Side-by-side comparison · last {range} days</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sparkData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div style={{ background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>
                    <div style={{ color: "var(--admin-text-faint)", marginBottom: 4 }}>{payload[0]?.payload?.label}</div>
                    {payload.map((p, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                        <div style={{ width: 8, height: 8, background: p.fill as string, borderRadius: 2 }} />
                        <span style={{ color: "var(--admin-text-muted)" }}>{p.name}:</span>
                        <span style={{ fontWeight: 700, color: "var(--admin-text)" }}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                );
              }} />
              <Bar dataKey="cr" name="College Road" fill={CR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="nr" name="Nashik Road" fill={NR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "var(--admin-text-muted)" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Batch ranking + Subject performance ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Batch ranking */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Batch Ranking</div>
              <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 3 }}>Sorted by average attendance · last 30 days</div>
            </div>
            <select
              value={rankCenter}
              onChange={e => setRankCenter(e.target.value)}
              style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--admin-input-bg)", border: "1px solid var(--admin-card-border)", color: "var(--admin-text)", cursor: "pointer", outline: "none" }}
            >
              {["All", "College Road", "Nashik Road"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }} />
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--admin-text-faint)", fontSize: 13 }}>Loading…</div>
          ) : sortedRankBatches.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--admin-text-faint)", fontSize: 13 }}>No batch data yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {sortedRankBatches.map((b, i) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => router.push(`/admin/batches/${encodeURIComponent(b.name)}`)}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", width: 18, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "68%" }}>{b.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: attColor(b.avgAttendancePct), flexShrink: 0 }}>{b.avgAttendancePct}%</span>
                    </div>
                    <div style={{ height: 5, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${b.avgAttendancePct}%`, background: attColor(b.avgAttendancePct), borderRadius: 100, transition: "width 0.9s ease" }} />
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, fontSize: 10, color: "var(--admin-text-faint)" }}>{b.totalStudents} stu.</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subject performance with batch dropdown */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Subject Performance</div>
              <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 3 }}>
                {tests.length > 0 ? "Average scores by batch" : "No test data yet"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {tests.length > 0 && (
                <Select
                  value={selectedTest}
                  onChange={setSelectedTest}
                  options={tests.map(t => `${t.testName}|||${t.testDate}`)}
                  style={{ maxWidth: 130 }}
                />
              )}
              {allBatches.length > 1 && (
                <Select value={selectedBatch} onChange={setSelectedBatch} options={allBatches} />
              )}
            </div>
          </div>
          {/* Show selected test name cleanly */}
          {selectedTest && (
            <div style={{ fontSize: 11, color: "var(--admin-accent)", fontWeight: 600, marginBottom: 16 }}>
              {selectedTest.split("|||")[0]} · {selectedTest.split("|||")[1]}
              {selectedBatch !== "All" && <span style={{ color: "var(--admin-text-faint)", fontWeight: 400 }}> · {selectedBatch}</span>}
            </div>
          )}

          {subjectAvgs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--admin-text-faint)", fontSize: 13 }}>
              {loading ? "Loading…" : tests.length > 0 ? "Loading subject breakdown…" : "Upload test results to see subject analytics"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[...subjectAvgs].sort((a, b) => b.avg - a.avg).map((s, i) => {
                const maxAvg = Math.max(...subjectAvgs.map(x => x.avg), 1);
                const pct = Math.round(s.avg / maxAvg * 100);
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text)" }}>{s.subject}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: s.fill }}>{s.avg} avg</span>
                    </div>
                    <div style={{ height: 5, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: s.fill, borderRadius: 100, transition: "width 0.9s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tests.length > 1 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--admin-card-border)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Recent Tests</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {tests.slice(0, 4).map((t, i) => (
                  <div key={i} onClick={() => router.push(`/admin/results?test=${encodeURIComponent(t.testName)}&date=${t.testDate}`)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "var(--admin-input-bg)", borderRadius: 8, border: "1px solid var(--admin-card-border)", cursor: "pointer", transition: "border-color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--admin-accent)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--admin-card-border)")}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-text)" }}>{t.testName}</span>
                    <span style={{ fontSize: 10, color: "var(--admin-text-faint)" }}>{t.testDate} · {t.count} stu.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Health + Engagement ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", marginBottom: 3 }}>Attendance Health</div>
          <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginBottom: 16 }}>Batch status overview</div>
          {batches.length === 0 ? (
            <div style={{ color: "var(--admin-text-faint)", fontSize: 12 }}>No batches yet</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Healthy",  value: batches.filter(b => b.avgAttendancePct >= 75).length,                                          color: "#08BD80" },
                  { label: "Warning",  value: batches.filter(b => b.avgAttendancePct >= 50 && b.avgAttendancePct < 75).length,               color: "#F59E0B" },
                  { label: "Critical", value: batches.filter(b => b.avgAttendancePct < 50).length,                                           color: "#FB923C" },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, padding: "10px 12px", background: `${s.color}0a`, border: `1px solid ${s.color}20`, borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-1px" }}>{s.value}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 6, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden", display: "flex" }}>
                {(() => {
                  const total = batches.length;
                  const h = batches.filter(b => b.avgAttendancePct >= 75).length;
                  const w = batches.filter(b => b.avgAttendancePct >= 50 && b.avgAttendancePct < 75).length;
                  const c = batches.filter(b => b.avgAttendancePct < 50).length;
                  return (
                    <>
                      <div style={{ width: `${total > 0 ? (h / total) * 100 : 0}%`, height: "100%", background: "#08BD80" }} />
                      <div style={{ width: `${total > 0 ? (w / total) * 100 : 0}%`, height: "100%", background: "#F59E0B" }} />
                      <div style={{ width: `${total > 0 ? (c / total) * 100 : 0}%`, height: "100%", background: "#FB923C" }} />
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", marginBottom: 3 }}>Student Engagement</div>
          <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginBottom: 16 }}>Today's punch-in patterns</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "On time (before 9 AM)",   value: todayRecords.filter(r => r.type === "PUNCH_IN" && new Date(r.markedAt).getHours() < 9).length,                                                    color: "#08BD80" },
              { label: "Late (9 AM – 10 AM)",     value: todayRecords.filter(r => r.type === "PUNCH_IN" && new Date(r.markedAt).getHours() >= 9 && new Date(r.markedAt).getHours() < 10).length,          color: "#F59E0B" },
              { label: "Very late (after 10 AM)", value: todayRecords.filter(r => r.type === "PUNCH_IN" && new Date(r.markedAt).getHours() >= 10).length,                                                   color: "#FB923C" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", marginBottom: 3 }}>Quick Navigation</div>
          <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginBottom: 16 }}>Jump to any section</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              { label: "Dashboard",     href: "/admin/dashboard",  color: "#0EA5E9" },
              { label: "Students",      href: "/admin/students",   color: "#8B5CF6" },
              { label: "Attendance",    href: "/admin/attendance", color: "#08BD80" },
              { label: "Test Results",  href: "/admin/results",    color: "#F59E0B" },
              { label: "Batch Details", href: "/admin/batches",    color: "#0891B2" },
            ].map(a => (
              <button key={a.href} onClick={() => router.push(a.href)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: `${a.color}08`, border: `1px solid ${a.color}18`, borderRadius: 9, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${a.color}14`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${a.color}36`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${a.color}08`; (e.currentTarget as HTMLButtonElement).style.borderColor = `${a.color}18`; }}
              >
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text)" }}>{a.label}</span>
                <svg style={{ marginLeft: "auto" }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
