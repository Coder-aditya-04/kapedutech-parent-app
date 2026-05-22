import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const secret = process.env["ADMIN_SECRET"];
  if (secret) {
    const headers = new Headers(request.headers);
    headers.set("x-admin-secret", secret);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/admin/:path*",
};
