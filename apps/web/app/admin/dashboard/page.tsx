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

export default function DashboardPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState("All");
  const [batches, setBatches] = useState<string[]>(["All"]);

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
  const presentIds = new Set(filtered.map(r => r.studentId));

  const stats = [
    {
      label: "Total Students", value: students.length, color: "#0064E0", bg: "rgba(0,100,224,0.1)",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0064E0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
      label: "Present Today", value: presentIds.size, color: "#007D1E", bg: "rgba(0,125,30,0.1)",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007D1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    },
    {
      label: "Punch Ins", value: filtered.filter(r => r.type === "PUNCH_IN").length, color: "#1877F2", bg: "rgba(24,119,242,0.1)",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1877F2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>,
    },
    {
      label: "Punch Outs", value: filtered.filter(r => r.type === "PUNCH_OUT").length, color: "#6441D2", bg: "rgba(100,65,210,0.1)",
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6441D2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    },
  ];

  return (
    <div className="admin-page">

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--admin-text)", margin: 0, letterSpacing: -0.3 }}>Dashboard</h1>
          <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13, margin: "4px 0 0" }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={load}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 100,
            border: "1px solid var(--admin-card-border)",
            background: "var(--admin-card-bg)",
            color: "var(--admin-text)",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {stats.map(s => (
          <div key={s.label} style={{
            background: "var(--admin-card-bg)",
            borderRadius: 18,
            padding: "18px 22px",
            border: "1px solid var(--admin-card-border)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: s.bg,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>
                {loading ? "—" : s.value}
              </div>
              <div style={{ fontSize: 13, color: "var(--admin-text-muted)", marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Attendance table card */}
      <div style={{
        background: "var(--admin-card-bg)",
        borderRadius: 18,
        border: "1px solid var(--admin-card-border)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}>
        {/* Card header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--admin-card-border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--admin-text)" }}>Today&apos;s Attendance</h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--admin-text-faint)" }}>Live — updates every 30 seconds</p>
            </div>
          </div>
          {/* Scrollable batch tabs */}
          <div style={{
            display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2,
            scrollbarWidth: "none", msOverflowStyle: "none" as React.CSSProperties["msOverflowStyle"],
          }}>
            {batches.map(b => (
              <button key={b} onClick={() => setBatch(b)} style={{
                padding: "5px 14px", borderRadius: 100, border: "none", whiteSpace: "nowrap", flexShrink: 0,
                background: batch === b ? "var(--admin-accent)" : "var(--admin-input-bg)",
                color: batch === b ? "#fff" : "var(--admin-text-muted)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s",
              }}>{b}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Student Name", "Enrollment", "Batch", "Punch In", "Punch Out", "Status"].map(h => (
                  <th key={h} style={{ padding: "11px 20px", textAlign: "left", color: "var(--admin-text-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, background: "var(--admin-input-bg)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: "center", color: "var(--admin-text-faint)", fontSize: 14 }}>Loading...</td></tr>
              ) : summaries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 48, textAlign: "center" }}>
                    <div style={{ color: "var(--admin-text-faint)", fontSize: 14 }}>No attendance records for today</div>
                    <div style={{ color: "var(--admin-text-faint)", fontSize: 12, marginTop: 4, opacity: 0.6 }}>Records appear here as students scan their QR codes</div>
                  </td>
                </tr>
              ) : summaries.map(s => {
                const status = s.punchIn && s.punchOut ? "Complete" : s.punchIn ? "In Progress" : "Absent";
                const statusMap: Record<string, { color: string; bg: string }> = {
                  Complete: { color: "#007D1E", bg: "rgba(0,125,30,0.1)" },
                  "In Progress": { color: "#9E6B00", bg: "rgba(158,107,0,0.1)" },
                  Absent: { color: "#C80A28", bg: "rgba(200,10,40,0.1)" },
                };
                const ss = statusMap[status];
                return (
                  <tr key={s.student.id} style={{ borderTop: "1px solid var(--admin-card-border)" }}>
                    <td style={{ padding: "13px 20px", fontWeight: 600, color: "var(--admin-text)" }}>{s.student.name}</td>
                    <td style={{ padding: "13px 20px", color: "var(--admin-text-muted)", fontFamily: "monospace", fontSize: 13 }}>{s.student.enrollmentNo}</td>
                    <td style={{ padding: "13px 20px" }}>
                      <span style={{
                        background: batchColor(s.student.batch, batches.slice(1)),
                        color: "#fff", borderRadius: 100, padding: "4px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: "inline-block",
                      }}>{s.student.batch || "—"}</span>
                    </td>
                    <td style={{ padding: "13px 20px", color: s.punchIn ? "#007D1E" : "var(--admin-text-faint)", fontWeight: s.punchIn ? 600 : 400 }}>{s.punchIn ?? "—"}</td>
                    <td style={{ padding: "13px 20px", color: s.punchOut ? "#0064E0" : "var(--admin-text-faint)", fontWeight: s.punchOut ? 600 : 400 }}>{s.punchOut ?? "—"}</td>
                    <td style={{ padding: "13px 20px" }}>
                      <span style={{ background: ss.bg, color: ss.color, borderRadius: 100, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{status}</span>
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
