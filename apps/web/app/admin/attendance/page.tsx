"use client";
import { useEffect, useState, useCallback, useRef } from "react";

type Student = { id: string; name: string; enrollmentNo: string; batch: string };
type AttendanceRecord = { id: string; studentId: string; date: string; type: "PUNCH_IN" | "PUNCH_OUT"; markedAt: string; student: Student };
type Summary = { student: Student; punchIn: string | null; punchOut: string | null; punchInMs: number | null; punchOutMs: number | null };

const CENTERS = ["All", "College Road", "Nashik Road"];

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

const chip = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: 100, border: "1px solid",
  borderColor: active ? "var(--admin-accent)" : "var(--admin-card-border)",
  background: active ? "var(--admin-accent)" : "var(--admin-input-bg)",
  color: active ? "#fff" : "var(--admin-text-muted)",
  fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
});

const BATCH_COLORS_MAP = ["#0064E0", "#6441D2", "#059669", "#D97706", "#0891B2", "#DC2626"];
function batchColorByIndex(name: string, list: string[]) {
  const i = list.indexOf(name);
  return BATCH_COLORS_MAP[i % BATCH_COLORS_MAP.length] ?? "#0064E0";
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState("All");
  const [batches, setBatches] = useState<string[]>([]);
  const [center, setCenter] = useState("All");
  const [search, setSearch] = useState("");
  const [showBatchFilter, setShowBatchFilter] = useState(false);
  const [alertState, setAlertState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [alertMsg, setAlertMsg] = useState("");
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [date, setDate] = useState(today);

  // Reload batches whenever center changes — keeps dropdown in sync
  useEffect(() => {
    const cp = center !== "All" ? `?center=${encodeURIComponent(center)}` : "";
    fetch(`/api/admin/batches${cp}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { name: string }[]) => setBatches(data.map(b => b.name)))
      .catch(() => {});
    setBatch("All");
  }, [center]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showBatchFilter) return;
    const close = () => setShowBatchFilter(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showBatchFilter]);

  const load = useCallback(async () => {
    try {
      const centerParam = center !== "All" ? center : "";
      const batchParam = batch !== "All" ? batch : "";

      let url: string;
      if (date === today) {
        const params = new URLSearchParams();
        if (batchParam) params.set("batch", batchParam);
        if (centerParam) params.set("center", centerParam);
        const qs = params.toString();
        url = batchParam
          ? `/api/admin/attendance/batch${qs ? `?${qs}` : ""}`
          : `/api/admin/attendance/today${qs ? `?${qs}` : ""}`;
      } else {
        const params = new URLSearchParams({ date });
        if (batchParam) params.set("batch", batchParam);
        if (centerParam) params.set("center", centerParam);
        url = `/api/admin/attendance/date?${params.toString()}`;
      }

      const stuUrl = centerParam ? `/api/admin/students?center=${encodeURIComponent(centerParam)}` : "/api/admin/students";
      const [recRes, stuRes] = await Promise.all([fetch(url), fetch(stuUrl)]);
      setRecords(recRes.ok ? await recRes.json() : []);
      setAllStudents(stuRes.ok ? await stuRes.json() : []);
    } catch {}
    setLoading(false);
  }, [batch, center, date, today]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  async function sendAbsentAlert() {
    if (alertState === "sending") return;
    setAlertState("sending");
    try {
      const params = center !== "All" ? `?center=${encodeURIComponent(center)}` : "";
      const res = await fetch(`/api/admin/notifications/absent-alert${params}`, { method: "POST" });
      const data = await res.json() as { sent?: number; skipped?: number; holiday?: number; message?: string };
      if (res.ok) {
        const parts = [`Sent to ${data.sent ?? 0} parents`, `${data.skipped ?? 0} already present`];
        if ((data.holiday ?? 0) > 0) parts.push(`${data.holiday} skipped (holiday batch)`);
        setAlertMsg(parts.join(" · "));
        setAlertState("done");
      } else {
        setAlertMsg(data.message ?? "Failed to send");
        setAlertState("error");
      }
    } catch {
      setAlertMsg("Network error");
      setAlertState("error");
    }
    if (alertTimer.current) clearTimeout(alertTimer.current);
    alertTimer.current = setTimeout(() => setAlertState("idle"), 6000);
  }

  // Auto-refresh: every 10s + instantly when tab regains focus (silent — no spinner)
  useEffect(() => {
    const id = setInterval(load, 10000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

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

  const allSummaries = Array.from(summaryMap.values());
  const summaries = search.trim()
    ? allSummaries.filter(s =>
        s.student.name.toLowerCase().includes(search.toLowerCase()) ||
        s.student.enrollmentNo.toLowerCase().includes(search.toLowerCase())
      )
    : allSummaries;

  const completeCount = allSummaries.filter(s => s.punchIn !== null && s.punchOut !== null).length;
  const partialCount  = allSummaries.filter(s => s.punchIn !== null && s.punchOut === null).length;
  const presentCount  = allSummaries.filter(s => s.punchIn !== null).length;
  const totalCount    = batchFiltered.length;
  const absentCount   = Math.max(0, totalCount - presentCount);

  const statCards = [
    { label: "Present",  value: presentCount,  color: "#059669", bg: "rgba(5,150,105,0.1)",   border: "rgba(5,150,105,0.2)" },
    { label: "Partial",  value: partialCount,  color: "#D97706", bg: "rgba(217,119,6,0.1)",    border: "rgba(217,119,6,0.2)" },
    { label: "Absent",   value: absentCount,   color: "#DC2626", bg: "rgba(220,38,38,0.1)",    border: "rgba(220,38,38,0.2)" },
    { label: "Total",    value: totalCount,    color: "#4F46E5", bg: "rgba(79,70,229,0.1)",    border: "rgba(79,70,229,0.2)" },
  ];

  const displayDate = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--admin-text)", margin: 0, letterSpacing: -0.3 }}>Attendance</h1>
          <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13, margin: "4px 0 0" }}>{displayDate}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input
            type="date" value={date} max={today}
            onChange={e => setDate(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid var(--admin-input-border)", borderRadius: 8, fontSize: 13, outline: "none", color: "var(--admin-text)", background: "var(--admin-input-bg)", cursor: "pointer" }}
          />
          {/* Only show alert button for today — no point notifying for past dates */}
          {date === today && (
            <button
              onClick={sendAbsentAlert}
              disabled={alertState === "sending"}
              title="Send push notification to parents of all absent students"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", border: "none", borderRadius: 100, background: alertState === "done" ? "#059669" : alertState === "error" ? "#DC2626" : "#D97706", color: "#fff", fontSize: 13, fontWeight: 600, cursor: alertState === "sending" ? "wait" : "pointer", opacity: alertState === "sending" ? 0.7 : 1, transition: "background 0.2s" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {alertState === "sending" ? "Sending…" : alertState === "done" ? "Sent!" : alertState === "error" ? "Failed" : `Notify Absent (${absentCount})`}
            </button>
          )}
          {(alertState === "done" || alertState === "error") && alertMsg && (
            <span style={{ fontSize: 12, color: alertState === "done" ? "#059669" : "#DC2626", fontWeight: 500 }}>{alertMsg}</span>
          )}
          <button
            onClick={() => exportCSV(summaries, date)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", border: "1px solid var(--admin-card-border)", borderRadius: 100, background: "var(--admin-card-bg)", color: "var(--admin-text)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "14px 22px", display: "flex", alignItems: "center", gap: 12, border: `1px solid ${s.border}` }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{loading ? "—" : s.value}</span>
            <span style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Center chips + Search */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {CENTERS.map(c => (
            <button key={c} onClick={() => setCenter(c)} style={chip(center === c)}>{c}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative", flexShrink: 0 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--admin-text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: "7px 12px 7px 32px", border: "1px solid var(--admin-input-border)", borderRadius: 100, fontSize: 13, outline: "none", color: "var(--admin-text)", background: "var(--admin-input-bg)", width: 180 }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", overflow: "hidden" }}>
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {(["Name", "Enrollment"] as const).map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "var(--admin-text-faint)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.7, background: "var(--admin-input-bg)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
                {/* Batch header with column-filter dropdown */}
                <th style={{ padding: "10px 12px", textAlign: "left", color: "var(--admin-text-faint)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.7, background: "var(--admin-input-bg)", whiteSpace: "nowrap", position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span>Batch</span>
                    <button
                      onClick={e => { e.stopPropagation(); setShowBatchFilter(p => !p); }}
                      title={batch !== "All" ? `Filtered: ${batch}` : "Filter by batch"}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 4, border: "none", cursor: "pointer", background: batch !== "All" ? "var(--admin-accent)" : "rgba(128,128,128,0.12)", color: batch !== "All" ? "#fff" : "var(--admin-text-faint)", flexShrink: 0 }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                    </button>
                  </div>
                  {showBatchFilter && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30, background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.15)", padding: 6, minWidth: 170, maxHeight: 280, overflowY: "auto" }}>
                      <button onClick={() => { setBatch("All"); setShowBatchFilter(false); }}
                        style={{ display: "flex", alignItems: "center", width: "100%", textAlign: "left", padding: "6px 10px", borderRadius: 7, border: "none", background: batch === "All" ? "var(--admin-accent)" : "transparent", color: batch === "All" ? "#fff" : "var(--admin-text)", fontSize: 12, fontWeight: batch === "All" ? 700 : 400, cursor: "pointer" }}>
                        All Batches
                      </button>
                      {batches.map(b => (
                        <button key={b} onClick={() => { setBatch(b); setShowBatchFilter(false); }}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "6px 10px", borderRadius: 7, border: "none", background: batch === b ? "var(--admin-accent)" : "transparent", color: batch === b ? "#fff" : "var(--admin-text)", fontSize: 12, fontWeight: batch === b ? 700 : 400, cursor: "pointer" }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: batch === b ? "#fff" : batchColorByIndex(b, batches), display: "inline-block", flexShrink: 0 }} />
                          {b}
                        </button>
                      ))}
                    </div>
                  )}
                </th>
                {(["Punch In", "Punch Out", "Duration", "Status"] as const).map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "var(--admin-text-faint)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.7, background: "var(--admin-input-bg)", whiteSpace: "nowrap" }}>{h}</th>
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
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--admin-text)", whiteSpace: "nowrap" }}>{s.student.name}</td>
                    <td style={{ padding: "10px 12px", color: "var(--admin-text-muted)", fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>{s.student.enrollmentNo}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ background: batchColorByIndex(s.student.batch, batches), color: "#fff", borderRadius: 7, padding: "3px 8px", fontSize: 10, fontWeight: 700, display: "inline-block", whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{s.student.batch || "—"}</span>
                    </td>
                    <td style={{ padding: "10px 12px", color: s.punchIn ? "#059669" : "var(--admin-text-faint)", fontWeight: s.punchIn ? 600 : 400, whiteSpace: "nowrap" }}>{s.punchIn ?? "—"}</td>
                    <td style={{ padding: "10px 12px", color: s.punchOut ? "#2563EB" : "var(--admin-text-faint)", fontWeight: s.punchOut ? 600 : 400, whiteSpace: "nowrap" }}>{s.punchOut ?? "—"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--admin-text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{dur}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ background: statusBg, color: statusColor, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{status}</span>
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
