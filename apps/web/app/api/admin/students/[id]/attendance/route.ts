import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { id: studentId } = await params;
    const records = await prisma.attendance.findMany({
      where: { studentId },
      orderBy: { markedAt: "desc" },
      take: 60,
    });
    return Response.json(records);
  } catch (e) {
    console.error("[admin-student-attendance]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
