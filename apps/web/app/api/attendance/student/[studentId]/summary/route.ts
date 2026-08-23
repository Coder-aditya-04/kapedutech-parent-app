import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParentAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const auth = requireParentAuth(request);
    if (auth instanceof Response) return auth;

    const { studentId } = await params;

    const allRecords = await prisma.attendance.findMany({
      where: { studentId, type: "PUNCH_IN" },
      select: { date: true },
      orderBy: { date: "asc" },
    });
    const presentDates = [...new Set(allRecords.map(r => r.date))];
    const totalPresent = presentDates.length;

    const studentBatch = await prisma.student.findUnique({
      where: { id: studentId },
      select: { batch: true },
    });

    const workingDaysRaw = await prisma.attendance.findMany({
      where: { type: "PUNCH_IN", student: { batch: studentBatch?.batch ?? "" } },
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "asc" },
    });
    const workingDates = workingDaysRaw.map(r => r.date);
    const totalWorkingDays = workingDates.length;
    const workingDatesSet = new Set(workingDates);

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
