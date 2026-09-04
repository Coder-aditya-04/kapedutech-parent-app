"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePolling } from "@/lib/usePolling";
import { motion, AnimatePresence } from "framer-motion";

type Batch = { id: string; name: string; center: string; createdAt: string };
type Analytics = Batch & { totalStudents: number; avgAttendancePct: number; totalWorkingDays?: number };

const CENTERS = ["College Road", "Nashik Road"];
type StudentDetail = {
  id: string; name: string; enrollmentNo: string;
  attendancePct: number; presentDays: number; totalWorkingDays: number;
  lastSeen: string | null;
  results: { testName: string; testDate: string; total: number; percentage: number; rank: number; totalInBatch: number }[];
};
type BatchDetail = { batchName: string; totalStudents: number; totalWorkingDays: number; students: StudentDetail[] };

const PALETTE = ["#6366F1","#0D9488","#F59E0B","#0891B2","#8B5CF6","#BE185D","#08BD80","#EC4899"];
function attColor(p: number) { return p >= 75 ? "#08BD80" : p >= 50 ? "#F59E0B" : "#FB923C"; }

function downloadAllPTM(details: BatchDetail[]) {
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
        d.batchName, s.name, s.enrollmentNo, `${s.attendancePct}%`,
        ...allTests.map(t => testMap[t.key] ?? ""),
        avgPct !== "" ? `${avgPct}%` : "—",
      ]);
    }
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
  const router = useRouter();
  const [batches, setBatches] = useState<Analytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCenter, setFilterCenter] = useState("");
  const [newName, setNewName] = useState("");
  const [newCenter, setNewCenter] = useState(CENTERS[0]);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [batchDetails, setBatchDetails] = useState<Record<string, BatchDetail>>({});
  const [downloadingPTM, setDownloadingPTM] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = filterCenter ? `/api/admin/batches/analytics?center=${encodeURIComponent(filterCenter)}` : "/api/admin/batches/analytics";
      const res = await fetch(url);
      setBatches(res.ok ? await res.json() : []);
    } catch {}
    setLoading(false);
  }, [filterCenter]);

  useEffect(() => { load(); }, [load]);

  const pollBatches = useCallback(() => { load(true); }, [load]);
  usePolling(pollBatches, 30000);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }

  async function fetchDetail(batchName: string): Promise<BatchDetail | null> {
    if (batchDetails[batchName]) return batchDetails[batchName];
    try {
      const res = await fetch(`/api/admin/batches/detail/${encodeURIComponent(batchName)}`);
      if (!res.ok) return null;
      const data: BatchDetail = await res.json();
      setBatchDetails(p => ({ ...p, [batchName]: data }));
      return data;
    } catch { return null; }
  }

  async function handleDownloadPTM(e: React.MouseEvent, batchName: string) {
    e.stopPropagation();
    setDownloadingPTM(p => ({ ...p, [batchName]: true }));
    const detail = await fetchDetail(batchName);
    if (detail) downloadAllPTM([detail]);
    else showToast("Failed to load batch data", false);
    setDownloadingPTM(p => ({ ...p, [batchName]: false }));
  }

  async function handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/batches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), center: newCenter }),
      });
      const d = await res.json();
      if (res.ok) { showToast(`"${newName.trim()}" created`, true); setNewName(""); setShowCreateModal(false); load(); }
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
              border: `1px solid ${toast.ok ? "rgba(8,189,128,0.3)" : "rgba(251,146,60,0.3)"}`,
              color: toast.ok ? "#08BD80" : "#FB923C",
              padding: "11px 18px", borderRadius: 14, fontWeight: 600, fontSize: 13,
              boxShadow: "0 8px 28px rgba(0,0,0,0.15)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {toast.ok ? "✓" : "✕"} {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create modal */}
      {showCreateModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, backdropFilter: "blur(4px)", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
        >
          <div style={{ background: "var(--admin-card-bg)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--admin-text)" }}>Create New Batch</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ border: "none", background: "var(--admin-input-bg)", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "var(--admin-text-muted)", fontSize: 16, lineHeight: "32px" }}>✕</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Batch Name</label>
                <input
                  autoFocus
                  placeholder="e.g. JEE 2026, NEET Morning, CONQUER+"
                  value={newName} onChange={e => setNewName(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--admin-card-border)", borderRadius: 10, fontSize: 14, outline: "none", background: "var(--admin-input-bg)", color: "var(--admin-text)", boxSizing: "border-box" as const }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Center</label>
                <select
                  value={newCenter} onChange={e => setNewCenter(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--admin-card-border)", borderRadius: 10, fontSize: 14, background: "var(--admin-input-bg)", color: "var(--admin-text)", outline: "none", cursor: "pointer" }}
                >
                  {CENTERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: "11px", border: "1.5px solid var(--admin-card-border)", borderRadius: 10, background: "transparent", color: "var(--admin-text)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newName.trim()} style={{ flex: 1, padding: "11px", background: "#08BD80", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: creating || !newName.trim() ? "not-allowed" : "pointer", opacity: creating || !newName.trim() ? 0.6 : 1 }}>
                  {creating ? "Creating…" : "+ Create Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--admin-text)", margin: 0, letterSpacing: "-0.5px" }}>Batches</h1>
          <p style={{ color: "var(--admin-text-muted)", fontSize: 13, margin: "4px 0 0" }}>
            {batches.length} batch{batches.length !== 1 ? "es" : ""} · Click any card to view students
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={filterCenter}
            onChange={e => setFilterCenter(e.target.value)}
            style={{ padding: "8px 14px", border: "1px solid var(--admin-card-border)", borderRadius: 10, fontSize: 13, background: "var(--admin-input-bg)", color: "var(--admin-text)", outline: "none", cursor: "pointer" }}
          >
            <option value="">All Centers</option>
            {CENTERS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{ padding: "9px 20px", background: "#08BD80", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            + Create Batch
          </button>
        </div>
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

            return (
              <motion.div key={batch.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...sp, delay: i * 0.05 }}>
                <SpotlightCard accent={color}>
                  {/* Top accent strip */}
                  <div style={{ height: 3, background: `linear-gradient(90deg,${color},${color}55,transparent)` }} />

                  {/* Batch header — clickable to open detail page */}
                  <div
                    onClick={() => router.push(`/admin/batches/${encodeURIComponent(batch.name)}`)}
                    style={{ padding: "18px 22px", cursor: "pointer", userSelect: "none" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ background: `${color}18`, color, borderRadius: 100, padding: "4px 14px", fontSize: 13, fontWeight: 700 }}>
                            {batch.name}
                          </span>
                          <span style={{ background: "var(--admin-card-border)", color: "var(--admin-text-muted)", borderRadius: 100, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                            {batch.center}
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
                        {/* PTM Download */}
                        <button
                          onClick={e => handleDownloadPTM(e, batch.name)}
                          disabled={!!downloadingPTM[batch.name]}
                          title="Download PTM Report for this batch"
                          style={{
                            padding: "6px 12px", border: `1px solid ${color}40`, borderRadius: 8,
                            background: `${color}12`, color, fontSize: 11, fontWeight: 700,
                            cursor: downloadingPTM[batch.name] ? "not-allowed" : "pointer",
                            opacity: downloadingPTM[batch.name] ? 0.6 : 1,
                            display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          {downloadingPTM[batch.name] ? "…" : "PTM"}
                        </button>
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
                        {/* Arrow indicator */}
                        <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text-faint)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
