import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const center = request.nextUrl.searchParams.get("center") ?? undefined;

    const records = await prisma.attendance.findMany({
      where: { date: today, ...(center ? { student: { center } } : {}) },
      include: { student: { include: { parent: true } } },
      orderBy: { markedAt: "asc" },
    });

    return Response.json(records);
  } catch (e) {
    console.error("[admin-attendance-today]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
