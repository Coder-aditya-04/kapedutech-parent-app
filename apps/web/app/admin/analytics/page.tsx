"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

type Student = { id: string; name: string; batch: string };
type AttRecord = { studentId: string; type: "PUNCH_IN" | "PUNCH_OUT"; markedAt: string; student: Student };
type BatchAnalytics = { id: string; name: string; totalStudents: number; avgAttendancePct: number };
type TestMeta = { testName: string; testDate: string; count: number };
type SubjectAvg = { subject: string; avg: number; fill: string };
type SparkPoint = { date: string; label: string; present: number };

function attColor(p: number) { return p >= 75 ? "#16A34A" : p >= 50 ? "#D97706" : "#DC2626"; }

const card: React.CSSProperties = {
  background: "var(--admin-card-bg)",
  border: "1px solid var(--admin-card-border)",
  borderRadius: 16,
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttRecord[]>([]);
  const [batches, setBatches] = useState<BatchAnalytics[]>([]);
  const [tests, setTests] = useState<TestMeta[]>([]);
  const [sparkData, setSparkData] = useState<SparkPoint[]>([]);
  const [subjectAvgs, setSubjectAvgs] = useState<SubjectAvg[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<7 | 14>(7);

  const load = useCallback(async () => {
    try {
      const [sRes, aRes, bRes, tRes] = await Promise.all([
        fetch("/api/admin/students"),
        fetch("/api/admin/attendance/today"),
        fetch("/api/admin/batches/analytics"),
        fetch("/api/admin/results/tests"),
      ]);
      setStudents(sRes.ok ? await sRes.json() : []);
      setTodayRecords(aRes.ok ? await aRes.json() : []);
      setBatches(bRes.ok ? await bRes.json() : []);
      setTests(tRes.ok ? await tRes.json() : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
          try {
            const res = await fetch(`/api/admin/attendance/date?date=${date}`);
            const recs: AttRecord[] = res.ok ? await res.json() : [];
            return { date, label, present: new Set(recs.filter(r => r.type === "PUNCH_IN").map(r => r.studentId)).size };
          } catch {
            return { date, label, present: 0 };
          }
        }));
        setSparkData(results);
      } catch {}
    }
    fetchSpark();
  }, [range]);

  useEffect(() => {
    if (!tests.length) return;
    const latest = tests[0];
    fetch(`/api/admin/results/test/${encodeURIComponent(latest.testName)}?date=${latest.testDate}`)
      .then(r => r.ok ? r.json() : [])
      .then((results: { scores: Record<string, number> }[]) => {
        if (!results.length) return;
        const subs = Object.keys(results[0].scores ?? {});
        const COLORS = ["#6366F1", "#059669", "#F59E0B", "#EF4444", "#0891B2"];
        setSubjectAvgs(subs.map((s, i) => ({
          subject: s,
          avg: Math.round(results.reduce((a, r) => a + (r.scores[s] ?? 0), 0) / results.length),
          fill: COLORS[i % COLORS.length],
        })));
      }).catch(() => {});
  }, [tests]);

  /* ── Derived funnel data ── */
  const presentIds = new Set(todayRecords.filter(r => r.type === "PUNCH_IN").map(r => r.studentId));
  const completedIds = new Set(
    [...presentIds].filter(id => todayRecords.some(r => r.studentId === id && r.type === "PUNCH_OUT"))
  );
  const inProgressCount = presentIds.size - completedIds.size;
  const absentCount = Math.max(students.length - presentIds.size, 0);
  const totalPresent = presentIds.size;

  const funnelRows = [
    { label: "Total Enrolled",   value: students.length,     pct: 100,                                                                            color: "var(--admin-accent)" },
    { label: "Arrived Today",    value: totalPresent,         pct: students.length > 0 ? Math.round(totalPresent / students.length * 100) : 0,     color: "#16A34A" },
    { label: "Full Attendance",  value: completedIds.size,    pct: students.length > 0 ? Math.round(completedIds.size / students.length * 100) : 0, color: "#6366F1" },
    { label: "Absent",           value: absentCount,          pct: students.length > 0 ? Math.round(absentCount / students.length * 100) : 0,      color: "#DC2626" },
  ];

  const pieData = [
    { name: "Full Day",     value: completedIds.size, color: "#16A34A" },
    { name: "In Progress",  value: inProgressCount,   color: "#D97706" },
    { name: "Absent",       value: absentCount,        color: "#DC2626" },
  ].filter(d => d.value > 0);

  const sortedBatches = [...batches].filter(b => b.totalStudents > 0).sort((a, b) => b.avgAttendancePct - a.avgAttendancePct);
  const sparkMax = sparkData.length > 0 ? Math.max(...sparkData.map(d => d.present), 1) : 10;

  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="admin-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.3px" }}>Analytics</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--admin-text-faint)" }}>{dateStr} · {students.length} students enrolled</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {([7, 14] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: "1px solid var(--admin-card-border)",
                background: range === r ? "var(--admin-accent)" : "var(--admin-input-bg)",
                color: range === r ? "#fff" : "var(--admin-text-muted)",
                fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              Last {r} days
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 1: Funnel + Donut ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>

        {/* Attendance Funnel */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Attendance Funnel</div>
              <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 3 }}>Today's step-by-step breakdown</div>
            </div>
            <span style={{ fontSize: 10, color: "var(--admin-text-faint)", background: "var(--admin-input-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 6, padding: "4px 10px", fontWeight: 600 }}>Today</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {funnelRows.map((f, i) => (
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

        {/* Outcome Breakdown donut */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)", marginBottom: 3 }}>Outcome Breakdown</div>
          <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginBottom: 20 }}>Today's attendance status</div>

          {/* Donut chart */}
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
                      {(pieData.length > 0 ? pieData : [{ color: "var(--admin-card-border)" }]).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--admin-text)", letterSpacing: "-1px", lineHeight: 1 }}>{totalPresent}</div>
                  <div style={{ fontSize: 9, color: "var(--admin-text-faint)", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>present</div>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Full Day",    value: completedIds.size, color: "#16A34A" },
              { label: "In Progress", value: inProgressCount,   color: "#D97706" },
              { label: "Absent",      value: absentCount,        color: "#DC2626" },
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

      {/* ── Row 2: Daily trend chart ─────────────────────────────────────── */}
      <div style={{ ...card, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Daily Attendance</div>
            <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 3 }}>Students present · last {range} days</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--admin-text-faint)" }}>
            <div style={{ width: 16, height: 2, background: "var(--admin-accent)", borderRadius: 1 }} />
            Students present
          </div>
        </div>
        {sparkData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={sparkData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--admin-accent)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="var(--admin-accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, Math.max(sparkMax + 2, students.length > 0 ? Math.ceil(students.length * 1.1) : 10)]}
                tick={{ fontSize: 10, fill: "var(--admin-text-faint)" as string }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div style={{ background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, padding: "8px 14px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
                      <div style={{ color: "var(--admin-text-faint)", marginBottom: 3 }}>{payload[0].payload.label}</div>
                      <div style={{ fontWeight: 700, color: "var(--admin-accent)", fontSize: 15 }}>{payload[0].value} students</div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="present"
                stroke="var(--admin-accent)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--admin-accent)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--admin-accent)", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text-faint)", fontSize: 13 }}>
            Loading attendance data…
          </div>
        )}

        {/* Summary strip */}
        {sparkData.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--admin-card-border)" }}>
            {[
              { label: "Peak Day", value: `${Math.max(...sparkData.map(d => d.present))} students`, color: "#16A34A" },
              { label: "Lowest Day", value: `${Math.min(...sparkData.map(d => d.present))} students`, color: "#DC2626" },
              { label: "7-Day Avg", value: `${Math.round(sparkData.reduce((a, d) => a + d.present, 0) / sparkData.length)} students`, color: "var(--admin-accent)" },
              { label: "Today", value: `${sparkData.at(-1)?.present ?? 0} students`, color: "var(--admin-text)" },
            ].map((s, i) => (
              <div key={i} style={{ padding: "10px 14px", background: "var(--admin-input-bg)", borderRadius: 10, border: "1px solid var(--admin-card-border)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Row 3: Batch ranking + Subject performance ───────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Batch ranking */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)", marginBottom: 3 }}>Batch Ranking</div>
          <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginBottom: 20 }}>Sorted by average attendance performance</div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--admin-text-faint)", fontSize: 13 }}>Loading…</div>
          ) : sortedBatches.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--admin-text-faint)", fontSize: 13 }}>No batch data yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {sortedBatches.map((b, i) => (
                <div
                  key={b.id}
                  style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                  onClick={() => router.push(`/admin/batches/${encodeURIComponent(b.name)}`)}
                >
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

        {/* Subject performance */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)", marginBottom: 3 }}>Subject Performance</div>
          <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginBottom: 20 }}>
            {tests.length > 0 ? `${tests[0].testName} · ${tests[0].testDate}` : "No test data yet"}
          </div>

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

          {/* Test history footer */}
          {tests.length > 1 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--admin-card-border)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Recent Tests</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {tests.slice(0, 4).map((t, i) => (
                  <div
                    key={i}
                    onClick={() => router.push(`/admin/results?test=${encodeURIComponent(t.testName)}&date=${t.testDate}`)}
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

      {/* ── Row 4: Key metrics strip ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>

        {/* Attendance health */}
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", marginBottom: 3 }}>Attendance Health</div>
          <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginBottom: 16 }}>Batch status overview</div>
          {batches.length === 0 ? (
            <div style={{ color: "var(--admin-text-faint)", fontSize: 12 }}>No batches yet</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Healthy", value: batches.filter(b => b.avgAttendancePct >= 75).length, color: "#16A34A" },
                  { label: "Warning", value: batches.filter(b => b.avgAttendancePct >= 50 && b.avgAttendancePct < 75).length, color: "#D97706" },
                  { label: "Critical", value: batches.filter(b => b.avgAttendancePct < 50).length, color: "#DC2626" },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, padding: "10px 12px", background: `${s.color}0a`, border: `1px solid ${s.color}20`, borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--admin-text)", letterSpacing: "-1px" }}>{s.value}</div>
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
                      <div style={{ width: `${total > 0 ? (h / total) * 100 : 0}%`, height: "100%", background: "#16A34A" }} />
                      <div style={{ width: `${total > 0 ? (w / total) * 100 : 0}%`, height: "100%", background: "#D97706" }} />
                      <div style={{ width: `${total > 0 ? (c / total) * 100 : 0}%`, height: "100%", background: "#DC2626" }} />
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        {/* Student engagement */}
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", marginBottom: 3 }}>Student Engagement</div>
          <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginBottom: 16 }}>Today's punch-in patterns</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "On time (before 9 AM)", value: todayRecords.filter(r => r.type === "PUNCH_IN" && new Date(r.markedAt).getHours() < 9).length, color: "#16A34A" },
              { label: "Late (9 AM – 10 AM)", value: todayRecords.filter(r => r.type === "PUNCH_IN" && new Date(r.markedAt).getHours() >= 9 && new Date(r.markedAt).getHours() < 10).length, color: "#D97706" },
              { label: "Very late (after 10 AM)", value: todayRecords.filter(r => r.type === "PUNCH_IN" && new Date(r.markedAt).getHours() >= 10).length, color: "#DC2626" },
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

        {/* Quick nav */}
        <div style={{ ...card, padding: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", marginBottom: 3 }}>Quick Navigation</div>
          <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginBottom: 16 }}>Jump to any section</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              { label: "Dashboard",      href: "/admin/dashboard",  color: "#1D6BF3" },
              { label: "Students",       href: "/admin/students",   color: "#7C3AED" },
              { label: "Attendance",     href: "/admin/attendance", color: "#16A34A" },
              { label: "Test Results",   href: "/admin/results",    color: "#D97706" },
              { label: "Batch Details",  href: "/admin/batches",    color: "#0891B2" },
            ].map(a => (
              <button
                key={a.href}
                onClick={() => router.push(a.href)}
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
