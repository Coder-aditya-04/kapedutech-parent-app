"use client";
import { useEffect, useState, useCallback } from "react";

type Student = { id: string; name: string; enrollmentNo: string; batch: string; parent: { phone: string; name: string } };
type AttendanceRecord = { id: string; studentId: string; date: string; type: "PUNCH_IN" | "PUNCH_OUT"; markedAt: string; student: Student };
type StudentSummary = { student: Student; punchIn: string | null; punchOut: string | null };

const BATCH_COLORS = ["#0064E0", "#6441D2", "#059669", "#D97706", "#0891B2", "#DC2626"];
function batchColor(batchName: string, allBatches: string[]) {
  const idx = allBatches.indexOf(batchName);
  return BATCH_COLORS[idx % BATCH_COLORS.length] ?? "#0064E0";
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState("All");
  const [batches, setBatches] = useState<string[]>(["All"]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    fetch("/api/admin/batches")
      .then(r => r.ok ? r.json() : [])
      .then((data: { name: string }[]) => setBatches(["All", ...data.map(b => b.name)]))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const [recRes, stuRes] = await Promise.all([fetch("/api/admin/attendance/today"), fetch("/api/admin/students")]);
      setRecords(recRes.ok ? await recRes.json() : []);
      setStudents(stuRes.ok ? await stuRes.json() : []);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

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
  const presentIds = new Set(filtered.filter(r => r.type === "PUNCH_IN").map(r => r.studentId));
  const punchIns = filtered.filter(r => r.type === "PUNCH_IN").length;
  const punchOuts = filtered.filter(r => r.type === "PUNCH_OUT").length;

  const stats = [
    { label: "Total Students", value: students.length, sub: `${batches.length - 1} batch${batches.length - 1 !== 1 ? "es" : ""}`, color: "#1D6BF3", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
    { label: "Present Today",   value: presentIds.size, sub: presentIds.size > 0 ? `${Math.round(presentIds.size / Math.max(students.length, 1) * 100)}% attendance rate` : "No scans yet", color: "#059669", icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3" },
    { label: "Punch Ins",       value: punchIns, sub: "Entries recorded", color: "#0891B2", icon: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" },
    { label: "Punch Outs",      value: punchOuts, sub: "Exits recorded",   color: "#7C3AED", icon: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" },
  ];

  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const refreshStr = lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="admin-page" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Hero banner */}
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: 20,
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "28px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -40, right: 80, width: 200, height: 200, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -20, right: 20, width: 140, height: 140, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.07)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, right: 160, width: 180, height: 180, borderRadius: "50%", border: "1px solid rgba(29,107,243,0.15)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(29,107,243,0.25)", border: "1px solid rgba(29,107,243,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D6BF3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.4px" }}>{greeting()}, Admin</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
              {students.length} students enrolled · {dateStr}
            </p>
          </div>
        </div>

        <button
          onClick={load}
          style={{
            display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer",
            backdropFilter: "blur(8px)", position: "relative",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} style={{
            background: "var(--admin-card-bg)",
            border: "1px solid var(--admin-card-border)",
            borderRadius: 16, padding: "20px 22px",
            position: "relative", overflow: "hidden",
          }}>
            {/* Top: label + icon */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", letterSpacing: 0.8, textTransform: "uppercase" }}>{s.label}</span>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {s.icon.split("M").filter(Boolean).map((d, j) => <path key={j} d={`M${d}`} />)}
                </svg>
              </div>
            </div>
            {/* Big number */}
            <div style={{ fontSize: 36, fontWeight: 800, color: s.color, letterSpacing: "-1px", lineHeight: 1 }}>
              {loading ? "—" : s.value}
            </div>
            {/* Subtitle */}
            <div style={{ fontSize: 12, color: "var(--admin-text-faint)", marginTop: 6 }}>{s.sub}</div>
            {/* Colored bottom accent line */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${s.color}, ${s.color}44)`, borderRadius: "0 0 16px 16px" }} />
          </div>
        ))}
      </div>

      {/* Live attendance */}
      <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", overflow: "hidden" }}>

        {/* Card header */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--admin-card-border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--admin-text)" }}>Live attendance</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#059669", background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 100, padding: "3px 10px", fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", display: "inline-block", animation: "pulse 2s infinite" }} />
              Auto-refresh · {refreshStr}
            </span>
          </div>
          {/* Batch tabs */}
          <div style={{ display: "flex", gap: 5, overflowX: "auto", scrollbarWidth: "none" }}>
            {batches.map(b => (
              <button key={b} onClick={() => setBatch(b)} style={{
                padding: "4px 12px", borderRadius: 100, border: "1px solid",
                borderColor: batch === b ? "var(--admin-accent)" : "var(--admin-card-border)",
                background: batch === b ? "var(--admin-accent)" : "transparent",
                color: batch === b ? "#fff" : "var(--admin-text-muted)",
                fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              }}>{b}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Student Name", "Enrollment", "Batch", "Punch In", "Punch Out", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 20px", textAlign: "left", color: "var(--admin-text-faint)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, background: "var(--admin-input-bg)", borderBottom: "1px solid var(--admin-card-border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "var(--admin-text-faint)" }}>Loading…</td></tr>
              ) : summaries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 48, textAlign: "center" }}>
                    <div style={{ color: "var(--admin-text-faint)", fontSize: 14, fontWeight: 500 }}>No attendance records for today</div>
                    <div style={{ color: "var(--admin-text-faint)", fontSize: 12, marginTop: 4, opacity: 0.6 }}>Records appear as students scan their QR codes</div>
                  </td>
                </tr>
              ) : summaries.map(s => {
                const status = s.punchIn && s.punchOut ? "Complete" : s.punchIn ? "In Progress" : "Absent";
                const sc: Record<string, { color: string; bg: string }> = {
                  Complete:    { color: "#059669", bg: "rgba(5,150,105,0.1)" },
                  "In Progress": { color: "#D97706", bg: "rgba(217,119,6,0.1)" },
                  Absent:      { color: "#DC2626", bg: "rgba(220,38,38,0.1)" },
                };
                const { color, bg } = sc[status];
                return (
                  <tr key={s.student.id} style={{ borderTop: "1px solid var(--admin-card-border)" }}>
                    <td style={{ padding: "12px 20px", fontWeight: 600, color: "var(--admin-text)" }}>{s.student.name}</td>
                    <td style={{ padding: "12px 20px", color: "var(--admin-text-muted)", fontFamily: "monospace", fontSize: 12 }}>{s.student.enrollmentNo}</td>
                    <td style={{ padding: "12px 20px" }}>
                      <span style={{ background: batchColor(s.student.batch, batches.slice(1)), color: "#fff", borderRadius: 100, padding: "3px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, display: "inline-block" }}>{s.student.batch || "—"}</span>
                    </td>
                    <td style={{ padding: "12px 20px", color: s.punchIn ? "#059669" : "var(--admin-text-faint)", fontWeight: s.punchIn ? 600 : 400 }}>{s.punchIn ?? "—"}</td>
                    <td style={{ padding: "12px 20px", color: s.punchOut ? "#1D6BF3" : "var(--admin-text-faint)", fontWeight: s.punchOut ? 600 : 400 }}>{s.punchOut ?? "—"}</td>
                    <td style={{ padding: "12px 20px" }}>
                      <span style={{ background: bg, color, borderRadius: 100, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{status}</span>
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
