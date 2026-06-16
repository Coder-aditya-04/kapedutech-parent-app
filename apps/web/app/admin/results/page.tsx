"use client";
import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Student = { id: string; name: string; enrollmentNo: string; batch: string };
type TestMeta = { testName: string; testDate: string; count: number };
type ParsedRow = { rank: number; name: string; enrollmentNo: string; scores: Record<string, number>; total: number; percentage: number };
type TestResultRow = {
  id: string; testName: string; testDate: string; rank: number | null;
  totalInBatch: number | null; scores: Record<string, number>; total: number;
  percentage: number; percentile: number | null;
  student: { name: string; enrollmentNo: string; batch: string };
};

function parsePdfPaste(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const strategies = [
    { fn: (l: string) => l.split("\t").map(v => v.trim()) },
    { fn: (l: string) => l.split(/\s{2,}/).map(v => v.trim()) },
    { fn: (l: string) => l.split(/\s{3,}/).map(v => v.trim()) },
    { fn: (l: string) => l.split(/\s{4,}/).map(v => v.trim()) },
  ];
  let bestFn = strategies[0].fn;
  let bestScore = 0;
  for (const s of strategies) {
    const counts = lines.map(l => s.fn(l).length);
    const headerCount = counts[0];
    if (headerCount <= 1) continue;
    const matching = counts.filter(c => c === headerCount).length;
    const score = (matching / counts.length) * headerCount;
    if (score > bestScore) { bestScore = score; bestFn = s.fn; }
  }
  const headers = bestFn(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const rows = lines.slice(1).map(line => {
    const vals = bestFn(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i]?.trim() ?? ""; });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
  return { headers, rows };
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.replace(/^"|"$/g, "").trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  });
  return { headers, rows };
}

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  border: "1px solid var(--admin-card-border)", borderRadius: 10,
  fontSize: 14, boxSizing: "border-box", outline: "none",
  color: "var(--admin-text)", background: "var(--admin-input-bg)",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600,
  color: "var(--admin-text-faint)", textTransform: "uppercase",
  letterSpacing: 0.5, marginBottom: 4,
};

const RANK_COLORS = ["#F59E0B", "#6366F1", "#059669"];
function scoreColor(pct: number) {
  if (pct >= 70) return "#059669";
  if (pct >= 50) return "#F59E0B";
  return "#EF4444";
}

function AnalyticsView({ test, onBack }: { test: TestMeta; onBack: () => void }) {
  const [results, setResults] = useState<TestResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const rRes = await fetch(`/api/admin/results/test/${encodeURIComponent(test.testName)}?date=${test.testDate}`);
      if (rRes.ok) setResults(await rRes.json());
      setLoading(false);
    }
    load();
  }, [test]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--admin-text-faint)" }}>Loading analytics...</div>;
  if (!results.length) return <div style={{ padding: 40, textAlign: "center", color: "var(--admin-text-faint)" }}>No results found.</div>;

  const topper = results[0];
  const avg = results.reduce((a, r) => a + r.percentage, 0) / results.length;
  const lowest = results[results.length - 1];
  const subjects = Object.keys(results[0]?.scores ?? {});
  const SUBJECT_COLORS = ["#6366F1", "#059669", "#F59E0B", "#EF4444"];
  const subjectAvgs = subjects.map((s, i) => ({
    subject: s,
    avg: Math.round(results.reduce((a, r) => a + (r.scores[s] ?? 0), 0) / results.length),
    fill: SUBJECT_COLORS[i % 4],
  }));

  const buckets = ["0-40", "40-50", "50-60", "60-70", "70-80", "80+"];
  const distData = buckets.map(b => {
    const [lo, hi] = b === "80+" ? [80, 101] : b.split("-").map(Number);
    return { range: b, count: results.filter(r => r.percentage >= lo && r.percentage < hi).length };
  });

  const statCards = [
    { label: "Topper", value: topper.student.name.split(" ")[0], sub: `${topper.percentage.toFixed(1)}%`, color: "#F59E0B" },
    { label: "Class Average", value: `${avg.toFixed(1)}%`, sub: `${Math.round(avg / 100 * (topper.totalInBatch ?? 1) * 16)} avg marks`, color: "#6366F1" },
    { label: "Lowest Score", value: lowest.student.name.split(" ")[0], sub: `${lowest.percentage.toFixed(1)}%`, color: "#EF4444" },
    { label: "Total Students", value: String(results.length), sub: `${results.filter(r => r.percentage >= 60).length} above 60%`, color: "#059669" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ border: "1px solid var(--admin-card-border)", background: "var(--admin-input-bg)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "var(--admin-text)", fontWeight: 600 }}>← Back</button>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--admin-text)" }}>{test.testName}</h2>
          <p style={{ margin: 0, fontSize: 12, color: "var(--admin-text-faint)" }}>
            {new Date(test.testDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {results.length} students
          </p>
        </div>
      </div>

      {/* Summary stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {statCards.map((c, i) => (
          <div key={i} style={{ background: `${c.color}14`, borderRadius: 14, padding: "16px 18px", border: `1px solid ${c.color}28` }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{c.label}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--admin-text)" }}>{c.value}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--admin-text-muted)" }}>{c.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Score distribution */}
        <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: 20 }}>
          <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Score Distribution (%)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: "var(--admin-text-faint)" as string }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--admin-text-faint)" as string }} />
              <Tooltip
                contentStyle={{ background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, color: "var(--admin-text)" }}
                cursor={{ fill: "rgba(128,128,128,0.08)" }}
              />
              <Bar dataKey="count" name="Students" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Subject averages */}
        <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: 20 }}>
          <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Subject Averages</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={subjectAvgs} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
              <XAxis dataKey="subject" tick={{ fontSize: 11, fill: "var(--admin-text-faint)" as string }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--admin-text-faint)" as string }} />
              <Tooltip
                contentStyle={{ background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, color: "var(--admin-text)" }}
                cursor={{ fill: "rgba(128,128,128,0.08)" }}
              />
              <Bar dataKey="avg" name="Avg Marks" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: 20, marginBottom: 20 }}>
        <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Full Leaderboard</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--admin-input-bg)" }}>
                {["Rank", "Name", "Batch", "Roll No", ...subjects, "Total", "%", "Percentile"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--admin-text-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--admin-card-border)", background: i < 3 ? `${RANK_COLORS[i]}08` : undefined }}>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontWeight: 800, color: i < 3 ? RANK_COLORS[i] : "var(--admin-text-muted)", fontSize: i < 3 ? 15 : 13 }}>
                      {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${r.rank}`}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--admin-text)", whiteSpace: "nowrap" }}>{r.student.name}</td>
                  <td style={{ padding: "10px 12px", color: "var(--admin-text-muted)", fontSize: 12 }}>{r.student.batch}</td>
                  <td style={{ padding: "10px 12px", color: "var(--admin-text-muted)", fontFamily: "monospace", fontSize: 12 }}>{r.student.enrollmentNo}</td>
                  {subjects.map(s => (
                    <td key={s} style={{ padding: "10px 12px", textAlign: "center", color: "var(--admin-text)" }}>{r.scores[s] ?? "-"}</td>
                  ))}
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--admin-text)" }}>{r.total}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ background: `${scoreColor(r.percentage)}18`, color: scoreColor(r.percentage), borderRadius: 6, padding: "2px 8px", fontWeight: 700, fontSize: 12 }}>
                      {r.percentage.toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--admin-text-faint)", fontSize: 12 }}>{r.percentile !== null ? `${r.percentile}th` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Below 40% warning */}
      {results.filter(r => r.percentage < 40).length > 0 && (
        <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#EF4444" }}>⚠️ Students Below 40% — Need Attention</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {results.filter(r => r.percentage < 40).map(r => (
              <span key={r.id} style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, padding: "4px 12px", fontSize: 12, color: "#EF4444" }}>
                {r.student.name} — {r.percentage.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CENTERS = ["All", "College Road", "Nashik Road"];

function ResultsPageInner() {
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [tests, setTests] = useState<TestMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<"paste" | "csv">("paste");
  const [selectedTest, setSelectedTest] = useState<TestMeta | null>(null);
  const [center, setCenter] = useState("All");

  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<{
    nameCol: string; rankCol: string; enrollmentCol: string; totalCol: string;
    subjects: { label: string; col: string; max: number }[];
  }>({ nameCol: "", rankCol: "", enrollmentCol: "", totalCol: "", subjects: [] });
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [preview, setPreview] = useState<{ studentId: string; name: string; rank: number; total: number; percentage: number; scores: Record<string, number> }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TestMeta | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const cp = center !== "All" ? `?center=${encodeURIComponent(center)}` : "";
    const [sRes, tRes] = await Promise.all([
      fetch(`/api/admin/students${cp}`),
      fetch(`/api/admin/results/tests${cp}`),
    ]);
    if (sRes.ok) setStudents(await sRes.json());
    if (tRes.ok) setTests(await tRes.json());
    setLoading(false);
  }, [center]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh: every 30s + instantly when tab regains focus (silent — no spinner)
  useEffect(() => {
    const id = setInterval(load, 30000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  useEffect(() => {
    const qTest = searchParams.get("test");
    const qDate = searchParams.get("date");
    if (!qTest || !qDate || tests.length === 0) return;
    const found = tests.find(t => t.testName === qTest && t.testDate === qDate);
    if (found) setSelectedTest(found);
  }, [searchParams, tests]);

  function showToast(msg: string, ok: boolean) { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); }

  function autoDetect(hdrs: string[]) {
    const find = (keys: string[]) => hdrs.find(h => keys.some(k => h.includes(k))) ?? "";
    const subjects: { label: string; col: string; max: number }[] = [];
    const subjectKeywords = ["physics", "chemistry", "botany", "zoology", "biology", "maths", "math", "english"];
    hdrs.forEach(h => {
      const match = subjectKeywords.find(k => h.includes(k));
      if (match) subjects.push({ label: match.charAt(0).toUpperCase() + match.slice(1), col: h, max: 100 });
    });
    setMappings({ nameCol: find(["name"]), rankCol: find(["rank"]), enrollmentCol: find(["roll", "enrollment", "rollno"]), totalCol: find(["total"]), subjects });
  }

  function handleParsePaste() {
    if (!pasteText.trim()) { showToast("Paste the table data first", false); return; }
    const { headers: hdrs, rows: r } = parsePdfPaste(pasteText);
    if (!hdrs.length) { showToast("Could not parse. Try copying the table again.", false); return; }
    setHeaders(hdrs); setRows(r); autoDetect(hdrs);
    showToast(`Parsed ${r.length} rows. Now map the columns below.`, true);
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const { headers: hdrs, rows: r } = parseCSV(ev.target?.result as string);
      if (!r.length) { showToast("CSV empty or invalid", false); return; }
      setHeaders(hdrs); setRows(r); autoDetect(hdrs);
      showToast(`Parsed ${r.length} rows. Map the columns below.`, true);
    };
    reader.readAsText(file);
  }

  function buildPreview() {
    if (!mappings.nameCol || !mappings.rankCol || !mappings.totalCol) { showToast("Map Name, Rank, and Total columns first", false); return; }
    const parsedRows: ParsedRow[] = rows.map(row => {
      const scores: Record<string, number> = {};
      for (const sub of mappings.subjects) {
        if (sub.label && sub.col) scores[sub.label] = parseFloat(row[sub.col] ?? "0") || 0;
      }
      const total = parseFloat(row[mappings.totalCol] ?? "0") || 0;
      const maxMarks = mappings.subjects.length > 0
        ? mappings.subjects.reduce((s, sub) => s + (sub.max || 100), 0)
        : 300;
      const percentage = parseFloat(((total / maxMarks) * 100).toFixed(2));
      return { rank: parseInt(row[mappings.rankCol] ?? "0") || 0, name: row[mappings.nameCol] ?? "", enrollmentNo: mappings.enrollmentCol ? (row[mappings.enrollmentCol] ?? "") : "", scores, total, percentage };
    }).filter(r => r.name && r.rank > 0);
    setParsed(parsedRows);
    const matched = parsedRows.map(r => {
      const student = students.find(s => s.name.toLowerCase().trim() === r.name.toLowerCase().trim() || (r.enrollmentNo && s.enrollmentNo === r.enrollmentNo));
      return student ? { studentId: student.id, name: r.name, rank: r.rank, total: r.total, percentage: r.percentage, scores: r.scores } : null;
    }).filter(Boolean) as typeof preview;
    setPreview(matched);
    if (matched.length === 0) showToast(`0 matched. Names must match or roll numbers must match.`, false);
    else showToast(`${matched.length} of ${parsedRows.length} students matched.`, matched.length > 0);
  }

  async function handleDeleteTest() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/results/test/${encodeURIComponent(deleteTarget.testName)}?date=${deleteTarget.testDate}`, { method: "DELETE" });
      const d = await res.json();
      if (res.ok) { showToast(d.message, true); setDeleteTarget(null); load(); }
      else showToast(d.message ?? "Delete failed", false);
    } catch { showToast("Network error", false); }
    setDeleting(false);
  }

  async function handleUpload() {
    if (!testName.trim() || !preview.length) { showToast("Fill test name and preview first", false); return; }
    setUploading(true);
    try {
      const res = await fetch("/api/admin/results", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testName: testName.trim(), testDate,
          subjectMaxes: mappings.subjects.reduce<Record<string, number>>((m, s) => { if (s.label) m[s.label] = s.max || 100; return m; }, {}),
          results: preview.map(r => ({ studentId: r.studentId, rank: r.rank, totalInBatch: parsed.length, scores: r.scores, total: r.total, percentage: r.percentage })),
        }),
      });
      const d = await res.json();
      if (res.ok) { showToast(d.message, true); setTestName(""); setPasteText(""); setRows([]); setHeaders([]); setPreview([]); setParsed([]); load(); }
      else showToast(d.message ?? "Upload failed", false);
    } catch { showToast("Network error", false); }
    setUploading(false);
  }

  const toastEl = toast && (
    <div style={{
      position: "fixed", top: 24, right: 24, zIndex: 200,
      background: "var(--admin-card-bg)",
      border: `1px solid ${toast.ok ? "rgba(5,150,105,0.3)" : "rgba(220,38,38,0.3)"}`,
      color: toast.ok ? "#059669" : "#EF4444",
      padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14,
      boxShadow: "0 8px 28px rgba(0,0,0,0.2)",
    }}>
      {toast.ok ? "✓" : "✕"} {toast.msg}
    </div>
  );

  if (selectedTest) return (
    <div className="admin-page">
      {toastEl}
      <AnalyticsView test={selectedTest} onBack={() => setSelectedTest(null)} />
    </div>
  );

  const deleteModal = deleteTarget && (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: "blur(3px)" }}>
      <div style={{ background: "var(--admin-card-bg)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, margin: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--admin-text)" }}>Delete Test</h2>
          <button onClick={() => setDeleteTarget(null)} style={{ border: "none", background: "var(--admin-input-bg)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "var(--admin-text-muted)" }}>✕</button>
        </div>
        <p style={{ color: "var(--admin-text-muted)", fontSize: 14, margin: "0 0 6px", lineHeight: 1.6 }}>
          Delete <strong style={{ color: "var(--admin-text)" }}>{deleteTarget.testName}</strong>?
        </p>
        <p style={{ color: "var(--admin-text-faint)", fontSize: 12, margin: "0 0 22px" }}>
          This will permanently remove all {deleteTarget.count} student results for {deleteTarget.testDate}. Parents will no longer see this test.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: "10px", border: "1.5px solid var(--admin-card-border)", borderRadius: 10, background: "var(--admin-card-bg)", color: "var(--admin-text)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleDeleteTest} disabled={deleting} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: deleting ? "#FCA5A5" : "#DC2626", color: "#fff", fontSize: 14, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer" }}>
            {deleting ? "Deleting..." : "Delete Test"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-page">
      {toastEl}
      {deleteModal}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>Results</h1>
        <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 14 }}>Upload test results — click any uploaded test to view analytics</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        {/* Upload panel */}
        <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 20px" }}>Upload New Result</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Test Name</label>
              <input value={testName} onChange={e => setTestName(e.target.value)} placeholder="e.g. Minor Test 6" style={inp} />
            </div>
            <div>
              <label style={labelStyle}>Test Date</label>
              <input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} style={inp} />
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 0, marginBottom: 16, border: "1px solid var(--admin-card-border)", borderRadius: 10, overflow: "hidden" }}>
            {(["paste", "csv"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "9px", border: "none",
                background: tab === t ? "var(--admin-accent)" : "transparent",
                color: tab === t ? "#fff" : "var(--admin-text-muted)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                {t === "paste" ? "Paste from PDF" : "Upload CSV"}
              </button>
            ))}
          </div>

          {tab === "paste" ? (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Paste result table from PDF</label>
              <p style={{ fontSize: 12, color: "var(--admin-text-faint)", margin: "0 0 8px" }}>Open your PDF → select the whole table → Ctrl+C → paste below</p>
              <textarea
                value={pasteText} onChange={e => setPasteText(e.target.value)}
                placeholder={"Rank\tRoll No\tName\tPhysics\tChemistry\tTotal\n1\t808716513\tPRANAY JAGTAP\t86\t116\t512..."}
                rows={6}
                style={{ ...inp, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
              />
              <button onClick={handleParsePaste} style={{ marginTop: 8, padding: "9px 20px", background: "var(--admin-input-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--admin-text)", cursor: "pointer" }}>
                Parse Table
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Upload CSV file</label>
              <input type="file" accept=".csv" onChange={handleCSVFile} style={{ ...inp }} />
            </div>
          )}

          {headers.length > 0 && (
            <div style={{ background: "var(--admin-input-bg)", borderRadius: 12, padding: 16, marginBottom: 16, border: "1px solid var(--admin-card-border)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 12px" }}>
                Map Columns <span style={{ color: "var(--admin-text-faint)", fontWeight: 400 }}>({rows.length} rows)</span>
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([
                  { label: "Student Name column *", key: "nameCol" },
                  { label: "Rank column *", key: "rankCol" },
                  { label: "Roll No / Enrollment column", key: "enrollmentCol" },
                  { label: "Total Marks column *", key: "totalCol" },
                ] as { label: string; key: keyof typeof mappings }[]).map(f => (
                  <div key={f.key}>
                    <label style={labelStyle}>{f.label}</label>
                    <select value={mappings[f.key] as string} onChange={e => setMappings(m => ({ ...m, [f.key]: e.target.value }))} style={{ ...inp, fontSize: 13 }}>
                      <option value="">— select —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>Subjects</p>
                  <button onClick={() => setMappings(m => ({ ...m, subjects: [...m.subjects, { label: "", col: "", max: 100 }] }))} style={{ fontSize: 12, color: "var(--admin-accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Add</button>
                </div>
                {mappings.subjects.map((sub, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 72px 24px", gap: 6, marginBottom: 6 }}>
                    <input placeholder="Label (e.g. Physics)" value={sub.label} onChange={e => setMappings(m => { const s = [...m.subjects]; s[i] = { ...s[i], label: e.target.value }; return { ...m, subjects: s }; })} style={{ ...inp, fontSize: 13 }} />
                    <select value={sub.col} onChange={e => setMappings(m => { const s = [...m.subjects]; s[i] = { ...s[i], col: e.target.value }; return { ...m, subjects: s }; })} style={{ ...inp, fontSize: 13 }}>
                      <option value="">— column —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <input type="number" placeholder="Max" min={1} value={sub.max || ""} onChange={e => setMappings(m => { const s = [...m.subjects]; s[i] = { ...s[i], max: parseInt(e.target.value) || 100 }; return { ...m, subjects: s }; })} style={{ ...inp, fontSize: 13 }} title="Max marks for this subject" />
                    <button onClick={() => setMappings(m => ({ ...m, subjects: m.subjects.filter((_, j) => j !== i) }))} style={{ border: "none", background: "rgba(220,38,38,0.15)", color: "#EF4444", borderRadius: 6, cursor: "pointer" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {headers.length > 0 && (
            <button onClick={buildPreview} style={{ width: "100%", padding: "10px", border: "1px solid var(--admin-accent)", borderRadius: 10, background: "rgba(59,130,246,0.08)", color: "var(--admin-accent)", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
              Match Students &amp; Preview
            </button>
          )}

          {preview.length > 0 && (
            <>
              <div style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.25)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                <p style={{ margin: "0 0 6px", fontSize: 13, color: "#059669", fontWeight: 600 }}>✓ {preview.length} students matched ({parsed.length - preview.length} unmatched)</p>
                <div style={{ maxHeight: 120, overflowY: "auto" }}>
                  {preview.slice(0, 8).map((r, i) => <p key={i} style={{ margin: "2px 0", fontSize: 12, color: "var(--admin-text-muted)" }}>#{r.rank} {r.name} — {r.total} marks</p>)}
                  {preview.length > 8 && <p style={{ fontSize: 12, color: "var(--admin-text-faint)", margin: "4px 0 0" }}>...and {preview.length - 8} more</p>}
                </div>
              </div>
              <button onClick={handleUpload} disabled={uploading} style={{ width: "100%", padding: "12px", border: "none", borderRadius: 10, background: uploading ? "var(--admin-text-faint)" : "var(--admin-accent)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: uploading ? "not-allowed" : "pointer" }}>
                {uploading ? "Uploading..." : `Upload Results for ${preview.length} Students`}
              </button>
            </>
          )}
        </div>

        {/* Tests list */}
        <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 12px" }}>Uploaded Tests</h2>
          <div style={{ display: "flex", gap: 5, marginBottom: 16, flexWrap: "wrap" }}>
            {CENTERS.map(c => (
              <button key={c} onClick={() => setCenter(c)} style={{
                padding: "4px 12px", borderRadius: 100, border: "1px solid",
                borderColor: center === c ? "var(--admin-accent)" : "var(--admin-card-border)",
                background: center === c ? "var(--admin-accent)" : "var(--admin-input-bg)",
                color: center === c ? "#fff" : "var(--admin-text-muted)",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>{c}</button>
            ))}
          </div>
          {loading ? (
            <p style={{ color: "var(--admin-text-faint)", fontSize: 14 }}>Loading...</p>
          ) : tests.length === 0 ? (
            <p style={{ color: "var(--admin-text-faint)", fontSize: 14 }}>No tests uploaded yet</p>
          ) : tests.map((t, i) => (
            <div key={i} style={{ padding: "12px 0", borderBottom: i < tests.length - 1 ? "1px solid var(--admin-card-border)" : "none" }}>
              <p style={{ margin: "0 0 2px", fontWeight: 600, color: "var(--admin-text)", fontSize: 14 }}>{t.testName}</p>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--admin-text-faint)" }}>{t.testDate} · {t.count} students</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setSelectedTest(t)}
                  style={{ padding: "5px 14px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8, color: "#6366F1", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  📊 View Analytics
                </button>
                <button
                  onClick={() => setDeleteTarget(t)}
                  style={{ padding: "5px 10px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsPageInner />
    </Suspense>
  );
}
