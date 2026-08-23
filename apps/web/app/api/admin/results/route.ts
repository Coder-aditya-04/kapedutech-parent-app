import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { sendBatchPushNotifications } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { testName, testDate, results, subjectMaxes } = await request.json() as {
      testName?: string;
      testDate?: string;
      subjectMaxes?: Record<string, number>;
      results?: {
        studentId: string;
        rank: number;
        totalInBatch: number;
        scores: Record<string, number>;
        total: number;
        percentage: number;
      }[];
    };

    if (!testName || !testDate || !results?.length) {
      return Response.json({ message: "testName, testDate, and results are required." }, { status: 400 });
    }

    const withPercentile = results.map(r => {
      const studentsBelow = r.totalInBatch - r.rank;
      const percentile = r.totalInBatch > 1
        ? Math.round((studentsBelow / (r.totalInBatch - 1)) * 100 * 10) / 10
        : 100;
      return { ...r, percentile };
    });

    await prisma.testResult.deleteMany({
      where: { testName, testDate, studentId: { in: results.map(r => r.studentId) } },
    });

    await prisma.testResult.createMany({
      data: withPercentile.map(r => ({
        testName,
        testDate,
        studentId: r.studentId,
        rank: r.rank,
        totalInBatch: r.totalInBatch,
        scores: r.scores,
        ...(subjectMaxes ? { subjectMaxes } : {}),
        total: r.total,
        percentage: r.percentage,
        percentile: r.percentile,
      })),
    });

    // Fire-and-forget notifications
    const fmtDate = new Date(testDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    prisma.student.findMany({
      where: { id: { in: results.map(r => r.studentId) } },
      select: { name: true, parent: { select: { pushToken: true } }, id: true },
    }).then(students => {
      const matched = withPercentile.reduce<Record<string, number>>((m, r) => { m[r.studentId] = r.percentage; return m; }, {});
      const messages = students
        .filter(s => s.parent.pushToken)
        .map(s => ({
          to: s.parent.pushToken!,
          title: "Test Result Available",
          body: `${s.name}'s result for ${testName} (${fmtDate}) is ready — ${matched[s.id]?.toFixed(1)}%`,
        }));
      return sendBatchPushNotifications(messages);
    }).catch(err => console.error("[Results] Notification error:", err));

    return Response.json({ message: `${results.length} results uploaded.` }, { status: 201 });
  } catch (e) {
    console.error("[admin-results-upload]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
