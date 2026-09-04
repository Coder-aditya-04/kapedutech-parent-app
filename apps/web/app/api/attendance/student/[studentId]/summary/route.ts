import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParentAuth } from "@/lib/auth";

// A date is a "working day" only if ≥15% of batch students attended.
// This prevents a single stray scan (wrong day, rogue student) from
// creating false "working days" that make everyone else look absent.
const WORKING_DAY_THRESHOLD = 0.15;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const auth = requireParentAuth(request);
    if (auth instanceof Response) return auth;

    const { studentId } = await params;

    const studentInfo = await prisma.student.findUnique({
      where: { id: studentId },
      select: { batch: true },
    });
    const batchName = studentInfo?.batch ?? "";

    const [allRecords, batchCountsByDate, totalBatchStudents] = await Promise.all([
      // Student's own PUNCH_IN dates (for present days + streak)
      prisma.attendance.findMany({
        where: { studentId, type: "PUNCH_IN" },
        select: { date: true },
        distinct: ["date"],
        orderBy: { date: "asc" },
      }),
      // One row per date with a count — not every individual record.
      // A student can only have one PUNCH_IN per day (enforced in qr-scan),
      // so the row count equals the distinct-student count.
      prisma.attendance.groupBy({
        by: ["date"],
        where: { type: "PUNCH_IN", student: { batch: batchName } },
        _count: { _all: true },
      }),
      // Total students in batch (for threshold calculation)
      prisma.student.count({ where: { batch: batchName } }),
    ]);

    const presentDates = allRecords.map(r => r.date);
    const totalPresent = presentDates.length;

    // A working day requires at least 15% of batch students present
    const minStudents = Math.max(1, Math.ceil(totalBatchStudents * WORKING_DAY_THRESHOLD));
    const workingDates = batchCountsByDate
      .filter(d => d._count._all >= minStudents)
      .map(d => d.date)
      .sort();

    const totalWorkingDays = workingDates.length;
    const workingDatesSet = new Set(workingDates);

    // Current streak — consecutive present days, skipping non-working days
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const presentSet = new Set(presentDates);
    let streak = 0;
    const cursor = new Date(todayStr + "T00:00:00+05:30");
    for (let i = 0; i < 365; i++) {
      const d = cursor.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      if (presentSet.has(d)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else if (!workingDatesSet.has(d)) {
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    const allTimePct = totalWorkingDays > 0 ? Math.round((totalPresent / totalWorkingDays) * 100) : 0;

    return Response.json({ totalPresent, totalWorkingDays, currentStreak: streak, allTimePct, workingDates });
  } catch (e) {
    console.error("[attendance-summary]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
