import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev_secret_change_in_prod";

export { JWT_SECRET };

export function requireParentAuth(request: NextRequest): { parentId: string } | Response {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { parentId: string };
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
