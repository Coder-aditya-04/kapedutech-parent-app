import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// Returns just the two numbers the sidebar needs, counted server-side.
// The sidebar previously downloaded every student and every attendance row
// on a 30s loop purely to call .length on them.
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    const [total, presentRows] = await Promise.all([
      prisma.student.count(),
      prisma.attendance.findMany({
        where: { date: today, type: "PUNCH_IN" },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
    ]);

    return Response.json({ present: presentRows.length, total });
  } catch (e) {
    console.error("[admin-stats-today]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
