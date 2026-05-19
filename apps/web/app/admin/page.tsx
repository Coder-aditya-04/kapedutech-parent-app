"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("admin_auth") === "true") {
      router.replace("/admin/dashboard");
    }
  }, [router]);

  async function handleLogin(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    await new Promise(r => setTimeout(r, 300));
    if (password === "admin@kap123") {
      localStorage.setItem("admin_auth", "true");
      router.push("/admin/dashboard");
    } else {
      setError("Incorrect password. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#F1F4F7",
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>

        {/* Logo block */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 120, height: 120, borderRadius: 28,
            background: "#FFFFFF",
            border: "1px solid #DEE3E9",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 4px 0 rgba(0,0,0,0.08), 0 16px 40px 0 rgba(0,0,0,0.10)",
            marginBottom: 20,
          }}>
            <Image src="/kap_fav.png" alt="KAP" width={90} height={90} style={{ objectFit: "contain" }} />
          </div>
          <div style={{ fontSize: 14, color: "#5D6C7B" }}>Sign in to Admin Portal</div>
        </div>

        {/* Card */}
        <div style={{
          background: "#FFFFFF",
          borderRadius: 20,
          padding: 32,
          border: "1px solid #DEE3E9",
          boxShadow: "0 2px 4px 0 rgba(0,0,0,0.1), 0 12px 28px 0 rgba(0,0,0,0.08)",
        }}>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1C2B33", marginBottom: 6 }}>
                Admin Password
              </label>
              <input
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: `1px solid ${error ? "#E41E3F" : "#CED0D4"}`,
                  borderRadius: 8,
                  fontSize: 14,
                  boxSizing: "border-box",
                  outline: "none",
                  color: "#1C2B33",
                  background: "#fff",
                  transition: "border-color 200ms ease",
                }}
              />
              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13, color: "#E41E3F" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "11px 22px",
                border: "none",
                borderRadius: 100,
                marginTop: 4,
                background: loading ? "#DEE3E9" : "#0064E0",
                color: loading ? "#8595A4" : "#fff",
                fontSize: 14,
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 200ms ease",
                letterSpacing: "-0.14px",
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#BCC0C4" }}>
          KAP Edutech Attendance System © 2026
        </div>
      </div>
    </main>
  );
}
