import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Parent tokens are signed with this. A missing secret in production must
// fail closed: with the old public fallback anyone could mint a token for any
// parentId and read that family's data.
// Read at call time, not at import, so a build without the variable still
// completes and only the request fails.
export function jwtSecret(): string {
  const s = process.env["JWT_SECRET"];
  if (s) return s;
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("JWT_SECRET is not set. Parent sign-in is disabled until it is.");
  }
  return "dev_secret_change_in_prod";
}

export function requireParentAuth(request: NextRequest): { parentId: string } | Response {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), jwtSecret()) as { parentId: string };
    if (!payload.parentId) return Response.json({ message: "Invalid token" }, { status: 401 });
    return { parentId: payload.parentId };
  } catch {
    return Response.json({ message: "Invalid or expired token" }, { status: 401 });
  }
}

export function requireAdmin(request: NextRequest): Response | null {
  const secret = process.env["ADMIN_SECRET"];
  if (!secret) return Response.json({ message: "Server not configured" }, { status: 503 });
  if (request.headers.get("x-admin-secret") !== secret) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// Parent auth plus a check that the student belongs to this parent, so one
// parent cannot read another family's attendance or results by changing the id.
export async function requireParentOwnsStudent(
  request: NextRequest,
  studentId: string
): Promise<{ parentId: string } | Response> {
  const auth = requireParentAuth(request);
  if (auth instanceof Response) return auth;
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { parentId: true } });
  if (!student || student.parentId !== auth.parentId) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }
  return auth;
}
