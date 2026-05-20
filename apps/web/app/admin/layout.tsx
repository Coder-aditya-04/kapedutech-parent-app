"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, X } from "@phosphor-icons/react";

const NAV = [
  {
    href: "/admin/dashboard", label: "Dashboard",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  },
  {
    href: "/admin/students", label: "Students",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    href: "/admin/attendance", label: "Attendance",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    href: "/admin/batches", label: "Batches",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  },
  {
    href: "/admin/results", label: "Results",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
  {
    href: "/admin/analytics", label: "Analytics",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
  {
    href: "/admin/qr-codes", label: "QR Codes",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M3 10h4"/><path d="M10 3v4"/><path d="M10 10h.01"/><path d="M14 10h.01"/></svg>,
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
    async function fetchSideStats() {
      try {
        const [aRes, sRes] = await Promise.all([
          fetch("/api/admin/attendance/today"),
          fetch("/api/admin/students"),
        ]);
        const att: { type: string; studentId: string }[] = aRes.ok ? await aRes.json() : [];
        const stu: unknown[] = sRes.ok ? await sRes.json() : [];
        const present = new Set(att.filter(r => r.type === "PUNCH_IN").map(r => r.studentId)).size;
        setSideStats({ present, total: stu.length });
      } catch {}
    }
    fetchSideStats();
    const id = setInterval(fetchSideStats, 30000);
    return () => clearInterval(id);
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

        {/* Logo area — always on dark bg */}
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Image src="/kap_logo_transparent.png" alt="KAP Edutech" width={148} height={48} style={{ objectFit: "contain", width: "100%", height: "auto", maxHeight: 48, filter: "brightness(0) invert(1)" }} priority />
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase" }}>Admin Portal</span>
        </div>

        {/* Nav — always light text since sidebar is always dark */}
        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: 1.5, textTransform: "uppercase", padding: "8px 10px 6px" }}>Navigation</div>
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
                    padding: "9px 12px", borderRadius: 8,
                    fontSize: 13, fontWeight: active ? 600 : 450,
                    background: active ? "linear-gradient(90deg, rgba(8,189,128,0.18), rgba(8,189,128,0.06))" : "transparent",
                    color: active ? "#ffffff" : "rgba(255,255,255,0.60)",
                    borderLeft: `2.5px solid ${active ? "#08BD80" : "transparent"}`,
                    transition: "background 0.15s, color 0.15s",
                    position: "relative",
                  }}
                >
                  <span style={{ flexShrink: 0, color: active ? "#08BD80" : "rgba(255,255,255,0.50)" }}>{item.icon}</span>
                  {item.label}
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      style={{
                        position: "absolute", right: 10,
                        width: 5, height: 5, borderRadius: "50%",
                        background: "#08BD80",
                        boxShadow: "0 0 8px rgba(8,189,128,0.7)",
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Mini attendance snap card — AI Caller style */}
        {sideStats && (
          <div style={{
            margin: "0 8px 8px",
            borderRadius: 12,
            background: "radial-gradient(circle at 100% 0%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(circle at 0% 100%, rgba(8,189,128,0.14), transparent 55%), rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            padding: "12px 14px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.38)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 9 }}>Today&apos;s Attendance</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: "-1px", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{sideStats.present}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.40)", letterSpacing: 0 }}>/ {sideStats.total}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#08BD80" }}>
                {sideStats.total > 0 ? Math.round(sideStats.present / sideStats.total * 100) : 0}%
              </span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
              <div style={{
                height: "100%",
                width: `${sideStats.total > 0 ? Math.round(sideStats.present / sideStats.total * 100) : 0}%`,
                background: "linear-gradient(90deg, #08BD80, #34D399)",
                borderRadius: 999, transition: "width 1s ease",
                boxShadow: "0 0 8px rgba(8,189,128,0.5)",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.38)" }}>
              <span>Present</span>
              <span>{sideStats.total - sideStats.present} absent</span>
            </div>
          </div>
        )}

        {/* Footer — always dark sidebar context */}
        <div style={{ padding: "10px 8px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", marginBottom: 6, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: 0.8 }}>Signed in as</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 600, marginTop: 2 }}>Admin</div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={toggleDark}
            style={{
              width: "100%", padding: "8px 12px", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10, background: "transparent",
              color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 500, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
            }}
          >
            {darkMode ? <Sun size={14} weight="bold" /> : <Moon size={14} weight="bold" />}
            {darkMode ? "Light Mode" : "Dark Mode"}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            style={{
              width: "100%", padding: "8px 12px", border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10, background: "transparent",
              color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 500, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </motion.button>
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
              ? <X size={22} weight="bold" />
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            }
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)", letterSpacing: "-0.2px" }}>{activeLabel}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={toggleDark} style={{ background: "none", border: "none", padding: 6, cursor: "pointer", color: "var(--admin-text-muted)", display: "flex", borderRadius: 8 }}>
              {darkMode ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
            </button>
            <Image src="/kap_fav.png" alt="KAP" width={76} height={26} style={{ height: 26, width: "auto", objectFit: "contain" }} />
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
