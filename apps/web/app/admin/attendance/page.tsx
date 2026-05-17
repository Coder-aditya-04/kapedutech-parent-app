"use client";
import { useEffect, useState, useCallback } from "react";

type Student = { id: string; name: string; enrollmentNo: string; batch: string };
type AttendanceRecord = { id: string; studentId: string; date: string; type: "PUNCH_IN" | "PUNCH_OUT"; markedAt: string; student: Student };
type Summary = { student: Student; punchIn: string | null; punchOut: string | null; punchInMs: number | null; punchOutMs: number | null };

const BATCH_COLORS = ["#0064E0", "#6441D2", "#059669", "#D97706", "#0891B2", "#DC2626"];
function batchColor(batchName: string, allBatches: string[]) {
  const idx = allBatches.indexOf(batchName);
  return BATCH_COLORS[idx % BATCH_COLORS.length] ?? "#0064E0";
}

function duration(inMs: number, outMs: number) {
  const diff = Math.floor((outMs - inMs) / 60000);
  const h = Math.floor(diff / 60), m = diff % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function exportCSV(summaries: Summary[], date: string) {
  const rows = [
    ["Name", "Enrollment", "Batch", "Punch In", "Punch Out", "Duration", "Status"],
    ...summaries.map(s => {
      const status = s.punchIn && s.punchOut ? "Complete" : s.punchIn ? "Partial" : "Absent";
      const dur = s.punchInMs && s.punchOutMs ? duration(s.punchInMs, s.punchOutMs) : "";
      return [s.student.name, s.student.enrollmentNo, s.student.batch || "", s.punchIn || "", s.punchOut || "", dur, status];
    }),
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `attendance_${date}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState("All");
  const [batches, setBatches] = useState<string[]>(["All"]);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  useEffect(() => {
    fetch("/api/admin/batches")
      .then(r => r.ok ? r.json() : [])
      .then((data: { name: string }[]) => setBatches(["All", ...data.map(b => b.name)]))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const url = date === today
        ? (batch === "All" ? "/api/admin/attendance/today" : `/api/admin/attendance/batch?batch=${batch}`)
        : `/api/admin/attendance/date?date=${date}${batch !== "All" ? `&batch=${batch}` : ""}`;
      const [recRes, stuRes] = await Promise.all([fetch(url), fetch("/api/admin/students")]);
      setRecords(recRes.ok ? await recRes.json() : []);
      setAllStudents(stuRes.ok ? await stuRes.json() : []);
    } catch {}
    setLoading(false);
  }, [batch, date, today]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const summaryMap = new Map<string, Summary>();
  records.forEach(r => {
    if (!summaryMap.has(r.studentId)) summaryMap.set(r.studentId, { student: r.student, punchIn: null, punchOut: null, punchInMs: null, punchOutMs: null });
    const s = summaryMap.get(r.studentId)!;
    const ms = new Date(r.markedAt).getTime();
    const time = new Date(r.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    if (r.type === "PUNCH_IN") { s.punchIn = time; s.punchInMs = ms; }
    if (r.type === "PUNCH_OUT") { s.punchOut = time; s.punchOutMs = ms; }
  });

  const batchFiltered = batch === "All" ? allStudents : allStudents.filter(s => s.batch === batch);
  batchFiltered.forEach(s => {
    if (!summaryMap.has(s.id)) {
      summaryMap.set(s.id, { student: s, punchIn: null, punchOut: null, punchInMs: null, punchOutMs: null });
    }
  });

  const summaries = Array.from(summaryMap.values());
  const presentCount = summaries.filter(s => s.punchIn !== null).length;
  const totalCount = batchFiltered.length;
  const absentCount = Math.max(0, totalCount - presentCount);

  const statCards = [
    { label: "Present", value: presentCount, color: "#059669", bg: "rgba(5,150,105,0.1)", border: "rgba(5,150,105,0.2)" },
    { label: "Absent",  value: absentCount,  color: "#DC2626", bg: "rgba(220,38,38,0.1)",  border: "rgba(220,38,38,0.2)" },
    { label: "Total",   value: totalCount,   color: "#4F46E5", bg: "rgba(79,70,229,0.1)",  border: "rgba(79,70,229,0.2)" },
  ];

  const displayDate = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--admin-text)", margin: 0, letterSpacing: -0.3 }}>Attendance</h1>
          <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13, margin: "4px 0 0" }}>{displayDate}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="date" value={date} max={today}
            onChange={e => setDate(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--admin-input-border)", borderRadius: 8, fontSize: 13, outline: "none", color: "var(--admin-text)", background: "var(--admin-input-bg)", cursor: "pointer" }}
          />
          <button
            onClick={() => exportCSV(summaries, date)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", border: "1px solid var(--admin-card-border)", borderRadius: 100, background: "var(--admin-card-bg)", color: "var(--admin-text)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats + Batch filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "14px 22px", display: "flex", alignItems: "center", gap: 12, border: `1px solid ${s.border}` }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{loading ? "—" : s.value}</span>
            <span style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
        {/* Scrollable batch tabs */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {batches.map(b => (
            <button key={b} onClick={() => setBatch(b)} style={{
              padding: "6px 14px", borderRadius: 100, border: "none", whiteSpace: "nowrap", flexShrink: 0,
              background: batch === b ? "var(--admin-accent)" : "var(--admin-input-bg)",
              color: batch === b ? "#fff" : "var(--admin-text-muted)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            }}>{b}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", overflow: "hidden" }}>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Name", "Enrollment", "Batch", "Punch In", "Punch Out", "Duration", "Status"].map(h => (
                  <th key={h} style={{ padding: "11px 18px", textAlign: "left", color: "var(--admin-text-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7, background: "var(--admin-input-bg)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--admin-text-faint)" }}>Loading...</td></tr>
              ) : summaries.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--admin-text-faint)" }}>No records found</td></tr>
              ) : summaries.map(s => {
                const status = s.punchIn && s.punchOut ? "Complete" : s.punchIn ? "Partial" : "Absent";
                const dur = s.punchInMs && s.punchOutMs ? duration(s.punchInMs, s.punchOutMs) : "—";
                const statusColor = status === "Complete" ? "#059669" : status === "Partial" ? "#D97706" : "#DC2626";
                const statusBg   = status === "Complete" ? "rgba(5,150,105,0.1)" : status === "Partial" ? "rgba(217,119,6,0.1)" : "rgba(220,38,38,0.1)";
                return (
                  <tr key={s.student.id} style={{ borderTop: "1px solid var(--admin-card-border)" }}>
                    <td style={{ padding: "13px 18px", fontWeight: 600, color: "var(--admin-text)" }}>{s.student.name}</td>
                    <td style={{ padding: "13px 18px", color: "var(--admin-text-muted)", fontFamily: "monospace", fontSize: 13 }}>{s.student.enrollmentNo}</td>
                    <td style={{ padding: "13px 18px" }}>
                      <span style={{ background: batchColor(s.student.batch, batches.slice(1)), color: "#fff", borderRadius: 100, padding: "4px 12px", fontSize: 11, fontWeight: 700, display: "inline-block" }}>{s.student.batch || "—"}</span>
                    </td>
                    <td style={{ padding: "13px 18px", color: s.punchIn ? "#059669" : "var(--admin-text-faint)", fontWeight: s.punchIn ? 600 : 400 }}>{s.punchIn ?? "—"}</td>
                    <td style={{ padding: "13px 18px", color: s.punchOut ? "#2563EB" : "var(--admin-text-faint)", fontWeight: s.punchOut ? 600 : 400 }}>{s.punchOut ?? "—"}</td>
                    <td style={{ padding: "13px 18px", color: "var(--admin-text-muted)", fontWeight: 500 }}>{dur}</td>
                    <td style={{ padding: "13px 18px" }}>
                      <span style={{ background: statusBg, color: statusColor, borderRadius: 20, padding: "4px 11px", fontSize: 12, fontWeight: 700 }}>{status}</span>
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
