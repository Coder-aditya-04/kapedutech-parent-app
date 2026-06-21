"use client";
import { useEffect, useState, useCallback } from "react";

type Student = { id: string; name: string; enrollmentNo: string; batch: string; center: string; parent: { phone: string; name: string; email?: string | null } };
type Batch = { id: string; name: string };
type ImportRow = { name: string; enrollmentNo: string; batch: string; parentName: string; parentPhone: string; parentEmail: string; center?: string };

const CENTERS = ["All", "College Road", "Nashik Road"];

function exportCSV(students: Student[]) {
  const rows = [
    ["Name", "Enrollment No", "Batch", "Center", "Parent Name", "Parent Phone", "Parent Email"],
    ...students.map(s => [s.name, s.enrollmentNo, s.batch || "", s.center || "", s.parent?.name || "", s.parent?.phone || "", s.parent?.email || ""]),
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "students.csv"; a.click();
  URL.revokeObjectURL(url);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseImportCSV(text: string): ImportRow[] {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]!).map(h => h.toLowerCase().replace(/\s+/g, ""));
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const get = (keys: string[]) => vals[headers.findIndex(h => keys.includes(h))] ?? "";
    return {
      name: get(["name", "studentname"]),
      enrollmentNo: get(["enrollmentno", "enrollment", "rollno", "roll"]),
      batch: get(["batch", "class"]),
      parentName: get(["parentname", "parent", "fathername"]),
      parentPhone: get(["parentphone", "phone", "mobile", "contact"]),
      parentEmail: get(["parentemail", "email", "mail"]),
      center: get(["center", "branch", "location"]) || undefined,
    };
  }).filter(r => r.name && r.parentPhone);
}

const BATCH_COLORS: Record<number, string> = { 0: "#0064E0", 1: "#6441D2", 2: "#059669", 3: "#D97706", 4: "#DC2626", 5: "#0891B2" };
const CENTER_COLORS: Record<string, { bg: string; color: string }> = {
  "College Road": { bg: "rgba(79,70,229,0.1)", color: "#4F46E5" },
  "Nashik Road":  { bg: "rgba(5,150,105,0.1)", color: "#059669" },
};

const S = {
  card: { background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" },
  th: { padding: "9px 10px", textAlign: "left" as const, color: "var(--admin-text-faint)", fontWeight: 600, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: 0.7, background: "var(--admin-input-bg)", whiteSpace: "nowrap" as const },
  td: { padding: "9px 10px", whiteSpace: "nowrap" as const, fontSize: 13 },
  inp: { width: "100%", padding: "10px 12px", border: "1.5px solid var(--admin-input-border)", borderRadius: 10, fontSize: 14, boxSizing: "border-box" as const, outline: "none", color: "var(--admin-text)", background: "var(--admin-input-bg)", fontFamily: "inherit" },
  modal: { background: "var(--admin-card-bg)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", margin: 16 },
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: "blur(3px)" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "var(--admin-text-muted)", marginBottom: 5 },
  text: { color: "var(--admin-text)" },
  muted: { color: "var(--admin-text-muted)" },
  faint: { color: "var(--admin-text-faint)" },
  row: { borderTop: "1px solid var(--admin-card-border)" },
  optionalBadge: { fontSize: 10, fontWeight: 600, color: "var(--admin-text-faint)", background: "var(--admin-input-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 6, padding: "1px 6px", marginLeft: 6, verticalAlign: "middle" as const },
  chip: (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 100, border: "1px solid",
    borderColor: active ? "var(--admin-accent)" : "var(--admin-card-border)",
    background: active ? "var(--admin-accent)" : "var(--admin-input-bg)",
    color: active ? "#fff" : "var(--admin-text-muted)",
    fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" as const,
  }),
} as const;

function FormFields({ values, onChange }: { values: Record<string, string>; onChange: (k: string, v: string) => void }) {
  const fields = [
    { label: "Student Name", key: "name", type: "text", placeholder: "Full name", required: true },
    { label: "Enrollment No", key: "enrollmentNo", type: "text", placeholder: "e.g. JEE2026-001", required: true },
    { label: "Parent Name", key: "parentName", type: "text", placeholder: "Parent full name", required: true },
    { label: "Parent Phone (for SMS login)", key: "parentPhone", type: "tel", placeholder: "10 digit mobile", required: true },
    { label: "Parent Email (for email login)", key: "parentEmail", type: "email", placeholder: "parent@email.com", required: false },
  ];
  return (
    <>
      {fields.map(f => (
        <div key={f.key}>
          <label style={S.label}>
            {f.label}
            {!f.required && <span style={S.optionalBadge}>optional</span>}
          </label>
          <input type={f.type} placeholder={f.placeholder} required={f.required} value={values[f.key] ?? ""}
            onChange={e => onChange(f.key, e.target.value)} style={S.inp} />
        </div>
      ))}
    </>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [center, setCenter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", enrollmentNo: "", batch: "", center: "College Road", parentName: "", parentPhone: "", parentEmail: "" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ name: "", enrollmentNo: "", batch: "", center: "College Road", parentName: "", parentPhone: "", parentEmail: "" });
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [filterBatch, setFilterBatch] = useState("All");
  const [showBatchFilter, setShowBatchFilter] = useState(false);

  const load = useCallback(async (q?: string) => {
    try {
      const cp = center !== "All" ? `center=${encodeURIComponent(center)}` : "";
      const [sRes, bRes] = await Promise.all([
        fetch(q
          ? `/api/admin/students/search?q=${encodeURIComponent(q)}${cp ? `&${cp}` : ""}`
          : `/api/admin/students${cp ? `?${cp}` : ""}`),
        fetch(`/api/admin/batches${cp ? `?${cp}` : ""}`),
      ]);
      const s = sRes.ok ? await sRes.json() : [];
      const b: Batch[] = bRes.ok ? await bRes.json() : [];
      setStudents(s);
      setBatches(b);
      setForm(f => ({ ...f, batch: f.batch || b[0]?.name || "" }));
      setSelected(new Set());
      setFilterBatch("All");
    } catch {}
    setLoading(false);
  }, [center]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => load(search || undefined), 300); return () => clearTimeout(t); }, [search, load]);

  // Close batch filter dropdown when clicking outside
  useEffect(() => {
    if (!showBatchFilter) return;
    const close = () => setShowBatchFilter(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showBatchFilter]);

  // Auto-refresh: every 20s + instantly when tab regains focus (silent — no spinner)
  useEffect(() => {
    const id = setInterval(() => load(search || undefined), 20000);
    const onVisible = () => { if (!document.hidden) load(search || undefined); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [load, search]);

  function showToast(msg: string, ok: boolean) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, parentEmail: form.parentEmail || undefined }),
      });
      if (res.ok) {
        showToast("Student added!", true);
        setShowModal(false);
        setForm({ name: "", enrollmentNo: "", batch: batches[0]?.name || "", center: "College Road", parentName: "", parentPhone: "", parentEmail: "" });
        load();
      } else { showToast((await res.json()).message ?? "Failed", false); }
    } catch { showToast("Network error", false); }
    setSubmitting(false);
  }

  function openEdit(s: Student) {
    setEditStudent(s);
    setEditForm({ name: s.name, enrollmentNo: s.enrollmentNo, batch: s.batch || batches[0]?.name || "", center: s.center || "College Road", parentName: s.parent?.name ?? "", parentPhone: s.parent?.phone ?? "", parentEmail: s.parent?.email ?? "" });
  }

  async function handleEditSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editStudent) return;
    setEditing(true);
    try {
      const res = await fetch(`/api/admin/students/${editStudent.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, parentEmail: editForm.parentEmail || undefined }),
      });
      if (res.ok) { showToast("Student updated", true); setEditStudent(null); load(); }
      else { showToast((await res.json()).message ?? "Failed", false); }
    } catch { showToast("Network error", false); }
    setEditing(false);
  }

  async function handleDelete() {
    if (!deleteStudent) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/students/${deleteStudent.id}`, { method: "DELETE" });
      if (res.ok) { showToast("Student deleted", false); setDeleteStudent(null); load(); }
      else { showToast((await res.json()).message ?? "Failed", false); }
    } catch { showToast("Network error", false); }
    setDeleting(false);
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/students/bulk-delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const d = await res.json();
      if (res.ok) { showToast(`Deleted ${d.count} student${d.count !== 1 ? "s" : ""}`, false); setShowBulkDelete(false); load(); }
      else { showToast(d.message ?? "Failed", false); }
    } catch { showToast("Network error", false); }
    setBulkDeleting(false);
  }

  const displayStudents = filterBatch === "All" ? students : students.filter(s => s.batch === filterBatch);
  const allSelected = displayStudents.length > 0 && displayStudents.every(s => selected.has(s.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(displayStudents.map(s => s.id)));
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseImportCSV(ev.target?.result as string);
      setImportRows(rows);
      if (!rows.length) showToast("No valid rows found. Check CSV format.", false);
      else showToast(`${rows.length} students ready to import`, true);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!importRows.length) return;
    setImporting(true);
    try {
      const res = await fetch("/api/admin/students/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: importRows, center: center !== "All" ? center : undefined }),
      });
      const d = await res.json();
      if (res.ok) {
        showToast(`Imported ${d.created} students. Skipped ${d.skipped}.`, true);
        setShowImport(false); setImportRows([]); load();
      } else showToast(d.message ?? "Import failed", false);
    } catch { showToast("Network error", false); }
    setImporting(false);
  }

  const batchColor = (name: string) => {
    const i = batches.findIndex(b => b.name === name);
    return BATCH_COLORS[i % 6] ?? "#6B7280";
  };

  const centerStyle = (c: string) => CENTER_COLORS[c] ?? { bg: "rgba(107,114,128,0.1)", color: "#6B7280" };

  return (
    <div className="admin-page">
      {toast && (
        <div style={{ position: "fixed", top: 24, right: 24, background: toast.ok ? "#ECFDF5" : "#FEF2F2", color: toast.ok ? "#059669" : "#DC2626", padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14, zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${toast.ok ? "#A7F3D0" : "#FECACA"}` }}>
          {toast.ok ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>Students</h1>
          <p style={{ color: "var(--admin-text-muted)", marginTop: 4, fontSize: 14, margin: "4px 0 0" }}>{loading ? "Loading..." : `${displayStudents.length} of ${students.length} student${students.length !== 1 ? "s" : ""}${center !== "All" ? ` · ${center}` : ""}${filterBatch !== "All" ? ` · ${filterBatch}` : ""}`}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {someSelected && (
            <button onClick={() => setShowBulkDelete(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", border: "1px solid #FCA5A5", borderRadius: 100, background: "#FFF5F5", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Delete Selected ({selected.size})
            </button>
          )}
          <button onClick={() => exportCSV(students)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", border: "1px solid var(--admin-card-border)", borderRadius: 100, background: "var(--admin-card-bg)", color: "var(--admin-text)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
          <button onClick={() => setShowImport(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", border: "1px solid #059669", borderRadius: 100, background: "#ECFDF5", color: "#059669", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import CSV
          </button>
          <button onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--admin-accent)", color: "#fff", border: "none", borderRadius: 100, padding: "9px 18px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Student
          </button>
        </div>
      </div>

      {/* Center filter + Search */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {CENTERS.map(c => (
            <button key={c} onClick={() => setCenter(c)} style={S.chip(center === c)}>{c}</button>
          ))}
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--admin-text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search by name or enrollment no..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...S.inp, paddingLeft: 38, borderRadius: 100 }} />
        </div>
      </div>

      {/* Table */}
      <div style={S.card}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 36, paddingRight: 0 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--admin-accent)" }} />
                </th>
                <th style={S.th}>Name</th>
                <th style={S.th}>Enrollment No</th>
                {/* Batch header with column filter dropdown */}
                <th style={{ ...S.th, position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span>Batch</span>
                    <button
                      onClick={e => { e.stopPropagation(); setShowBatchFilter(p => !p); }}
                      title={filterBatch !== "All" ? `Filtered: ${filterBatch}` : "Filter by batch"}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 4, border: "none", cursor: "pointer", background: filterBatch !== "All" ? "var(--admin-accent)" : "rgba(128,128,128,0.12)", color: filterBatch !== "All" ? "#fff" : "var(--admin-text-faint)", flexShrink: 0 }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                    </button>
                  </div>
                  {showBatchFilter && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30, background: "var(--admin-card-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.15)", padding: 6, minWidth: 170, maxHeight: 280, overflowY: "auto" }}>
                      {["All", ...batches.map(b => b.name)].map(b => (
                        <button key={b} onClick={() => { setFilterBatch(b); setShowBatchFilter(false); }}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "6px 10px", borderRadius: 7, border: "none", background: filterBatch === b ? "var(--admin-accent)" : "transparent", color: filterBatch === b ? "#fff" : "var(--admin-text)", fontSize: 12, fontWeight: filterBatch === b ? 700 : 400, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}
                        >
                          {b !== "All" && <span style={{ width: 8, height: 8, borderRadius: 2, background: filterBatch === b ? "#fff" : batchColor(b), display: "inline-block", flexShrink: 0 }} />}
                          {b === "All" ? "All Batches" : b}
                        </button>
                      ))}
                    </div>
                  )}
                </th>
                <th style={S.th}>Center</th>
                <th style={S.th}>Parent Name</th>
                <th style={S.th}>Phone</th>
                <th style={S.th}>Email</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--admin-text-faint)" }}>Loading...</td></tr>
              ) : displayStudents.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--admin-text-faint)" }}>No students found</td></tr>
              ) : displayStudents.map(s => {
                const cs = centerStyle(s.center);
                const isChecked = selected.has(s.id);
                return (
                  <tr key={s.id} style={{ ...S.row, background: isChecked ? "rgba(79,70,229,0.04)" : undefined }}>
                    <td style={{ ...S.td, width: 36, paddingRight: 0 }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleOne(s.id)}
                        style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--admin-accent)" }} />
                    </td>
                    <td style={{ ...S.td, fontWeight: 600, color: "var(--admin-text)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</td>
                    <td style={{ ...S.td, color: "var(--admin-text-muted)", fontFamily: "monospace" }}>{s.enrollmentNo}</td>
                    <td style={S.td}>
                      <span style={{ background: batchColor(s.batch), color: "#fff", borderRadius: 7, padding: "3px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 0.3, display: "inline-block", whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{s.batch || "—"}</span>
                    </td>
                    <td style={S.td}>
                      <span style={{ background: cs.bg, color: cs.color, borderRadius: 100, padding: "3px 8px", fontSize: 10, fontWeight: 600, display: "inline-block", whiteSpace: "nowrap" }}>{s.center || "—"}</span>
                    </td>
                    <td style={{ ...S.td, color: "var(--admin-text-muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{s.parent?.name ?? "—"}</td>
                    <td style={{ ...S.td, color: "var(--admin-accent)", fontFamily: "monospace" }}>{s.parent?.phone ?? "—"}</td>
                    <td style={{ ...S.td, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.parent?.email
                        ? <span style={{ color: "var(--admin-accent)" }}>{s.parent.email}</span>
                        : <span style={{ color: "var(--admin-text-faint)", fontStyle: "italic" }}>not set</span>
                      }
                    </td>
                    <td style={{ ...S.td, paddingRight: 12 }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => openEdit(s)} style={{ width: 28, height: 28, border: "1px solid var(--admin-card-border)", borderRadius: 7, background: "var(--admin-card-bg)", color: "#4F46E5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => setDeleteStudent(s)} style={{ width: 28, height: 28, border: "1px solid #FCA5A5", borderRadius: 7, background: "#FFF5F5", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>Add New Student</h2>
              <button onClick={() => setShowModal(false)} style={{ border: "none", background: "var(--admin-input-bg)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "var(--admin-text-muted)" }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FormFields values={form} onChange={(k, v) => setForm(p => ({ ...p, [k]: v }))} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={S.label}>Batch</label>
                  <select value={form.batch} onChange={e => setForm(p => ({ ...p, batch: e.target.value }))} style={S.inp}>
                    {batches.length === 0 && <option value="">No batches — create one first</option>}
                    {batches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Center</label>
                  <select value={form.center} onChange={e => setForm(p => ({ ...p, center: e.target.value }))} style={S.inp}>
                    <option value="College Road">College Road</option>
                    <option value="Nashik Road">Nashik Road</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "10px", border: "1.5px solid var(--admin-card-border)", borderRadius: 10, background: "var(--admin-card-bg)", color: "var(--admin-text)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: "var(--admin-accent)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? "Adding..." : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editStudent && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>Edit Student</h2>
              <button onClick={() => setEditStudent(null)} style={{ border: "none", background: "var(--admin-input-bg)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "var(--admin-text-muted)" }}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FormFields values={editForm} onChange={(k, v) => setEditForm(p => ({ ...p, [k]: v }))} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={S.label}>Batch</label>
                  <select value={editForm.batch} onChange={e => setEditForm(p => ({ ...p, batch: e.target.value }))} style={S.inp}>
                    {batches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Center</label>
                  <select value={editForm.center} onChange={e => setEditForm(p => ({ ...p, center: e.target.value }))} style={S.inp}>
                    <option value="College Road">College Road</option>
                    <option value="Nashik Road">Nashik Road</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <button type="button" onClick={() => setEditStudent(null)} style={{ flex: 1, padding: "10px", border: "1.5px solid var(--admin-card-border)", borderRadius: 10, background: "var(--admin-card-bg)", color: "var(--admin-text)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={editing} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: "var(--admin-accent)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: editing ? "not-allowed" : "pointer", opacity: editing ? 0.7 : 1 }}>
                  {editing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImport && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 520 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>Import Students from CSV</h2>
              <button onClick={() => { setShowImport(false); setImportRows([]); }} style={{ border: "none", background: "var(--admin-input-bg)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "var(--admin-text-muted)" }}>✕</button>
            </div>
            <div style={{ background: "var(--admin-input-bg)", border: "1px solid var(--admin-card-border)", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: "var(--admin-text-muted)" }}>
              Required columns: <strong style={{ color: "var(--admin-text)" }}>Name, EnrollmentNo, Batch, ParentName, ParentPhone</strong><br />
              Optional: <strong style={{ color: "var(--admin-text)" }}>ParentEmail, Center</strong>
            </div>
            <input type="file" accept=".csv" onChange={handleImportFile}
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--admin-input-border)", borderRadius: 10, fontSize: 14, boxSizing: "border-box", background: "var(--admin-input-bg)", color: "var(--admin-text)", marginBottom: 14 }} />
            {importRows.length > 0 && (
              <div style={{ background: "var(--admin-input-bg)", borderRadius: 10, padding: 12, marginBottom: 14, maxHeight: 160, overflowY: "auto", border: "1px solid var(--admin-card-border)" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "var(--admin-text)" }}>{importRows.length} students to import:</p>
                {importRows.slice(0, 8).map((r, i) => (
                  <p key={i} style={{ margin: "2px 0", fontSize: 12, color: "var(--admin-text-muted)" }}>
                    {r.name} · {r.batch} · {r.center || (center !== "All" ? center : "College Road")} · {r.parentPhone}
                  </p>
                ))}
                {importRows.length > 8 && <p style={{ fontSize: 12, color: "var(--admin-text-faint)", margin: "4px 0 0" }}>...and {importRows.length - 8} more</p>}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowImport(false); setImportRows([]); }} style={{ flex: 1, padding: "10px", border: "1.5px solid var(--admin-card-border)", borderRadius: 10, background: "var(--admin-card-bg)", color: "var(--admin-text)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleImport} disabled={importing || importRows.length === 0}
                style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: importing || !importRows.length ? "#9CA3AF" : "#059669", color: "#fff", fontSize: 14, fontWeight: 700, cursor: importing || !importRows.length ? "not-allowed" : "pointer" }}>
                {importing ? "Importing..." : `Import ${importRows.length} Students`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDelete && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>Delete {selected.size} Student{selected.size !== 1 ? "s" : ""}?</h2>
              <button onClick={() => setShowBulkDelete(false)} style={{ border: "none", background: "var(--admin-input-bg)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "var(--admin-text-muted)" }}>✕</button>
            </div>
            <p style={{ color: "var(--admin-text-muted)", fontSize: 14, margin: "0 0 24px 0", lineHeight: 1.6 }}>
              This will permanently delete <strong style={{ color: "var(--admin-text)" }}>{selected.size} student{selected.size !== 1 ? "s" : ""}</strong> and all their attendance records. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowBulkDelete(false)} style={{ flex: 1, padding: "10px", border: "1.5px solid var(--admin-card-border)", borderRadius: 10, background: "var(--admin-card-bg)", color: "var(--admin-text)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: bulkDeleting ? "#FCA5A5" : "#DC2626", color: "#fff", fontSize: 14, fontWeight: 700, cursor: bulkDeleting ? "not-allowed" : "pointer" }}>
                {bulkDeleting ? "Deleting..." : `Delete ${selected.size} Student${selected.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteStudent && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--admin-text)" }}>Delete Student</h2>
              <button onClick={() => setDeleteStudent(null)} style={{ border: "none", background: "var(--admin-input-bg)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "var(--admin-text-muted)" }}>✕</button>
            </div>
            <p style={{ color: "var(--admin-text-muted)", fontSize: 14, margin: "0 0 24px 0", lineHeight: 1.6 }}>Delete <strong style={{ color: "var(--admin-text)" }}>{deleteStudent.name}</strong>? This removes all their attendance records.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteStudent(null)} style={{ flex: 1, padding: "10px", border: "1.5px solid var(--admin-card-border)", borderRadius: 10, background: "var(--admin-card-bg)", color: "var(--admin-text)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: "10px", border: "none", borderRadius: 10, background: deleting ? "#FCA5A5" : "#DC2626", color: "#fff", fontSize: 14, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer" }}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
