"use client";
import { useEffect, useState } from "react";

type Batch = { id: string; name: string };
type SubjectConfig = { name: string; max: number };
type BatchConfig = { subjects: SubjectConfig[]; passPercent: number };
type AllConfigs = Record<string, BatchConfig>;

const STORAGE_KEY = "kap_batch_subject_configs";
const SUBJECT_COLORS = ["#6366F1", "#08BD80", "#F59E0B", "#0891B2", "#8B5CF6", "#EC4899"];

const DEFAULT_CONFIG: BatchConfig = { subjects: [{ name: "Subject 1", max: 100 }], passPercent: 35 };

function loadConfigs(): AllConfigs {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
}
function saveConfigs(c: AllConfigs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); }

const card: React.CSSProperties = {
  background: "var(--admin-card-bg)",
  border: "1px solid var(--admin-card-border)",
  borderRadius: 16,
};

export default function SettingsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [configs, setConfigs] = useState<AllConfigs>({});
  const [activeBatch, setActiveBatch] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setConfigs(loadConfigs());
    fetch("/api/admin/batches")
      .then(r => r.ok ? r.json() : [])
      .then((b: Batch[]) => {
        setBatches(b);
        if (b.length > 0) setActiveBatch(b[0].name);
      })
      .finally(() => setLoading(false));
  }, []);

  function getConfig(batchName: string): BatchConfig {
    return configs[batchName] ?? { ...DEFAULT_CONFIG, subjects: [{ name: "Subject 1", max: 100 }] };
  }

  function updateConfig(batchName: string, cfg: BatchConfig) {
    setConfigs(prev => ({ ...prev, [batchName]: cfg }));
  }

  function addSubject(batchName: string) {
    const cfg = getConfig(batchName);
    updateConfig(batchName, { ...cfg, subjects: [...cfg.subjects, { name: `Subject ${cfg.subjects.length + 1}`, max: 100 }] });
  }

  function removeSubject(batchName: string, idx: number) {
    const cfg = getConfig(batchName);
    updateConfig(batchName, { ...cfg, subjects: cfg.subjects.filter((_, i) => i !== idx) });
  }

  function updateSubject(batchName: string, idx: number, field: "name" | "max", value: string | number) {
    const cfg = getConfig(batchName);
    const subjects = cfg.subjects.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    updateConfig(batchName, { ...cfg, subjects });
  }

  function handleSave() {
    saveConfigs(configs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const activeCfg = activeBatch ? getConfig(activeBatch) : null;
  const totalMax = activeCfg?.subjects.reduce((a, s) => a + (Number(s.max) || 0), 0) ?? 0;

  return (
    <div className="admin-page" style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>

      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.3px" }}>Settings</h1>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--admin-text-faint)" }}>Configure how results are calculated and shown to students</p>
      </div>

      {/* How Results Work — explanation card */}
      <div style={{ ...card, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>How Results Are Calculated</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Score %", formula: "(Student Total ÷ Max Total) × 100", desc: "Each student's total divided by the batch max marks, multiplied by 100", color: "#08BD80" },
            { label: "Rank", formula: "Sorted by Total Score", desc: "Students ranked 1 to N based on their total. Rank 1 = highest scorer in the test", color: "#6366F1" },
            { label: "Percentile", formula: "(Students Below ÷ (Total−1)) × 100", desc: "Shows what % of students scored below this student. 99 percentile = only 1% scored higher", color: "#F59E0B" },
          ].map((item, i) => (
            <div key={i} style={{ padding: "14px 16px", background: `${item.color}08`, border: `1px solid ${item.color}18`, borderRadius: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: item.color, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text)", marginBottom: 6, fontFamily: "monospace" }}>{item.formula}</div>
              <div style={{ fontSize: 11, color: "var(--admin-text-faint)", lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>

        {/* Example */}
        <div style={{ padding: "14px 16px", background: "var(--admin-input-bg)", borderRadius: 12, border: "1px solid var(--admin-card-border)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Example · MHT-CET Batch</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {[{ s: "Maths", score: 82, max: 100 }, { s: "Physics", score: 38, max: 50 }, { s: "Chemistry", score: 42, max: 50 }].map((x, i) => (
              <div key={i} style={{ padding: "6px 12px", background: `${SUBJECT_COLORS[i]}12`, border: `1px solid ${SUBJECT_COLORS[i]}22`, borderRadius: 8, fontSize: 12 }}>
                <span style={{ color: "var(--admin-text-muted)" }}>{x.s}: </span>
                <span style={{ fontWeight: 700, color: SUBJECT_COLORS[i] }}>{x.score}</span>
                <span style={{ color: "var(--admin-text-faint)" }}>/{x.max}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
            <span style={{ color: "var(--admin-text-muted)" }}>Total: <strong style={{ color: "var(--admin-text)" }}>162 / 200</strong></span>
            <span style={{ color: "var(--admin-text-muted)" }}>Score %: <strong style={{ color: "#08BD80" }}>81%</strong></span>
            <span style={{ color: "var(--admin-text-faint)", fontSize: 11 }}>(162 ÷ 200 × 100)</span>
          </div>
        </div>
      </div>

      {/* Per-Batch Subject Configuration */}
      <div style={{ ...card, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(8,189,128,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#08BD80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Batch Subject Configuration</div>
        </div>
        <div style={{ fontSize: 12, color: "var(--admin-text-faint)", marginBottom: 20 }}>
          Set the subjects and max marks for each batch. This appears as a reference when uploading results.
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--admin-text-faint)" }}>Loading batches…</div>
        ) : batches.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--admin-text-faint)" }}>No batches found. Create batches first.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, alignItems: "start" }}>
            {/* Batch list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {batches.map(b => {
                const cfg = configs[b.name];
                const isActive = activeBatch === b.name;
                return (
                  <button key={b.id} onClick={() => setActiveBatch(b.name)} style={{
                    padding: "10px 12px", borderRadius: 10, border: `1px solid ${isActive ? "var(--admin-accent)" : "var(--admin-card-border)"}`,
                    background: isActive ? "rgba(8,189,128,0.08)" : "var(--admin-input-bg)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.12s",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? "var(--admin-accent)" : "var(--admin-text)" }}>{b.name}</div>
                    <div style={{ fontSize: 10, color: "var(--admin-text-faint)", marginTop: 2 }}>
                      {cfg ? `${cfg.subjects.length} subject${cfg.subjects.length !== 1 ? "s" : ""} · ${cfg.subjects.reduce((a, s) => a + (Number(s.max) || 0), 0)} total marks` : "Not configured"}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Config editor */}
            {activeBatch && activeCfg && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>{activeBatch}</div>
                  <div style={{ fontSize: 12, color: "var(--admin-text-faint)" }}>
                    Total max: <strong style={{ color: "var(--admin-accent)" }}>{totalMax} marks</strong>
                  </div>
                </div>

                {/* Subjects table */}
                <div style={{ background: "var(--admin-input-bg)", borderRadius: 12, border: "1px solid var(--admin-card-border)", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 40px", gap: 0, padding: "8px 14px", borderBottom: "1px solid var(--admin-card-border)", background: "var(--admin-card-border)" }}>
                    {["Subject Name", "Max Marks", ""].map(h => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</div>
                    ))}
                  </div>
                  {activeCfg.subjects.map((s, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 40px", gap: 8, padding: "10px 14px", borderBottom: i < activeCfg.subjects.length - 1 ? "1px solid var(--admin-card-border)" : "none", alignItems: "center" }}>
                      <input
                        value={s.name}
                        onChange={e => updateSubject(activeBatch, i, "name", e.target.value)}
                        style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--admin-input-border)", background: "var(--admin-card-bg)", color: "var(--admin-text)", fontSize: 12, outline: "none" }}
                        placeholder="e.g. Physics"
                      />
                      <input
                        type="number"
                        min={1}
                        value={s.max}
                        onChange={e => updateSubject(activeBatch, i, "max", Number(e.target.value))}
                        style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--admin-input-border)", background: "var(--admin-card-bg)", color: "var(--admin-text)", fontSize: 12, outline: "none", width: "100%" }}
                      />
                      <button
                        onClick={() => removeSubject(activeBatch, i)}
                        disabled={activeCfg.subjects.length <= 1}
                        style={{ padding: "5px", borderRadius: 7, border: "none", background: "rgba(251,146,60,0.10)", color: "#FB923C", cursor: activeCfg.subjects.length <= 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: activeCfg.subjects.length <= 1 ? 0.4 : 1 }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => addSubject(activeBatch)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px dashed var(--admin-accent)", background: "rgba(8,189,128,0.06)", color: "var(--admin-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Subject
                  </button>

                  {/* Pass % */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>Pass at</span>
                    <input
                      type="number" min={1} max={100}
                      value={activeCfg.passPercent}
                      onChange={e => updateConfig(activeBatch, { ...activeCfg, passPercent: Number(e.target.value) })}
                      style={{ width: 60, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--admin-input-border)", background: "var(--admin-input-bg)", color: "var(--admin-text)", fontSize: 12, outline: "none", textAlign: "center" }}
                    />
                    <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>%</span>
                  </div>
                </div>

                {/* Visual summary */}
                <div style={{ padding: "14px 16px", background: "var(--admin-input-bg)", borderRadius: 12, border: "1px solid var(--admin-card-border)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Mark Distribution Preview</div>
                  <div style={{ display: "flex", height: 10, borderRadius: 100, overflow: "hidden", marginBottom: 8 }}>
                    {activeCfg.subjects.map((s, i) => (
                      <div key={i} style={{ width: `${totalMax > 0 ? ((Number(s.max) || 0) / totalMax * 100) : 0}%`, background: SUBJECT_COLORS[i % SUBJECT_COLORS.length], transition: "width 0.3s ease" }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {activeCfg.subjects.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: SUBJECT_COLORS[i % SUBJECT_COLORS.length], flexShrink: 0 }} />
                        <span style={{ color: "var(--admin-text-muted)" }}>{s.name || "—"}:</span>
                        <span style={{ fontWeight: 700, color: "var(--admin-text)" }}>{Number(s.max) || 0}</span>
                        <span style={{ color: "var(--admin-text-faint)" }}>({totalMax > 0 ? Math.round((Number(s.max) || 0) / totalMax * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* What students see */}
      <div style={{ ...card, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>What Students See (Mobile App)</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          {[
            { label: "Score %", desc: "Their percentage score in each test — calculated from the total uploaded at the time of result entry.", icon: "%" },
            { label: "Rank", desc: "Their rank in the test among all students in the batch who appeared for that test.", icon: "#" },
            { label: "Percentile", desc: "What percentage of students they scored above. 90 percentile means they scored better than 90% of students.", icon: "‰" },
            { label: "Subject Scores", desc: "Breakdown of marks per subject (e.g., Physics: 38/50, Maths: 82/100) — visible for each test.", icon: "≡" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "14px 16px", background: "var(--admin-input-bg)", borderRadius: 12, border: "1px solid var(--admin-card-border)" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--admin-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15, fontWeight: 700, color: "var(--admin-accent)" }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-text)", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "var(--admin-text-faint)", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 8 }}>
        <button
          onClick={handleSave}
          style={{
            padding: "11px 28px", borderRadius: 10, border: "none",
            background: saved ? "#08BD80" : "var(--admin-accent)",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8, transition: "background 0.2s",
          }}
        >
          {saved
            ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Saved!</>
            : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Settings</>
          }
        </button>
      </div>
    </div>
  );
}
