"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import QRCode from "qrcode";

type Student = { id: string; name: string; enrollmentNo: string; batch: string; qrCode: string };

const BATCH_COLORS = ["#0064E0", "#6441D2", "#059669", "#D97706", "#0891B2", "#DC2626"];
function batchColor(batchName: string, allBatches: string[]) {
  const idx = allBatches.indexOf(batchName);
  return BATCH_COLORS[idx % BATCH_COLORS.length] ?? "#0064E0";
}

function QRCard({ student, allBatches }: { student: Student; allBatches: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const color = batchColor(student.batch, allBatches);

  useEffect(() => {
    const qrValue = student.qrCode || `${student.id}:${student.enrollmentNo}`;
    QRCode.toDataURL(qrValue, { width: 200, margin: 2, color: { dark: "#1E1B4B", light: "#ffffff" } })
      .then(url => setDataUrl(url));
  }, [student]);

  function downloadQR() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `QR_${student.enrollmentNo}_${student.name.replace(/\s+/g, "_")}.png`;
    a.click();
  }

  return (
    <div style={{
      background: "var(--admin-card-bg)", borderRadius: 16,
      border: "1px solid var(--admin-card-border)",
      overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      {/* Accent strip */}
      <div style={{ height: 3, background: `linear-gradient(90deg,${color},${color}55,transparent)` }} />
      {/* Card header */}
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--admin-card-border)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student.name}</div>
          <div style={{ fontSize: 11, color: "var(--admin-text-faint)", marginTop: 2, fontFamily: "monospace" }}>{student.enrollmentNo}</div>
        </div>
        <span style={{
          background: color, color: "#fff", borderRadius: 100,
          padding: "3px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
          display: "inline-block", whiteSpace: "nowrap",
        }}>
          {student.batch || "—"}
        </span>
      </div>

      {/* QR */}
      <div style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flex: 1 }}>
        {dataUrl ? (
          <img src={dataUrl} alt={`QR for ${student.name}`} style={{ width: 150, height: 150, borderRadius: 8 }} />
        ) : (
          <div style={{ width: 150, height: 150, background: "var(--admin-input-bg)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text-faint)", fontSize: 12 }}>
            Generating...
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div style={{ fontSize: 10, color: "var(--admin-text-faint)", textAlign: "center", fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.4 }}>
          {student.qrCode || `${student.id}:${student.enrollmentNo}`}
        </div>
        <button
          onClick={downloadQR}
          disabled={!dataUrl}
          style={{
            width: "100%", padding: "9px", border: "1px solid var(--admin-card-border)",
            borderRadius: 10,
            background: dataUrl ? `${color}10` : "var(--admin-input-bg)",
            color: dataUrl ? color : "var(--admin-text-faint)",
            fontSize: 13, fontWeight: 600, cursor: dataUrl ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download PNG
        </button>
      </div>
    </div>
  );
}

export default function QRCodesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState("All");
  const [batches, setBatches] = useState<string[]>(["All"]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/batches")
      .then(r => r.ok ? r.json() : [])
      .then((data: { name: string }[]) => setBatches(["All", ...data.map(b => b.name)]))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/students");
      setStudents(res.ok ? await res.json() : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = students
    .filter(s => batch === "All" || s.batch === batch)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.enrollmentNo.toLowerCase().includes(search.toLowerCase()));

  async function downloadAll() {
    for (const s of filtered) {
      const qrValue = s.qrCode || `${s.id}:${s.enrollmentNo}`;
      const url = await QRCode.toDataURL(qrValue, { width: 200, margin: 2, color: { dark: "#1E1B4B", light: "#ffffff" } });
      const a = document.createElement("a");
      a.href = url;
      a.download = `QR_${s.enrollmentNo}_${s.name.replace(/\s+/g, "_")}.png`;
      a.click();
      await new Promise(r => setTimeout(r, 200));
    }
  }

  function printAll() { window.print(); }

  return (
    <div className="admin-page">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>

      {/* Header */}
      <div className="no-print page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--admin-text)", margin: 0, letterSpacing: -0.3 }}>QR Codes</h1>
          <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13 }}>Download student QR codes for ID cards &amp; attendance</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={printAll} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", border: "1px solid var(--admin-card-border)", borderRadius: 100, background: "var(--admin-input-bg)", color: "var(--admin-text)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print All
          </button>
          <button
            onClick={downloadAll}
            disabled={filtered.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", border: "none", borderRadius: 100, background: filtered.length === 0 ? "var(--admin-input-bg)" : "#0064E0", color: filtered.length === 0 ? "var(--admin-text-faint)" : "#fff", fontSize: 13, fontWeight: 500, cursor: filtered.length === 0 ? "not-allowed" : "pointer" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download All ({filtered.length})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print" style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--admin-text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Search student..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "9px 12px 9px 36px", border: "1px solid var(--admin-card-border)", borderRadius: 8, fontSize: 13, boxSizing: "border-box", outline: "none", color: "var(--admin-text)", background: "var(--admin-input-bg)" }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {batches.map(b => (
            <button key={b} onClick={() => setBatch(b)} style={{
              padding: "6px 16px", borderRadius: 100, border: "none",
              background: batch === b ? "#0064E0" : "var(--admin-input-bg)",
              color: batch === b ? "#fff" : "var(--admin-text-muted)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
            }}>{b}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--admin-text-faint)" }}>
          {filtered.length} student{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--admin-text-faint)" }}>Loading students...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--admin-text-faint)" }}>No students found</div>
      ) : (
        <div className="qr-card-grid">
          {filtered.map(s => <QRCard key={s.id} student={s} allBatches={batches.slice(1)} />)}
        </div>
      )}
    </div>
  );
}
