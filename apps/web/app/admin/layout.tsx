"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  {
    href: "/admin/dashboard", label: "Dashboard",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  },
  {
    href: "/admin/students", label: "Students",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    href: "/admin/attendance", label: "Attendance",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
  },
  {
    href: "/admin/batches", label: "Batches",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    href: "/admin/results", label: "Results",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
  {
    href: "/admin/analytics", label: "Analytics",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
  {
    href: "/admin/qr-codes", label: "QR Codes",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M3 10h4"/><path d="M10 3v4"/><path d="M10 10h.01"/><path d="M14 10h.01"/></svg>,
  },
  {
    href: "/admin/settings", label: "Settings",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sideStats, setSideStats] = useState<{ present: number; total: number } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("admin_dark_mode") === "true";
    setDarkMode(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);

  useEffect(() => {
    if (pathname !== "/admin" && localStorage.getItem("admin_auth") !== "true") {
      router.replace("/admin");
    }
  }, [router, pathname]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (pathname === "/admin") return;

    let id: ReturnType<typeof setInterval> | null = null;

    async function fetchSideStats() {
      try {
        const res = await fetch("/api/admin/stats/today");
        if (res.ok) setSideStats(await res.json());
      } catch {}
    }

    const start = () => { if (!id) id = setInterval(fetchSideStats, 60000); };
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    const onVisibilityChange = () => {
      if (document.hidden) { stop(); return; }
      fetchSideStats();
      start();
    };

    fetchSideStats();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [pathname]);

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("admin_dark_mode", String(next));
    document.documentElement.classList.toggle("dark", next);
  }

  function handleLogout() {
    localStorage.removeItem("admin_auth");
    router.replace("/admin");
  }

  if (pathname === "/admin") return <>{children}</>;

  const activeLabel = NAV.find(n => pathname.startsWith(n.href))?.label ?? "Admin";

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "var(--font-geist-sans,'Geist',system-ui,sans-serif)", background: "var(--admin-bg)" }}>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="sidebar-overlay open"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? " open" : ""}`}>

        {/* Logo — original KAP logo image */}
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Image src="/kap_logo_transparent.png" alt="KAP Edutech" width={148} height={48} style={{ objectFit: "contain", width: "100%", height: "auto", maxHeight: 48, filter: "brightness(0) invert(1)" }} priority />
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase" }}>Admin Portal</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.28)", letterSpacing: 1.5, textTransform: "uppercase", padding: "4px 8px 8px" }}>Navigation</div>
          {NAV.map(item => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                <motion.div
                  whileHover={{ x: active ? 0 : 2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 10px", borderRadius: 8,
                    fontSize: 13, fontWeight: active ? 600 : 450,
                    background: active ? "linear-gradient(90deg, rgba(8,189,128,0.20), rgba(8,189,128,0.07))" : "transparent",
                    color: active ? "#ffffff" : "rgba(255,255,255,0.58)",
                    borderLeft: `2.5px solid ${active ? "#08BD80" : "transparent"}`,
                    transition: "background 0.15s, color 0.15s",
                    position: "relative",
                  }}
                >
                  <span style={{ flexShrink: 0, color: active ? "#08BD80" : "rgba(255,255,255,0.45)" }}>{item.icon}</span>
                  {item.label}
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      style={{ position: "absolute", right: 10, width: 5, height: 5, borderRadius: "50%", background: "#08BD80", boxShadow: "0 0 8px rgba(8,189,128,0.7)" }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Today's attendance mini card */}
        {sideStats && (
          <div style={{
            margin: "0 10px 8px",
            borderRadius: 12,
            background: "radial-gradient(circle at 100% 0%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(circle at 0% 100%, rgba(8,189,128,0.14), transparent 55%), rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            padding: "12px 14px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Today&apos;s Attendance</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 7 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-1px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{sideStats.present}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.38)" }}>/ {sideStats.total}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#08BD80" }}>
                {sideStats.total > 0 ? Math.round(sideStats.present / sideStats.total * 100) : 0}%
              </span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${sideStats.total > 0 ? Math.round(sideStats.present / sideStats.total * 100) : 0}%`,
                background: "linear-gradient(90deg, #08BD80, #34D399)",
                borderRadius: 999, transition: "width 1s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.32)", marginTop: 5 }}>
              <span>Present</span>
              <span>{sideStats.total - sideStats.present} absent</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "8px 10px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Admin identity */}
          <div style={{ padding: "8px 10px 10px", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(8,189,128,0.18)", border: "1px solid rgba(8,189,128,0.30)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#08BD80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#fff", fontWeight: 600, lineHeight: 1.2 }}>Admin</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Signed in</div>
              </div>
              {/* Live indicator */}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#08BD80", display: "inline-block", boxShadow: "0 0 6px rgba(8,189,128,0.8)" }} />
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>LIVE</span>
              </div>
            </div>
          </div>

          {/* Dark/light + sign out in one row */}
          <div style={{ display: "flex", gap: 6 }}>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={toggleDark}
              style={{
                flex: 1, padding: "8px 10px", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 9, background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.50)", fontSize: 11, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {darkMode
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
              {darkMode ? "Light" : "Dark"}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleLogout}
              style={{
                flex: 1, padding: "8px 10px", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 9, background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.50)", fontSize: 11, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </motion.button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main">
        {/* Mobile topbar */}
        <div className="admin-topbar">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ background: "none", border: "none", padding: 6, cursor: "pointer", borderRadius: 8, color: "var(--admin-text)", display: "flex" }}
            aria-label="Menu"
          >
            {sidebarOpen
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            }
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.2px" }}>{activeLabel}</span>
          <Image src="/kap_fav.png" alt="KAP" width={76} height={26} style={{ height: 26, width: "auto", objectFit: "contain" }} />
          <button onClick={toggleDark} style={{ background: "none", border: "none", padding: 6, cursor: "pointer", color: "var(--admin-text-muted)", display: "flex", borderRadius: 8 }}>
            {darkMode
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}
