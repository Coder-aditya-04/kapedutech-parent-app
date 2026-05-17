"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Batch = { id: string; name: string; createdAt: string };
type Analytics = Batch & { totalStudents: number; avgAttendancePct: number; totalWorkingDays?: number };
type StudentDetail = {
  id: string; name: string; enrollmentNo: string;
  attendancePct: number; presentDays: number; totalWorkingDays: number;
  lastSeen: string | null;
  results: { testName: string; testDate: string; total: number; percentage: number; rank: number; totalInBatch: number }[];
};
type BatchDetail = { batchName: string; totalStudents: number; totalWorkingDays: number; students: StudentDetail[] };

const PALETTE = ["#1D6BF3","#7C3AED","#0D9488","#B45309","#0891B2","#BE185D","#16A34A","#DC2626"];
function attColor(p: number) { return p >= 75 ? "#16A34A" : p >= 50 ? "#D97706" : "#DC2626"; }

function downloadAllPTM(details: BatchDetail[]) {
  // Collect all unique tests across all batches, sorted by date
  const seen = new Set<string>();
  const allTests: { key: string; label: string }[] = [];
  for (const d of details) {
    for (const s of d.students) {
      for (const r of s.results) {
        const key = `${r.testDate}||${r.testName}`;
        if (!seen.has(key)) { seen.add(key); allTests.push({ key, label: `${r.testName} (${r.testDate})` }); }
      }
    }
  }
  allTests.sort((a, b) => a.key.localeCompare(b.key));

  const headers = ["Batch", "Name", "Enrollment No", "Attendance %", ...allTests.map(t => t.label), "Avg Test %"];
  const rows: (string | number)[][] = [];

  for (const d of details) {
    for (const s of d.students) {
      const testMap: Record<string, number | string> = {};
      for (const r of s.results) testMap[`${r.testDate}||${r.testName}`] = r.total;
      const avgPct = s.results.length > 0
        ? Math.round(s.results.reduce((a, r) => a + r.percentage, 0) / s.results.length)
        : "";
      rows.push([
        d.batchName,
        s.name,
        s.enrollmentNo,
        `${s.attendancePct}%`,
        ...allTests.map(t => testMap[t.key] ?? ""),
        avgPct !== "" ? `${avgPct}%` : "—",
      ]);
    }
    // Blank separator row between batches
    if (details.indexOf(d) < details.length - 1) rows.push([]);
  }

  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PTM-All-Batches-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SpotlightCard({ children, accent }: { children: React.ReactNode; accent: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseMove={e => {
        if (!ref.current || !glow.current) return;
        const r = ref.current.getBoundingClientRect();
        glow.current.style.opacity = "1";
        glow.current.style.background = `radial-gradient(260px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px, ${accent}18, transparent 60%)`;
      }}
      onMouseLeave={() => { if (glow.current) glow.current.style.opacity = "0"; }}
      style={{ position: "relative", overflow: "hidden", background: "var(--admin-card-bg)", borderRadius: 20, border: "1px solid var(--admin-card-border)" }}
    >
      <div ref={glow} style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", opacity: 0, transition: "opacity 0.3s", zIndex: 0 }} />
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

const sp = { type: "spring" as const, stiffness: 110, damping: 22 };

export default function BatchesPage() {
  const [batches, setBatches] = useState<Analytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [batchDetails, setBatchDetails] = useState<Record<string, BatchDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<Record<string, boolean>>({});
  const [downloadingPTM, setDownloadingPTM] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/batches/analytics");
      setBatches(res.ok ? await res.json() : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }

  async function fetchDetail(batchName: string): Promise<BatchDetail | null> {
    if (batchDetails[batchName]) return batchDetails[batchName];
    try {
      const res = await fetch(`/api/admin/batches/${encodeURIComponent(batchName)}`);
      if (!res.ok) return null;
      const data: BatchDetail = await res.json();
      setBatchDetails(p => ({ ...p, [batchName]: data }));
      return data;
    } catch { return null; }
  }

  async function toggleExpand(batchName: string) {
    const next = !expanded[batchName];
    setExpanded(p => ({ ...p, [batchName]: next }));
    if (next && !batchDetails[batchName]) {
      setLoadingDetail(p => ({ ...p, [batchName]: true }));
      await fetchDetail(batchName);
      setLoadingDetail(p => ({ ...p, [batchName]: false }));
    }
  }

  async function handleDownloadAllPTM() {
    setDownloadingPTM(p => ({ ...p, __all__: true }));
    try {
      const details = await Promise.all(
        batches.map(b => fetchDetail(b.name))
      );
      const valid = details.filter((d): d is BatchDetail => d !== null);
      if (valid.length > 0) downloadAllPTM(valid);
      else showToast("No data to download", false);
    } catch { showToast("Failed to load batch data", false); }
    setDownloadingPTM(p => ({ ...p, __all__: false }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/batches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const d = await res.json();
      if (res.ok) { showToast(`"${newName.trim()}" created`, true); setNewName(""); load(); }
      else showToast(d.message ?? "Failed", false);
    } catch { showToast("Network error", false); }
    setCreating(false);
  }

  async function handleDelete(e: React.MouseEvent, batch: Analytics) {
    e.stopPropagation();
    if (!confirm(`Delete batch "${batch.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/batches/${batch.id}`, { method: "DELETE" });
    const d = await res.json();
    if (res.ok) { showToast("Batch deleted", true); load(); }
    else showToast(d.message ?? "Failed", false);
  }

  return (
    <div className="admin-page">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={sp}
            style={{
              position: "fixed", top: 22, right: 22, zIndex: 200,
              background: "var(--admin-card-bg)",
              border: `1px solid ${toast.ok ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)"}`,
              color: toast.ok ? "#16A34A" : "#DC2626",
              padding: "11px 18px", borderRadius: 14, fontWeight: 600, fontSize: 13,
              boxShadow: "0 8px 28px rgba(0,0,0,0.15)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {toast.ok ? "✓" : "✕"} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--admin-text)", margin: 0, letterSpacing: "-0.5px" }}>Batches</h1>
          <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 13, margin: "4px 0 0" }}>
            {batches.length} batch{batches.length !== 1 ? "es" : ""} · Click any card to view students
          </p>
        </div>
        <button
          onClick={handleDownloadAllPTM}
          disabled={!!downloadingPTM["__all__"] || batches.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 18px", border: "1px solid #1D6BF330", borderRadius: 10,
            background: "#1D6BF310", color: "#1D6BF3", fontSize: 13, fontWeight: 700,
            cursor: downloadingPTM["__all__"] || batches.length === 0 ? "not-allowed" : "pointer",
            opacity: downloadingPTM["__all__"] ? 0.6 : 1, whiteSpace: "nowrap",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {downloadingPTM["__all__"] ? "Preparing…" : "Download PTM Report"}
        </button>
      </div>

      {/* Create form */}
      <div style={{ background: "var(--admin-card-bg)", borderRadius: 16, border: "1px solid var(--admin-card-border)", padding: "18px 22px", marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text)", margin: "0 0 12px", letterSpacing: "-0.2px" }}>New Batch</h2>
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="e.g. JEE 2026, NEET Morning, CONQUER+"
            value={newName} onChange={e => setNewName(e.target.value)}
            style={{
              flex: 1, padding: "9px 14px", border: "1px solid var(--admin-card-border)", borderRadius: 10,
              fontSize: 13, outline: "none", background: "var(--admin-input-bg)", color: "var(--admin-text)",
            }}
          />
          <button type="submit" disabled={creating || !newName.trim()} style={{
            padding: "9px 20px", background: "#1D6BF3", color: "#fff",
            border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: creating || !newName.trim() ? "not-allowed" : "pointer",
            opacity: creating || !newName.trim() ? 0.55 : 1,
          }}>
            {creating ? "Creating…" : "+ Create"}
          </button>
        </form>
      </div>

      {/* Batch cards */}
      {loading ? (
        <div className="card-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: "var(--admin-card-bg)", borderRadius: 20, border: "1px solid var(--admin-card-border)", padding: 24, height: 160 }}>
              <div className="admin-skeleton" style={{ height: 18, width: 100, borderRadius: 100, marginBottom: 12 }} />
              <div className="admin-skeleton" style={{ height: 12, width: 70, marginBottom: 16 }} />
              <div className="admin-skeleton" style={{ height: 6, borderRadius: 100, marginBottom: 8 }} />
              <div className="admin-skeleton" style={{ height: 10, width: "50%" }} />
            </div>
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div style={{ background: "var(--admin-card-bg)", borderRadius: 20, border: "1px dashed var(--admin-card-border)", padding: 56, textAlign: "center" }}>
          <p style={{ color: "var(--admin-text-faint)", margin: 0, fontSize: 14 }}>No batches yet. Create your first batch above.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {batches.map((batch, i) => {
            const color = PALETTE[i % PALETTE.length];
            const pct = batch.avgAttendancePct;
            const isExpanded = expanded[batch.name];
            const detail = batchDetails[batch.name];
            const isLoadingDetail = loadingDetail[batch.name];

            return (
              <motion.div key={batch.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...sp, delay: i * 0.05 }}>
                <SpotlightCard accent={color}>
                  {/* Top accent strip */}
                  <div style={{ height: 3, background: `linear-gradient(90deg,${color},${color}55,transparent)` }} />

                  {/* Batch header — clickable to expand */}
                  <div
                    onClick={() => toggleExpand(batch.name)}
                    style={{ padding: "18px 22px", cursor: "pointer", userSelect: "none" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ background: `${color}18`, color, borderRadius: 100, padding: "4px 14px", fontSize: 13, fontWeight: 700 }}>
                            {batch.name}
                          </span>
                          <span style={{ fontSize: 13, color: "var(--admin-text-muted)" }}>
                            {batch.totalStudents} student{batch.totalStudents !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Attendance bar */}
                        <div style={{ marginTop: 14, maxWidth: 360 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 11, color: "var(--admin-text-faint)", fontWeight: 500 }}>Avg attendance · 30 days</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: attColor(pct) }}>{pct}%</span>
                          </div>
                          <div style={{ height: 5, background: "var(--admin-card-border)", borderRadius: 100, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: attColor(pct), borderRadius: 100, transition: "width 0.8s ease" }} />
                          </div>
                          {batch.totalWorkingDays !== undefined && (
                            <p style={{ fontSize: 10, color: "var(--admin-text-faint)", margin: "4px 0 0" }}>{batch.totalWorkingDays} working days</p>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 12, flexShrink: 0 }}>
                        {/* Delete */}
                        <button
                          onClick={e => handleDelete(e, batch)}
                          title="Delete batch"
                          style={{
                            width: 30, height: 30, border: "1px solid var(--admin-card-border)", borderRadius: 8,
                            background: "transparent", color: "var(--admin-text-faint)",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                        {/* Expand chevron */}
                        <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text-faint)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded students section */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div style={{ borderTop: "1px solid var(--admin-card-border)", padding: "0 22px 18px" }}>
                          {isLoadingDetail ? (
                            <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
                              {[1, 2, 3].map(k => (
                                <div key={k} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                  <div className="admin-skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
                                  <div style={{ flex: 1 }}>
                                    <div className="admin-skeleton" style={{ height: 12, width: "40%", marginBottom: 6 }} />
                                    <div className="admin-skeleton" style={{ height: 10, width: "25%" }} />
                                  </div>
                                  <div className="admin-skeleton" style={{ width: 48, height: 20, borderRadius: 100 }} />
                                </div>
                              ))}
                            </div>
                          ) : detail ? (
                            <div>
                              <div style={{ paddingTop: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                                  Students ({detail.students.length})
                                </span>
                                <span style={{ fontSize: 11, color: "var(--admin-text-faint)" }}>
                                  {detail.totalWorkingDays} working days (last 30 days)
                                </span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {detail.students.map((s, si) => {
                                  const latestTest = s.results[0];
                                  return (
                                    <div key={s.id} style={{
                                      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                                      borderRadius: 12, background: "var(--admin-input-bg)",
                                      border: "1px solid var(--admin-card-border)",
                                    }}>
                                      {/* Index */}
                                      <div style={{
                                        width: 28, height: 28, borderRadius: 8, background: `${color}18`,
                                        color, fontSize: 11, fontWeight: 800,
                                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                      }}>
                                        {si + 1}
                                      </div>
                                      {/* Name + enrollment */}
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                                        <div style={{ fontSize: 11, color: "var(--admin-text-faint)", fontFamily: "monospace" }}>{s.enrollmentNo}</div>
                                      </div>
                                      {/* Attendance */}
                                      <div style={{ textAlign: "center", minWidth: 56 }}>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: attColor(s.attendancePct) }}>{s.attendancePct}%</div>
                                        <div style={{ fontSize: 10, color: "var(--admin-text-faint)" }}>{s.presentDays}/{s.totalWorkingDays} days</div>
                                      </div>
                                      {/* Latest test */}
                                      {latestTest && (
                                        <div style={{ textAlign: "right", minWidth: 72 }}>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text)" }}>{latestTest.total}</div>
                                          <div style={{ fontSize: 10, color: "var(--admin-text-faint)" }}>Rank {latestTest.rank}/{latestTest.totalInBatch}</div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--admin-text-faint)", fontSize: 13 }}>Failed to load students</div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </SpotlightCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
