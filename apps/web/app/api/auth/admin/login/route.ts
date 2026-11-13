import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, checkAdminPassword, createAdminSession } from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  if (!process.env["ADMIN_PASSWORD"] || !(process.env["ADMIN_SESSION_SECRET"] ?? process.env["ADMIN_SECRET"])) {
    return NextResponse.json(
      { message: "Admin login is not configured. Set ADMIN_PASSWORD and ADMIN_SECRET." },
      { status: 503 }
    );
  }

  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  // Small fixed delay slows down password guessing.
  await new Promise(r => setTimeout(r, 400));
  if (!password || !checkAdminPassword(password)) {
    return NextResponse.json({ message: "Incorrect password. Please try again." }, { status: 401 });
  }

  const session = await createAdminSession();
  if (!session) return NextResponse.json({ message: "Server not configured" }, { status: 503 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: session.expires,
  });
  return res;
}
