"use client";

import React, {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import {
  motion, AnimatePresence,
  useMotionValue, useSpring, useTransform,
} from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, MagnifyingGlass, X, CalendarCheck,
  Trophy, Student, ChartBar, TrendUp, TrendDown, Minus,
} from "@phosphor-icons/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type TestResult = {
  testName: string; testDate: string;
  rank: number | null; total: number;
  percentage: number; percentile: number | null;
  scores: Record<string, number>; totalInBatch: number | null;
};
type StudentData = {
  id: string; name: string; enrollmentNo: string; batch: string;
  attendancePct: number; presentDays: number; totalWorkingDays: number;
  lastSeen: string | null; results: TestResult[];
};
type BatchDetail = {
  batchName: string; totalStudents: number;
  totalWorkingDays: number; students: StudentData[];
};

// ── Palette & helpers ─────────────────────────────────────────────────────────

const PALETTE = ["#1D6BF3","#7C3AED","#0D9488","#B45309","#0891B2","#BE185D","#16A34A","#DC2626"];

function batchAccent(name: string) {
  return PALETTE[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
}
function studentColor(name: string) {
  return PALETTE[(name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % PALETTE.length];
}
function attColor(p: number) { return p >= 75 ? "#16A34A" : p >= 50 ? "#D97706" : "#DC2626"; }
function attBg(p: number)    { return p >= 75 ? "rgba(22,163,74,0.1)" : p >= 50 ? "rgba(217,119,6,0.1)" : "rgba(220,38,38,0.1)"; }
function scoreColor(p: number) { return p >= 70 ? "#16A34A" : p >= 50 ? "#D97706" : "#DC2626"; }
function initials(n: string)   { return n.trim().split(/\s+/).slice(0,2).map(w => w[0]).join("").toUpperCase(); }
function fmtDate(d: string)    { return new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"2-digit"}); }
function fmtAgo(ts: string | null) {
  if (!ts) return "Never";
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return "Today"; if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-IN",{day:"numeric",month:"short"});
}

const sp     = { type:"spring" as const, stiffness:100, damping:22 };
const fastSp = { type:"spring" as const, stiffness:300, damping:34 };

// ── SpotlightCard — zero-rerender glow following cursor ───────────────────────

const SpotlightCard = React.memo(function SpotlightCard({
  children, accent, onClick, style,
}: { children: React.ReactNode; accent: string; onClick?: () => void; style?: React.CSSProperties }) {
  const ref   = useRef<HTMLDivElement>(null);
  const glow  = useRef<HTMLDivElement>(null);

  const move = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || !glow.current) return;
    const r = ref.current.getBoundingClientRect();
    glow.current.style.opacity = "1";
    glow.current.style.background =
      `radial-gradient(280px circle at ${e.clientX-r.left}px ${e.clientY-r.top}px, ${accent}22, transparent 62%)`;
  }, [accent]);

  const leave = useCallback(() => {
    if (glow.current) glow.current.style.opacity = "0";
  }, []);

  return (
    <div ref={ref} onMouseMove={move} onMouseLeave={leave} onClick={onClick} style={{ position:"relative", ...style }}>
      <div ref={glow} style={{
        position:"absolute", inset:0, borderRadius:"inherit",
        pointerEvents:"none", opacity:0,
        transition:"opacity 0.3s ease", zIndex:10,
      }} />
      {children}
    </div>
  );
});

// ── AnimatedNumber — spring count-up, no re-renders ───────────────────────────

const AnimatedNumber = React.memo(function AnimatedNumber({
  target, suffix="",
}: { target: number; suffix?: string }) {
  const mv  = useMotionValue(0);
  const sv  = useSpring(mv, { stiffness:65, damping:20 });
  const out = useTransform(sv, v => Math.round(v));
  useEffect(() => { const t = setTimeout(() => mv.set(target), 120); return () => clearTimeout(t); }, [target, mv]);
  return <><motion.span style={{ fontVariantNumeric:"tabular-nums" }}>{out}</motion.span>{suffix}</>;
});

// ── Recharts tooltip ──────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: Record<string,unknown>) {
  if (!(active as boolean) || !(payload as unknown[])?.length) return null;
  return (
    <div style={{ background:"var(--admin-card-bg)", border:"1px solid var(--admin-card-border)", borderRadius:10, padding:"8px 14px", fontSize:12, boxShadow:"0 8px 24px rgba(0,0,0,0.12)" }}>
      <div style={{ color:"var(--admin-text-muted)", marginBottom:2 }}>{label as string}</div>
      <div style={{ color:"var(--admin-text)", fontWeight:600 }}>{((payload as {value:number}[])[0])?.value}</div>
    </div>
  );
}

// ── Student Detail Panel ──────────────────────────────────────────────────────

const StudentPanel = React.memo(function StudentPanel({
  student, accent, onClose,
}: { student: StudentData; accent: string; onClose: () => void }) {
  const [openTest, setOpenTest] = useState<string|null>(null);
  const att = student.attendancePct;

  const subjectAvgs = useMemo(() => {
    const tot: Record<string,{sum:number;count:number}> = {};
    for (const r of student.results) {
      for (const [s, v] of Object.entries(r.scores)) {
        if (!tot[s]) tot[s] = { sum:0, count:0 };
        tot[s].sum += v; tot[s].count++;
      }
    }
    return Object.entries(tot).map(([subject, d]) => ({ subject, avg: Math.round(d.sum/d.count) }));
  }, [student.results]);

  const avgScore = student.results.length
    ? Math.round(student.results.reduce((s,r) => s + r.percentage, 0) / student.results.length) : null;
  const bestRank = student.results.reduce<number|null>((b,r) => r.rank != null && (b===null||r.rank<b) ? r.rank : b, null);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        transition={{ duration:0.2 }}
        onClick={onClose}
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(6px)", zIndex:50 }}
      />

      {/* Panel */}
      <motion.div
        initial={{ x:"100%", opacity:0.6 }}
        animate={{ x:0, opacity:1 }}
        exit={{ x:"100%", opacity:0 }}
        transition={fastSp}
        style={{
          position:"fixed", top:0, right:0, bottom:0,
          width:"min(520px, 100vw)",
          background:"var(--admin-card-bg)",
          borderLeft:"1px solid var(--admin-card-border)",
          boxShadow:"-24px 0 64px rgba(0,0,0,0.18)",
          zIndex:51, display:"flex", flexDirection:"column",
        }}
      >
        {/* Accent gradient top */}
        <div style={{ height:3, background:`linear-gradient(90deg,${accent},${accent}55,transparent)`, flexShrink:0 }} />

        {/* Header */}
        <div style={{ padding:"20px 22px 16px", borderBottom:"1px solid var(--admin-card-border)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:16 }}>
            <div style={{
              width:50, height:50, borderRadius:14,
              background:`${accent}15`, color:accent,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:16, fontWeight:700, flexShrink:0, letterSpacing:"0.5px",
            }}>{initials(student.name)}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:18, fontWeight:700, color:"var(--admin-text)", letterSpacing:"-0.4px", lineHeight:1.2 }}>{student.name}</div>
              <div style={{ fontSize:12, color:"var(--admin-text-muted)", marginTop:3 }}>{student.enrollmentNo} · {student.batch}</div>
            </div>
            <motion.button
              whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
              onClick={onClose}
              style={{ background:"var(--admin-input-bg)", border:"1px solid var(--admin-card-border)", borderRadius:10, padding:7, cursor:"pointer", color:"var(--admin-text-muted)", display:"flex", flexShrink:0 }}
            >
              <X size={15} weight="bold" />
            </motion.button>
          </div>

          {/* Quick stat pills */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {[
              { label:"Attendance", val:`${att}%`, color:attColor(att), bg:attBg(att) },
              { label:"Avg Score", val:avgScore!=null?`${avgScore}%`:"—", color:avgScore?scoreColor(avgScore):"var(--admin-text-faint)", bg:avgScore?`${scoreColor(avgScore)}12`:"var(--admin-input-bg)" },
              { label:"Best Rank", val:bestRank?`#${bestRank}`:"—", color:"#1D6BF3", bg:"rgba(29,107,243,0.08)" },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, borderRadius:12, padding:"11px 12px", border:"1px solid var(--admin-card-border)" }}>
                <div style={{ fontSize:17, fontWeight:700, color:s.color, letterSpacing:"-0.3px", fontVariantNumeric:"tabular-nums" }}>{s.val}</div>
                <div style={{ fontSize:10, color:"var(--admin-text-faint)", marginTop:2, fontWeight:500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 22px", display:"flex", flexDirection:"column", gap:22 }}>

          {/* Attendance detail */}
          <section>
            <div style={{ fontSize:10, fontWeight:700, color:"var(--admin-text-faint)", textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>Attendance (30 days)</div>
            <div style={{ background:"var(--admin-input-bg)", borderRadius:14, padding:"14px 16px", border:"1px solid var(--admin-card-border)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:13, color:"var(--admin-text-muted)" }}>{student.presentDays} of {student.totalWorkingDays} days</span>
                <span style={{ fontSize:14, fontWeight:700, color:attColor(att), fontVariantNumeric:"tabular-nums" }}>{att}%</span>
              </div>
              <div style={{ height:8, background:"var(--admin-card-border)", borderRadius:100, overflow:"hidden" }}>
                <motion.div
                  initial={{ scaleX:0 }} animate={{ scaleX:att/100 }}
                  transition={{ duration:0.9, ease:[0.16,1,0.3,1] }}
                  style={{
                    height:"100%", width:"100%",
                    background:`linear-gradient(90deg,${attColor(att)},${attColor(att)}80)`,
                    borderRadius:100, transformOrigin:"left center",
                  }}
                />
              </div>
              <div style={{ fontSize:11, color:"var(--admin-text-faint)", marginTop:7 }}>Last seen: {fmtAgo(student.lastSeen)}</div>
            </div>
          </section>

          {/* Subject bar chart */}
          {subjectAvgs.length > 0 && (
            <section>
              <div style={{ fontSize:10, fontWeight:700, color:"var(--admin-text-faint)", textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>Subject Averages</div>
              <div style={{ background:"var(--admin-input-bg)", borderRadius:14, padding:"12px 14px", border:"1px solid var(--admin-card-border)" }}>
                <ResponsiveContainer width="100%" height={108}>
                  <BarChart data={subjectAvgs} barSize={24} margin={{ top:4, right:0, bottom:0, left:-22 }}>
                    <XAxis dataKey="subject" tick={{ fontSize:10, fill:"var(--admin-text-muted)" as string }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:9, fill:"var(--admin-text-faint)" as string }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="avg" radius={[5,5,0,0]}>
                      {subjectAvgs.map((e,i) => <Cell key={e.subject} fill={PALETTE[i%PALETTE.length]} fillOpacity={0.88} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Test history */}
          <section>
            <div style={{ fontSize:10, fontWeight:700, color:"var(--admin-text-faint)", textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>
              Test History · {student.results.length}
            </div>
            {student.results.length === 0 ? (
              <div style={{ background:"var(--admin-input-bg)", borderRadius:14, padding:"28px 16px", textAlign:"center", border:"1px dashed var(--admin-card-border)" }}>
                <Trophy size={28} weight="thin" style={{ color:"var(--admin-text-faint)" as string, marginBottom:8 }} />
                <p style={{ color:"var(--admin-text-faint)", margin:0, fontSize:13 }}>No tests recorded</p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {student.results.map((r, idx) => {
                  const key = `${r.testName}-${r.testDate}`;
                  const open = openTest === key;
                  const entries = Object.entries(r.scores);
                  const perSubj = r.total / (entries.length || 1);
                  return (
                    <motion.div key={key} layout initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ ...sp, delay:idx*0.04 }}
                      style={{ background:"var(--admin-input-bg)", borderRadius:13, border:"1px solid var(--admin-card-border)", overflow:"hidden" }}
                    >
                      <div onClick={() => setOpenTest(open?null:key)}
                        style={{ padding:"12px 15px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}
                      >
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--admin-text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.testName}</div>
                          <div style={{ fontSize:10, color:"var(--admin-text-faint)", marginTop:1 }}>{fmtDate(r.testDate)}</div>
                        </div>
                        {r.rank && (
                          <span style={{ fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:100, background:r.rank===1?"rgba(217,119,6,0.12)":"var(--admin-card-border)", color:r.rank===1?"#B45309":"var(--admin-text-muted)", flexShrink:0 }}>
                            #{r.rank}
                          </span>
                        )}
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <div style={{ fontSize:15, fontWeight:700, color:scoreColor(r.percentage), fontVariantNumeric:"tabular-nums" }}>{r.percentage.toFixed(1)}%</div>
                          {r.percentile!=null && <div style={{ fontSize:10, color:"var(--admin-text-faint)" }}>{r.percentile}p</div>}
                        </div>
                        <motion.span animate={{ rotate:open?180:0 }} transition={{ duration:0.2 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--admin-text-faint)" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </motion.span>
                      </div>

                      <AnimatePresence>
                        {open && (
                          <motion.div
                            initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
                            exit={{ height:0, opacity:0 }} transition={{ duration:0.22, ease:"easeInOut" }}
                            style={{ overflow:"hidden" }}
                          >
                            <div style={{ padding:"2px 15px 14px", borderTop:"1px solid var(--admin-card-border)" }}>
                              <div style={{ paddingTop:12, display:"flex", flexDirection:"column", gap:9 }}>
                                {entries.map(([subj, score]) => {
                                  const pct = Math.min(100, Math.round((score / perSubj) * 100));
                                  return (
                                    <div key={subj}>
                                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                                        <span style={{ fontSize:12, color:"var(--admin-text-muted)" }}>{subj}</span>
                                        <span style={{ fontSize:12, fontWeight:600, color:"var(--admin-text)", fontVariantNumeric:"tabular-nums" }}>{score}</span>
                                      </div>
                                      <div style={{ height:4, background:"var(--admin-card-border)", borderRadius:100, overflow:"hidden" }}>
                                        <motion.div
                                          initial={{ scaleX:0 }} animate={{ scaleX:pct/100 }}
                                          transition={{ duration:0.65, ease:[0.16,1,0.3,1] }}
                                          style={{ height:"100%", width:"100%", borderRadius:100, background:scoreColor(pct), transformOrigin:"left center" }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                                <div style={{ display:"flex", justifyContent:"space-between", paddingTop:6, marginTop:2, borderTop:"1px solid var(--admin-card-border)" }}>
                                  <span style={{ fontSize:11, color:"var(--admin-text-faint)" }}>Total {r.total}</span>
                                  {r.rank&&r.totalInBatch&&<span style={{ fontSize:11, color:"var(--admin-text-faint)" }}>Rank {r.rank}/{r.totalInBatch}</span>}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </>
  );
});

// ── Stagger variants ──────────────────────────────────────────────────────────

const grid  = { hidden:{}, show:{ transition:{ staggerChildren:0.045, delayChildren:0.05 } } };
const card  = { hidden:{ opacity:0, y:18, scale:0.97 }, show:{ opacity:1, y:0, scale:1, transition:sp } };

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BatchDetailPage() {
  const params    = useParams();
  const router    = useRouter();
  const batchName = decodeURIComponent(params["name"] as string);
  const accent    = batchAccent(batchName);

  const [data,    setData]    = useState<BatchDetail|null>(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [sortBy,  setSortBy]  = useState<"name"|"attendance"|"score">("attendance");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  useEffect(() => {
    fetch(`/api/admin/batches/detail/${encodeURIComponent(batchName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [batchName]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = [...data.students];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || s.enrollmentNo.toLowerCase().includes(q));
    list.sort((a, b) => {
      if (sortBy === "name") return sortDir==="asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      const av = sortBy==="score" ? (a.results[0]?.percentage ?? -1) : a.attendancePct;
      const bv = sortBy==="score" ? (b.results[0]?.percentage ?? -1) : b.attendancePct;
      return sortDir==="desc" ? bv-av : av-bv;
    });
    return list;
  }, [data, search, sortBy, sortDir]);

  const stats = useMemo(() => {
    if (!data) return null;
    const atts = data.students.map(s => s.attendancePct);
    const avgAtt = atts.length ? Math.round(atts.reduce((a,b)=>a+b,0)/atts.length) : 0;
    const below75 = atts.filter(a => a < 75).length;
    const allR = data.students.flatMap(s => s.results);
    const avgScore = allR.length ? Math.round(allR.reduce((a,r)=>a+r.percentage,0)/allR.length) : null;
    const tests = new Set(allR.map(r=>r.testName)).size;
    return { avgAtt, below75, avgScore, tests };
  }, [data]);

  function toggleSort(by: "name"|"attendance"|"score") {
    if (sortBy===by) setSortDir(d => d==="asc"?"desc":"asc");
    else { setSortBy(by); setSortDir("desc"); }
  }

  return (
    <div style={{
      padding:"28px 32px 64px", minHeight:"100vh",
      fontFamily:"var(--font-geist-sans,'Geist',system-ui,sans-serif)",
    }}>

      {/* Back button */}
      <motion.button
        initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ ...sp, delay:0.04 }}
        whileHover={{ x:-2 }} whileTap={{ scale:0.97 }}
        onClick={() => router.back()}
        style={{ display:"inline-flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:"var(--admin-text-muted)", fontSize:13, fontWeight:500, padding:"4px 0", marginBottom:24 }}
      >
        <ArrowLeft size={14} weight="bold" /> Back to Batches
      </motion.button>

      {/* Page header */}
      <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ ...sp, delay:0.07 }}
        style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28, flexWrap:"wrap" }}
      >
        <div style={{ width:46, height:46, borderRadius:14, background:`${accent}15`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Student size={21} weight="bold" color={accent} />
        </div>
        <div>
          <h1 style={{ fontSize:23, fontWeight:700, color:"var(--admin-text)", margin:0, letterSpacing:"-0.5px" }}>{batchName}</h1>
          {data && <p style={{ color:"var(--admin-text-muted)", fontSize:13, margin:"3px 0 0" }}>{data.totalStudents} students · {data.totalWorkingDays} working days</p>}
        </div>
      </motion.div>

      {/* Stat cards */}
      {(stats || loading) && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:12, marginBottom:28 }}>
          {loading
            ? Array.from({length:4}).map((_,i) => (
                <div key={i} style={{ background:"var(--admin-card-bg)", borderRadius:18, border:"1px solid var(--admin-card-border)", padding:"20px 22px", height:90 }}>
                  <div className="admin-skeleton" style={{ height:10, width:"60%", marginBottom:10 }} />
                  <div className="admin-skeleton" style={{ height:26, width:"45%" }} />
                </div>
              ))
            : stats && [
                { label:"Avg Attendance", val:stats.avgAtt, sfx:"%", color:attColor(stats.avgAtt), bg:attBg(stats.avgAtt), sub:"Last 30 days" },
                { label:"Below 75%", val:stats.below75, sfx:"", color:stats.below75>0?"#DC2626":"#16A34A", bg:stats.below75>0?"rgba(220,38,38,0.09)":"rgba(22,163,74,0.09)", sub:`of ${data?.totalStudents} students` },
                { label:"Avg Score", val:stats.avgScore??0, sfx:stats.avgScore!=null?"%":"", color:stats.avgScore?scoreColor(stats.avgScore):"var(--admin-text-faint)" as string, bg:"var(--admin-input-bg)", sub:"All tests" },
                { label:"Tests", val:stats.tests, sfx:"", color:accent, bg:`${accent}0D`, sub:"Uploaded" },
              ].map((s,i) => (
                <motion.div key={s.label}
                  initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ ...sp, delay:i*0.06+0.1 }}
                  style={{ background:s.bg, borderRadius:18, border:"1px solid var(--admin-card-border)", padding:"20px 22px" }}
                >
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--admin-text-faint)", textTransform:"uppercase", letterSpacing:"0.9px", marginBottom:8 }}>{s.label}</div>
                  <div style={{ fontSize:28, fontWeight:700, color:s.color, letterSpacing:"-0.6px", lineHeight:1 }}>
                    <AnimatedNumber target={s.val} suffix={s.sfx} />
                  </div>
                  <div style={{ fontSize:11, color:"var(--admin-text-faint)", marginTop:5 }}>{s.sub}</div>
                </motion.div>
              ))
          }
        </div>
      )}

      {/* Search + Sort */}
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.28 }}
        style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}
      >
        <div style={{ flex:1, minWidth:220, position:"relative", display:"flex", alignItems:"center" }}>
          <MagnifyingGlass size={14} style={{ position:"absolute", left:12, color:"var(--admin-text-faint)" as string, pointerEvents:"none" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search students..."
            style={{
              width:"100%", padding:"9px 12px 9px 34px",
              border:"1px solid var(--admin-card-border)", borderRadius:12,
              fontSize:13, outline:"none",
              background:"var(--admin-card-bg)", color:"var(--admin-text)",
              transition:"border-color 0.15s",
            }}
            onFocus={e => { e.target.style.borderColor = accent; }}
            onBlur={e =>  { e.target.style.borderColor = "var(--admin-card-border)"; }}
          />
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {([
            { k:"attendance" as const, l:"Attendance" },
            { k:"score"      as const, l:"Score"      },
            { k:"name"       as const, l:"Name"       },
          ]).map(({ k, l }) => (
            <motion.button key={k} onClick={() => toggleSort(k)} whileTap={{ scale:0.97 }}
              style={{
                padding:"8px 14px", borderRadius:12, fontSize:12, fontWeight:600,
                border:"1px solid var(--admin-card-border)",
                background: sortBy===k ? accent : "var(--admin-card-bg)",
                color: sortBy===k ? "#fff" : "var(--admin-text-muted)",
                cursor:"pointer", display:"flex", alignItems:"center", gap:5,
                transition:"background 0.15s, color 0.15s",
              }}
            >
              {sortBy===k ? (sortDir==="desc" ? <TrendDown size={11} weight="bold"/> : <TrendUp size={11} weight="bold"/>) : <Minus size={11} style={{ opacity:0.35 }}/>}
              {l}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Student grid */}
      {loading ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:14 }}>
          {Array.from({length:6}).map((_,i) => (
            <div key={i} style={{ background:"var(--admin-card-bg)", borderRadius:20, border:"1px solid var(--admin-card-border)", padding:22, height:200 }}>
              <div style={{ display:"flex", gap:12, marginBottom:16 }}>
                <div className="admin-skeleton" style={{ width:44, height:44, borderRadius:13, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div className="admin-skeleton" style={{ height:12, width:"65%", marginBottom:8 }} />
                  <div className="admin-skeleton" style={{ height:10, width:"42%" }} />
                </div>
              </div>
              <div className="admin-skeleton" style={{ height:5, borderRadius:100, marginBottom:12 }} />
              <div className="admin-skeleton" style={{ height:54, borderRadius:12 }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
          style={{ background:"var(--admin-card-bg)", borderRadius:20, border:"1px dashed var(--admin-card-border)", padding:60, textAlign:"center" }}
        >
          <Student size={36} weight="thin" style={{ color:"var(--admin-text-faint)" as string, marginBottom:10 }} />
          <p style={{ color:"var(--admin-text-faint)", margin:0, fontSize:14 }}>
            {search ? `No students match "${search}"` : "No students in this batch yet"}
          </p>
        </motion.div>
      ) : (
        <motion.div variants={grid} initial="hidden" animate="show"
          style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:14 }}
        >
          {filtered.map((student, i) => {
            const att    = student.attendancePct;
            const latest = student.results[0];
            const color  = studentColor(student.name);

            return (
              <motion.div key={student.id} variants={card} layout>
                <SpotlightCard
                  accent={color}
                  onClick={() => router.push(`/admin/students/${student.id}`)}
                  style={{
                    borderRadius:20,
                    background:"var(--admin-card-bg)",
                    border:"1px solid var(--admin-card-border)",
                    boxShadow:"0 1px 4px rgba(0,0,0,0.04)",
                    overflow:"hidden",
                    cursor:"pointer",
                    transition:"transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s cubic-bezier(0.16,1,0.3,1)",
                  }}
                  // hover handled via CSS class below
                >
                  <div className="hover-lift" style={{ pointerEvents:"none", position:"absolute", inset:0, borderRadius:"inherit" }} />
                  {/* Gradient accent strip */}
                  <div style={{ height:2, background:`linear-gradient(90deg,${color},${color}55,transparent)` }} />

                  <div style={{ padding:"18px 20px" }}>
                    {/* Avatar + name */}
                    <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:15 }}>
                      <div style={{
                        width:42, height:42, borderRadius:13,
                        background:`${color}14`, color,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:13, fontWeight:700, flexShrink:0, letterSpacing:"0.5px",
                      }}>
                        {initials(student.name)}
                      </div>
                      <div style={{ minWidth:0, flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:"var(--admin-text)", letterSpacing:"-0.2px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {student.name}
                        </div>
                        <div style={{ fontSize:11, color:"var(--admin-text-faint)", marginTop:1 }}>{student.enrollmentNo}</div>
                      </div>
                    </div>

                    {/* Attendance bar */}
                    <div style={{ marginBottom:13 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                        <span style={{ fontSize:11, color:"var(--admin-text-faint)", fontWeight:500 }}>Attendance</span>
                        <span style={{ fontSize:12, fontWeight:700, color:attColor(att), fontVariantNumeric:"tabular-nums" }}>{att}%</span>
                      </div>
                      <div style={{ height:5, background:"var(--admin-card-border)", borderRadius:100, overflow:"hidden" }}>
                        <motion.div
                          initial={{ scaleX:0 }}
                          animate={{ scaleX:att/100 }}
                          transition={{ duration:0.88, ease:[0.16,1,0.3,1], delay:0.08+i*0.018 }}
                          style={{
                            height:"100%", width:"100%", borderRadius:100,
                            background:`linear-gradient(90deg,${attColor(att)},${attColor(att)}70)`,
                            transformOrigin:"left center",
                          }}
                        />
                      </div>
                      <div style={{ fontSize:10, color:"var(--admin-text-faint)", marginTop:4 }}>{student.presentDays}/{student.totalWorkingDays} days</div>
                    </div>

                    {/* Latest result */}
                    <div style={{
                      background:"var(--admin-input-bg)",
                      borderRadius:12, padding:"10px 13px",
                      border:"1px solid var(--admin-card-border)",
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                    }}>
                      {latest ? (
                        <>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:10, color:"var(--admin-text-faint)", marginBottom:1 }}>Latest</div>
                            <div style={{ fontSize:12, fontWeight:600, color:"var(--admin-text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:130 }}>{latest.testName}</div>
                          </div>
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            <div style={{ fontSize:15, fontWeight:700, color:scoreColor(latest.percentage), fontVariantNumeric:"tabular-nums" }}>{latest.percentage.toFixed(1)}%</div>
                            {latest.rank && <div style={{ fontSize:10, color:"var(--admin-text-faint)" }}>#{latest.rank}/{latest.totalInBatch}</div>}
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize:12, color:"var(--admin-text-faint)", width:"100%", textAlign:"center" }}>No tests yet</span>
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:11 }}>
                      <span style={{ fontSize:11, color:"var(--admin-text-faint)" }}>{student.results.length} test{student.results.length!==1?"s":""}</span>
                      <span style={{ fontSize:11, color:"var(--admin-text-faint)" }}>{fmtAgo(student.lastSeen)}</span>
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}

    </div>
  );
}
