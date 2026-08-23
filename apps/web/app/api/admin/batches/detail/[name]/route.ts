import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { name } = await params;
    const batchName = decodeURIComponent(name);
    const today = new Date().toISOString().slice(0, 10);
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const startDate = thirtyAgo.toISOString().slice(0, 10);

    const students = await prisma.student.findMany({
      where: { batch: batchName },
      select: { id: true, name: true, enrollmentNo: true, batch: true },
      orderBy: { name: "asc" },
    });
    const studentIds = students.map(s => s.id);

    const [attendances, results, workingDaysRaw] = await Promise.all([
      prisma.attendance.findMany({
        where: { studentId: { in: studentIds }, date: { gte: startDate, lte: today }, type: "PUNCH_IN" },
        select: { studentId: true, date: true, markedAt: true },
      }),
      prisma.testResult.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: { testDate: "desc" },
      }),
      prisma.attendance.findMany({
        where: { type: "PUNCH_IN", date: { gte: startDate } },
        select: { date: true },
        distinct: ["date"],
      }),
    ]);

    const totalWorkingDays = workingDaysRaw.length;

    const studentsWithData = students.map(s => {
      const myAtt = attendances.filter(a => a.studentId === s.id);
      const presentDays = new Set(myAtt.map(a => a.date)).size;
      const attPct = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;
      const lastSeen = myAtt.sort((a, b) => new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime())[0]?.markedAt ?? null;
      const myResults = results.filter(r => r.studentId === s.id).map(r => ({
        testName: r.testName, testDate: r.testDate, rank: r.rank,
        total: r.total, percentage: r.percentage, percentile: r.percentile,
        scores: r.scores, totalInBatch: r.totalInBatch,
      }));
      return { ...s, attendancePct: attPct, presentDays, totalWorkingDays, lastSeen, results: myResults };
    });

    return Response.json({ batchName, totalStudents: students.length, totalWorkingDays, students: studentsWithData });
  } catch (e) {
    console.error("[admin-batch-detail]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
