import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const WORKING_DAY_THRESHOLD = 0.15;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: { parent: { select: { name: true, phone: true, email: true } } },
    });
    if (!student) return Response.json({ message: "Student not found" }, { status: 404 });

    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);

    const [results, attendances, batchCountsByDate, totalBatchStudents] = await Promise.all([
      prisma.testResult.findMany({ where: { studentId: id }, orderBy: { testDate: "desc" }, take: 50 }),
      prisma.attendance.findMany({ where: { studentId: id }, orderBy: { markedAt: "desc" }, take: 200 }),
      // One row per date with a count — not every individual record
      prisma.attendance.groupBy({
        by: ["date"],
        where: {
          type: "PUNCH_IN",
          student: { batch: student.batch, center: student.center },
          date: { gte: sixtyDaysAgo },
        },
        _count: { _all: true },
      }),
      prisma.student.count({ where: { batch: student.batch, center: student.center } }),
    ]);

    const minStudents = Math.max(1, Math.ceil(totalBatchStudents * WORKING_DAY_THRESHOLD));
    const workingDays = batchCountsByDate
      .filter(d => d._count._all >= minStudents)
      .map(d => d.date)
      .sort();

    const totalWorkingDays = workingDays.length;
    const presentDays = new Set(attendances.filter(a => a.date >= sixtyDaysAgo).map(a => a.date)).size;
    const attendancePct = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;

    return Response.json({
      id: student.id,
      name: student.name,
      enrollmentNo: student.enrollmentNo,
      batch: student.batch,
      center: student.center,
      parent: student.parent,
      attendancePct,
      presentDays,
      totalWorkingDays,
      lastSeen: attendances[0]?.markedAt ?? null,
      results: results.map(r => ({
        testName: r.testName,
        testDate: r.testDate,
        rank: r.rank,
        total: r.total,
        percentage: r.percentage,
        percentile: r.percentile,
        scores: r.scores,
        subjectMaxes: r.subjectMaxes,
        totalInBatch: r.totalInBatch,
      })),
      attendanceLog: attendances.map(a => ({ date: a.date, markedAt: a.markedAt })),
      workingDays,
    });
  } catch (e) {
    console.error("[admin-student-profile]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
