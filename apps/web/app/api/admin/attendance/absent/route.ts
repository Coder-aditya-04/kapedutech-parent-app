import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// Returns students who haven't punched in today — used by admin portal dashboard
export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const center = request.nextUrl.searchParams.get("center") ?? undefined;
    const batch = request.nextUrl.searchParams.get("batch") ?? undefined;

    const [allStudents, presentIds] = await Promise.all([
      prisma.student.findMany({
        where: {
          ...(center ? { center } : {}),
          ...(batch ? { batch } : {}),
        },
        select: {
          id: true,
          name: true,
          enrollmentNo: true,
          batch: true,
          center: true,
          parent: { select: { name: true, phone: true, pushToken: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.attendance.findMany({
        where: { date: today, type: "PUNCH_IN" },
        select: { studentId: true },
      }),
    ]);

    const presentSet = new Set(presentIds.map(r => r.studentId));

    // Also get punch-in-only (forgot punch out) students
    const punchOutIds = new Set(
      (await prisma.attendance.findMany({
        where: { date: today, type: "PUNCH_OUT" },
        select: { studentId: true },
      })).map(r => r.studentId)
    );

    const result = allStudents.map(s => {
      const punchedIn = presentSet.has(s.id);
      const punchedOut = punchOutIds.has(s.id);
      const status = punchedIn && punchedOut ? "complete" : punchedIn ? "punch_in_only" : "absent";
      return { ...s, status };
    });

    const summary = {
      total: result.length,
      complete: result.filter(s => s.status === "complete").length,
      punchInOnly: result.filter(s => s.status === "punch_in_only").length,
      absent: result.filter(s => s.status === "absent").length,
    };

    return Response.json({ today, summary, students: result });
  } catch (e) {
    console.error("[admin-attendance-absent]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
