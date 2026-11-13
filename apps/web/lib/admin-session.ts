// Signed admin session cookie. Uses Web Crypto so it runs in both the
// middleware (edge) and route handlers (node).
//
// Cookie value: "<expiresAtMs>.<hex hmac of expiresAtMs>"

export const ADMIN_COOKIE = "kap_admin";
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sessionSecret(): string | null {
  return process.env["ADMIN_SESSION_SECRET"] ?? process.env["ADMIN_SECRET"] ?? null;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createAdminSession(): Promise<{ value: string; expires: Date } | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  return { value: `${expiresAt}.${await hmac(secret, String(expiresAt))}`, expires: new Date(expiresAt) };
}

export async function verifyAdminSession(value: string | undefined | null): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret || !value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, exp));
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) return false;
  return safeEqual(password, expected);
}
