"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// BarcodeDetector is not yet in TypeScript's lib.dom — declare it manually
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(src: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

type ScanStatus = "idle" | "verifying" | "success" | "punch_out" | "already_marked" | "too_soon" | "not_found" | "error";
interface AttendanceResult { studentName: string; time: string; type: "PUNCH_IN" | "PUNCH_OUT"; }

const COOLDOWN_MS = 2000;

function playSound(type: "success" | "punchout" | "warning" | "error") {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    function beep(freq: number, startOffset: number, dur: number, vol = 0.28) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + dur);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + dur + 0.02);
    }
    if (type === "success")  { beep(660, 0, 0.12); beep(880, 0.14, 0.18); }
    if (type === "punchout") { beep(880, 0, 0.12); beep(660, 0.14, 0.18); }
    if (type === "warning")  { beep(440, 0, 0.12); beep(440, 0.18, 0.12); }
    if (type === "error")    { beep(280, 0, 0.30, 0.22); }
  } catch { /* AudioContext unavailable */ }
}

function computeBoxSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return Math.min(420, vh - 300, vw - 32);
}

function useDateTime() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function ScanPage() {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [boxSize, setBoxSize] = useState(380);
  const [camError, setCamError] = useState("");
  const [cooldownPct, setCooldownPct] = useState(0); // 0–100 for progress bar
  const cooldownRaf = useRef<number>(0);

  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const processingRef = useRef(false);
  const now = useDateTime();

  const dateStr = now ? now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "";
  const timeStr = now ? now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : "--:--:-- --";

  useEffect(() => { setBoxSize(computeBoxSize()); }, []);

  useEffect(() => {
    let cancelled = false;
    setCamError("");

    async function openStream(f: "environment" | "user"): Promise<MediaStream> {
      // 1. Try hard constraint (exact) — guarantees the requested camera
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: f }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        });
      } catch { /* exact failed, try soft */ }
      // 2. Soft constraint — browser picks closest match
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: f, width: { ideal: 1280 }, height: { ideal: 1280 } },
        });
      } catch { /* soft failed, try any camera */ }
      // 3. Any available camera
      return navigator.mediaDevices.getUserMedia({ video: true });
    }

    async function startCamera() {
      try {
        const stream = await openStream(facing);
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Use native BarcodeDetector only if it actually supports qr_code format
        let useBarcodeDetector = false;
        if ("BarcodeDetector" in window) {
          try {
            const formats = await (BarcodeDetector as unknown as { getSupportedFormats(): Promise<string[]> }).getSupportedFormats();
            useBarcodeDetector = formats.includes("qr_code");
          } catch { useBarcodeDetector = false; }
        }

        if (useBarcodeDetector) {
          const detector = new BarcodeDetector({ formats: ["qr_code"] });
          scanLoop(detector);
        } else {
          startHtml5Fallback(stream);
        }
      } catch {
        if (!cancelled) setCamError("Could not access camera. Please allow camera permission.");
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  function scanLoop(detector: BarcodeDetector) {
    let detecting = false;
    function tick() {
      animRef.current = requestAnimationFrame(async () => {
        const video = videoRef.current;
        if (!detecting && video && video.readyState >= 2 && video.videoWidth > 0 && !processingRef.current) {
          detecting = true;
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0) await handleScan(codes[0].rawValue);
          } catch { /* ignore single-frame decode errors */ }
          detecting = false;
        }
        tick();
      });
    }
    tick();
  }

  // html5-qrcode fallback (Firefox / older browsers / no BarcodeDetector)
  async function startHtml5Fallback(stream: MediaStream) {
    // Stop our stream — html5-qrcode will open its own
    stream.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;

    const { Html5Qrcode } = await import("html5-qrcode");
    const size = computeBoxSize();
    const scanner = new Html5Qrcode("qr-fallback");
    scanner.start(
      { facingMode: facing },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { fps: 10, qrbox: { width: Math.round(size * 0.75), height: Math.round(size * 0.75) }, disableFlip: true } as any,
      (text: string) => handleScan(text),
      () => {}
    ).then(() => {
      // Style the fallback scanner to fill the box
      setTimeout(() => {
        const root = document.getElementById("qr-fallback");
        if (!root) return;
        Array.from(root.children).forEach(c => {
          const el = c as HTMLElement;
          if (!el.id?.includes("scan_region")) el.style.display = "none";
        });
        const video = root.querySelector("video") as HTMLVideoElement | null;
        if (video) Object.assign(video.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover" });
      }, 400);
    }).catch(() => setCamError("Could not start scanner."));
  }

  async function handleScan(decodedText: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    setStatus("verifying");

    try {
      const res = await fetch("/api/attendance/qr-scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode: decodedText }),
      });
      const data = await res.json();
      if (res.ok) {
        const type: "PUNCH_IN" | "PUNCH_OUT" = data.type === "PUNCH_OUT" ? "PUNCH_OUT" : "PUNCH_IN";
        setResult({ studentName: data.studentName, time: data.time ?? new Date().toLocaleTimeString(), type });
        setStatus(type === "PUNCH_OUT" ? "punch_out" : "success");
        playSound(type === "PUNCH_OUT" ? "punchout" : "success");
      } else if (res.status === 409) {
        if (data.code === "TOO_SOON") {
          setStatus("too_soon"); setErrorMsg(data.message ?? "Please wait before punching out.");
        } else {
          setStatus("already_marked"); setErrorMsg(data.message ?? "Already marked.");
        }
        playSound("warning");
      } else if (res.status === 404) {
        setStatus("not_found"); setErrorMsg("Student not found.");
        playSound("error");
      } else {
        setStatus("error"); setErrorMsg(data.message ?? "Something went wrong.");
        playSound("error");
      }
    } catch {
      setStatus("error"); setErrorMsg("Network error.");
      playSound("error");
    }
    // Animate progress bar from 100% → 0% over COOLDOWN_MS, then unlock scanner
    const start = performance.now();
    cancelAnimationFrame(cooldownRaf.current);
    setCooldownPct(100);
    function animateCooldown() {
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, 1 - elapsed / COOLDOWN_MS);
      setCooldownPct(Math.round(remaining * 100));
      if (elapsed < COOLDOWN_MS) {
        cooldownRaf.current = requestAnimationFrame(animateCooldown);
      } else {
        setStatus("idle"); setResult(null); setErrorMsg(""); processingRef.current = false; setCooldownPct(0);
      }
    }
    cooldownRaf.current = requestAnimationFrame(animateCooldown);
  }

  const borderColor =
    status === "too_soon" ? "#F59E0B" :
    status === "success" ? "#16A34A" :
    status === "punch_out" ? "#2563EB" :
    status === "already_marked" ? "#D97706" :
    status === "not_found" || status === "error" ? "#DC2626" :
    status === "verifying" ? "#7C3AED" :
    "#1FA8E0";

  return (
    <main style={{
      minHeight: "100vh",
      background: "#070B14",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "24px 16px",
      fontFamily: "'Inter', system-ui, sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Background blobs */}
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 340, height: 340, borderRadius: "50%",
        background: "rgba(31,168,224,0.22)",
        filter: "blur(80px)",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "absolute", bottom: -40, left: -60,
        width: 280, height: 280, borderRadius: "50%",
        background: "rgba(79,70,229,0.18)",
        filter: "blur(70px)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* HEADER */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%", position: "relative", zIndex: 1 }}>
        <div style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 20,
          padding: "16px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}>
          <Image src="/kap_fav.png" alt="KAP Edutech" width={180} height={56} priority style={{ height: "clamp(44px,6vh,60px)", width: "auto", objectFit: "contain" }} />
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.50)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>Attendance System</div>
        </div>
        {/* Live session badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#16A34A", boxShadow: "0 0 6px #16A34A" }} />
          <span style={{ color: "#FFFFFF", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, opacity: 0.85 }}>Live Session</span>
        </div>
      </div>

      {/* MAIN CONTENT AREA — tablet: row layout */}
      <div className="scan-content-row" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, position: "relative", zIndex: 1, width: "100%", maxWidth: 960 }}>

        {/* SCANNER COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, flex: 1 }}>
          <div style={{
            position: "relative", width: boxSize, height: boxSize,
            borderRadius: 20, overflow: "hidden",
            border: `2px solid ${borderColor}`,
            boxShadow: status === "idle"
              ? `0 0 40px rgba(31,168,224,0.15), 0 4px 24px rgba(0,0,0,0.40)`
              : `0 0 24px rgba(0,0,0,0.40)`,
            background: "#000",
            transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          }}>
            {/* Native video feed (BarcodeDetector path) */}
            <video
              ref={videoRef}
              muted playsInline autoPlay
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />

            {/* html5-qrcode fallback div — hidden unless needed */}
            <div id="qr-fallback" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

            {/* Scan line animation */}
            {status === "idle" && (
              <div style={{
                position: "absolute", left: "5%", right: "5%", height: 2,
                background: "linear-gradient(90deg, transparent, #1FA8E0, #818CF8, #1FA8E0, transparent)",
                borderRadius: 2, zIndex: 10, pointerEvents: "none",
                animation: "scanline 1.8s ease-in-out infinite",
                boxShadow: "0 0 10px 3px rgba(31,168,224,0.5)",
              }} />
            )}

            {/* Corner accents */}
            {([
              { top: 10, left: 10, borderTop: `3px solid ${borderColor}`, borderLeft: `3px solid ${borderColor}`, borderRadius: "10px 0 0 0" },
              { top: 10, right: 10, borderTop: `3px solid ${borderColor}`, borderRight: `3px solid ${borderColor}`, borderRadius: "0 10px 0 0" },
              { bottom: 10, left: 10, borderBottom: `3px solid ${borderColor}`, borderLeft: `3px solid ${borderColor}`, borderRadius: "0 0 0 10px" },
              { bottom: 10, right: 10, borderBottom: `3px solid ${borderColor}`, borderRight: `3px solid ${borderColor}`, borderRadius: "0 0 10px 0" },
            ] as React.CSSProperties[]).map((s, i) => (
              <div key={i} style={{ position: "absolute", width: 28, height: 28, pointerEvents: "none", zIndex: 10, ...s }} />
            ))}

            {/* Camera error */}
            {camError && (
              <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(7,11,20,0.92)", borderRadius: 18, padding: 24, textAlign: "center" }}>
                <p style={{ color: "#FCA5A5", fontWeight: 600, fontSize: 14 }}>{camError}</p>
              </div>
            )}

            {/* Result overlay */}
            {status !== "idle" && !camError && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 20,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: "rgba(7,11,20,0.92)",
                borderRadius: 18, padding: 28, textAlign: "center",
              }}>
                {status === "verifying" && (
                  <>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "2px solid #7C3AED", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.8s linear infinite" }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    </div>
                    <span style={{ color: "#A78BFA", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>Verifying...</span>
                  </>
                )}

                {status === "success" && result && (
                  <>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "2px solid #16A34A", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <span style={{ color: "#4ADE80", fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, display: "block" }}>Attendance Marked</span>
                    <p style={{ color: "#FFFFFF", fontWeight: 800, fontSize: "clamp(18px,3.5vw,26px)", margin: "0 0 4px" }}>{result.studentName}</p>
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, margin: "0 0 12px" }}>Checked in at <span style={{ color: "#4ADE80", fontWeight: 700 }}>{result.time}</span></p>
                    <div style={{ width: "100%", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.10)", overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ height: "100%", width: `${cooldownPct}%`, background: "#4ADE80", borderRadius: 2, transition: "width 0.05s linear" }} />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                      <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 16px" }}><div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 700 }}>Keep the streak!</div></div>
                      <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 16px" }}><div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 700 }}>Aim for Rank 1!</div></div>
                    </div>
                  </>
                )}

                {status === "punch_out" && result && (
                  <>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "2px solid #2563EB", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    </div>
                    <span style={{ color: "#60A5FA", fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, display: "block" }}>Punched Out</span>
                    <p style={{ color: "#FFFFFF", fontWeight: 800, fontSize: "clamp(18px,3.5vw,26px)", margin: "0 0 4px" }}>{result.studentName}</p>
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, margin: "0 0 12px" }}>Checked out at <span style={{ color: "#60A5FA", fontWeight: 700 }}>{result.time}</span></p>
                    <div style={{ width: "100%", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.10)", overflow: "hidden", marginBottom: 12 }}>
                      <div style={{ height: "100%", width: `${cooldownPct}%`, background: "#60A5FA", borderRadius: 2, transition: "width 0.05s linear" }} />
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "6px 16px" }}><div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 700 }}>See you tomorrow!</div></div>
                  </>
                )}

                {status === "too_soon" && (
                  <>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "2px solid #F59E0B", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <p style={{ color: "#FCD34D", fontWeight: 800, fontSize: 18, margin: "0 0 6px" }}>Too Soon</p>
                    <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, margin: 0, textAlign: "center" }}>{errorMsg}</p>
                  </>
                )}

                {status === "already_marked" && (
                  <>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "2px solid #D97706", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <p style={{ color: "#FCD34D", fontWeight: 800, fontSize: 20, margin: "0 0 6px" }}>Already Marked</p>
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, margin: 0 }}>{errorMsg}</p>
                  </>
                )}

                {(status === "not_found" || status === "error") && (
                  <>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "2px solid #DC2626", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FCA5A5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    </div>
                    <p style={{ color: "#FCA5A5", fontWeight: 800, fontSize: 20, margin: "0 0 6px" }}>{status === "not_found" ? "Not Registered" : "Error"}</p>
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, margin: 0 }}>{errorMsg}</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Below scanner: hint + flip button */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <p style={{ color: "rgba(255,255,255,0.50)", fontSize: 13, margin: 0 }}>
              {status === "idle" ? "Point camera at QR code" : status === "verifying" ? "QR detected — saving..." : "Ready for next student"}
            </p>
            <button
              onClick={() => setFacing(f => f === "environment" ? "user" : "environment")}
              title="Flip camera"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                color: "#FFFFFF", fontSize: 12, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7h-9"/><path d="M14 17H5"/><polyline points="17 4 20 7 17 10"/><polyline points="7 14 4 17 7 20"/>
              </svg>
              {facing === "environment" ? "Back" : "Front"}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL — clock (tablet: shown in panel; mobile: separate bottom block) */}
        <div className="scan-right-panel" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, width: "100%" }}>
          <div style={{
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 20,
            padding: "28px 36px",
            textAlign: "center",
            width: "100%",
            maxWidth: 320,
          }}>
            {/* Status dot */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 16 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: status === "success" ? "#4ADE80" : status === "punch_out" ? "#60A5FA" : status === "verifying" ? "#A78BFA" : (status === "already_marked" || status === "too_soon") ? "#FCD34D" : (status === "not_found" || status === "error") ? "#FCA5A5" : "#1FA8E0",
                boxShadow: `0 0 8px ${status === "success" ? "#4ADE80" : status === "punch_out" ? "#60A5FA" : status === "verifying" ? "#A78BFA" : "#1FA8E0"}`,
              }} />
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
                {status === "idle" ? "Ready" : status === "verifying" ? "Verifying" : status === "success" ? "Marked" : status === "punch_out" ? "Punched Out" : status === "already_marked" ? "Already Marked" : status === "too_soon" ? "Too Soon" : "Error"}
              </span>
            </div>
            <p style={{ fontFamily: "monospace", fontWeight: 800, color: "#FFFFFF", fontSize: "clamp(26px,4vw,40px)", margin: 0, letterSpacing: 3 }}>{timeStr}</p>
            <p style={{ color: "rgba(255,255,255,0.40)", fontSize: "clamp(11px,1.4vw,13px)", margin: "8px 0 0" }}>{dateStr}</p>
          </div>
        </div>
      </div>

      {/* MOBILE FOOTER CLOCK — hidden on tablet via CSS */}
      <div className="scan-footer-clock" style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 14,
          padding: "10px 28px",
        }}>
          <p style={{ fontFamily: "monospace", fontWeight: 800, color: "#FFFFFF", fontSize: "clamp(20px,3.2vw,30px)", margin: 0, letterSpacing: 2 }}>{timeStr}</p>
          <p style={{ color: "rgba(255,255,255,0.40)", fontSize: "clamp(10px,1.4vw,13px)", margin: "3px 0 0" }}>{dateStr}</p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        #qr-fallback > * { display: none !important; }
        #qr-fallback__scan_region { display: block !important; position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; border: none !important; }
        #qr-fallback__scan_region video { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important; object-fit: cover !important; display: block !important; }
        @keyframes scanline {
          0%   { top: 8%; }
          50%  { top: 86%; }
          100% { top: 8%; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* Tablet layout: side by side */
        @media (min-width: 900px) {
          .scan-content-row {
            flex-direction: row !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 40px !important;
          }
          .scan-right-panel {
            display: flex !important;
          }
          .scan-footer-clock {
            display: none !important;
          }
        }

        /* Mobile: hide right panel clock, show footer clock */
        @media (max-width: 899px) {
          .scan-right-panel {
            display: none !important;
          }
          .scan-footer-clock {
            display: block !important;
          }
        }
      `}</style>
    </main>
  );
}
