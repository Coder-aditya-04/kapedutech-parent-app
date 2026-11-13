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
    const today = new Date().toISOString().slice(0, 10);

    const records = await prisma.attendance.findMany({ where: { studentId, date: today } });
    const punchIn = records.find(r => r.type === "PUNCH_IN");
    const punchOut = records.find(r => r.type === "PUNCH_OUT");

    return Response.json({
      punchIn: punchIn ? punchIn.markedAt.toISOString() : null,
      punchOut: punchOut ? punchOut.markedAt.toISOString() : null,
    });
  } catch (e) {
    console.error("[student-today]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
