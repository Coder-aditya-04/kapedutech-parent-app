import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { istDate, istDaysAgo } from "@/lib/dates";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const center = request.nextUrl.searchParams.get("center") ?? undefined;
    const batches = await prisma.batch.findMany({
      where: center ? { center } : {},
      orderBy: { createdAt: "asc" },
    });

    const startDate = istDaysAgo(30);
    const endDate = istDate();

    const analytics = await Promise.all(batches.map(async batch => {
      const students = await prisma.student.findMany({
        where: { batch: batch.name, ...(center ? { center } : {}) },
        select: { id: true },
      });
      const studentIds = students.map(s => s.id);
      const totalStudents = studentIds.length;

      if (totalStudents === 0) return { ...batch, totalStudents: 0, avgAttendancePct: 0 };

      const attendances = await prisma.attendance.findMany({
        where: { studentId: { in: studentIds }, date: { gte: startDate, lte: endDate }, type: "PUNCH_IN" },
        select: { studentId: true, date: true },
      });

      const allDates = new Set(attendances.map(a => a.date));
      const totalWorkingDays = allDates.size;

      if (totalWorkingDays === 0) return { ...batch, totalStudents, avgAttendancePct: 0 };

      const perStudent = new Map<string, Set<string>>();
      for (const a of attendances) {
        if (!perStudent.has(a.studentId)) perStudent.set(a.studentId, new Set());
        perStudent.get(a.studentId)!.add(a.date);
      }

      const totalPresent = Array.from(perStudent.values()).reduce((sum, days) => sum + days.size, 0);
      const avgAttendancePct = Math.round((totalPresent / (totalStudents * totalWorkingDays)) * 100);

      return { ...batch, totalStudents, avgAttendancePct, totalWorkingDays };
    }));

    return Response.json(analytics);
  } catch (e) {
    console.error("[admin-batches-analytics]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
