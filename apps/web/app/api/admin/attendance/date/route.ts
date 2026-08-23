import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const date = request.nextUrl.searchParams.get("date") ?? "";
    const batch = request.nextUrl.searchParams.get("batch") ?? undefined;
    const center = request.nextUrl.searchParams.get("center") ?? undefined;

    if (!date) return Response.json({ message: "date query param required" }, { status: 400 });

    const studentFilter = {
      ...(batch ? { batch } : {}),
      ...(center ? { center } : {}),
    };

    const records = await prisma.attendance.findMany({
      where: { date, ...(Object.keys(studentFilter).length ? { student: studentFilter } : {}) },
      include: { student: { include: { parent: true } } },
      orderBy: { markedAt: "asc" },
    });

    return Response.json(records);
  } catch (e) {
    console.error("[admin-attendance-date]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
