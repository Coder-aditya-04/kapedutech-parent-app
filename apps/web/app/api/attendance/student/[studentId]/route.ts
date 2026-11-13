import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParentOwnsStudent } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const auth = await requireParentOwnsStudent(request, studentId);
    if (auth instanceof Response) return auth;

    const records = await prisma.attendance.findMany({
      where: { studentId },
      orderBy: { markedAt: "desc" },
      take: 500,
    });

    return Response.json(records);
  } catch (e) {
    console.error("[student-attendance]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
