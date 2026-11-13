import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-session";

// Gate for the admin portal and admin API.
//
// Admin API calls are allowed when either:
//  - the browser has a valid signed admin session cookie (set by
//    /api/auth/admin/login), or
//  - a server-to-server caller sends the real x-admin-secret header.
// Only after one of those checks passes do we attach x-admin-secret for the
// route handlers' own requireAdmin() check.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secret = process.env["ADMIN_SECRET"];
  const hasSession = await verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value);

  if (pathname.startsWith("/api/admin")) {
    const sentSecret = request.headers.get("x-admin-secret");
    const secretOk = !!secret && sentSecret === secret;
    if (!hasSession && !secretOk) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!secret) return NextResponse.json({ message: "Server not configured" }, { status: 503 });
    const headers = new Headers(request.headers);
    headers.set("x-admin-secret", secret);
    return NextResponse.next({ request: { headers } });
  }

  // Admin pages: the login page sends a signed-in admin on to the dashboard;
  // every other /admin page needs a session.
  if (pathname === "/admin") {
    return hasSession ? NextResponse.redirect(new URL("/admin/dashboard", request.url)) : NextResponse.next();
  }
  if (!hasSession) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*", "/admin", "/admin/:path+"],
};
