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
    href: "/admin/qr-codes", label: "QR Codes",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M3 10h4"/><path d="M10 3v4"/><path d="M10 10h.01"/><path d="M14 10h.01"/></svg>,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

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

        {/* Logo area */}
        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--admin-sidebar-border)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Image src={darkMode ? "/kap_logo_transparent.png" : "/kap_fav.png"} alt="KAP Edutech" width={156} height={50} style={{ objectFit: "contain", width: "100%", height: "auto", maxHeight: 52, filter: darkMode ? "brightness(0) invert(1)" : "none" }} priority />
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--admin-text-faint)", letterSpacing: 2, textTransform: "uppercase" }}>Admin Portal</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 10px", display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--admin-text-faint)", letterSpacing: 1.5, textTransform: "uppercase", padding: "8px 10px 6px" }}>Navigation</div>
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
                    padding: "9px 12px", borderRadius: 10,
                    fontSize: 13.5, fontWeight: active ? 600 : 450,
                    background: active ? "rgba(29,107,243,0.1)" : "transparent",
                    color: active ? "var(--admin-accent)" : "var(--admin-text-muted)",
                    borderLeft: `2px solid ${active ? "var(--admin-accent)" : "transparent"}`,
                    transition: "background 0.15s, color 0.15s, border-color 0.15s",
                    position: "relative",
                  }}
                >
                  <span style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                  {item.label}
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      style={{
                        position: "absolute", right: 10,
                        width: 5, height: 5, borderRadius: "50%",
                        background: "var(--admin-accent)",
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "10px 10px 14px", borderTop: "1px solid var(--admin-sidebar-border)" }}>
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--admin-input-bg)", marginBottom: 6, border: "1px solid var(--admin-card-border)" }}>
            <div style={{ fontSize: 10, color: "var(--admin-text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>Signed in as</div>
            <div style={{ fontSize: 13, color: "var(--admin-text)", fontWeight: 600, marginTop: 2 }}>Admin</div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={toggleDark}
            style={{
              width: "100%", padding: "8px 12px", border: "1px solid var(--admin-card-border)",
              borderRadius: 10, background: "transparent",
              color: "var(--admin-text-muted)", fontSize: 13, fontWeight: 500, cursor: "pointer",
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
              width: "100%", padding: "8px 12px", border: "1px solid var(--admin-card-border)",
              borderRadius: 10, background: "transparent",
              color: "var(--admin-text-muted)", fontSize: 13, fontWeight: 500, cursor: "pointer",
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
