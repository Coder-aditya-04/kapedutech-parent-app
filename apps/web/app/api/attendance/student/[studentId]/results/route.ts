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

    const results = await prisma.testResult.findMany({
      where: { studentId },
      orderBy: { testDate: "desc" },
      take: 20,
    });

    if (!results.length) return Response.json([]);

    const allBatch = await prisma.testResult.findMany({
      where: { OR: results.map(r => ({ testName: r.testName, testDate: r.testDate })) },
      select: { testName: true, testDate: true, scores: true },
    });

    const batchMap = new Map<string, Record<string, number>[]>();
    for (const br of allBatch) {
      const key = `${br.testName}||${br.testDate}`;
      if (!batchMap.has(key)) batchMap.set(key, []);
      batchMap.get(key)!.push(br.scores as Record<string, number>);
    }

    const enriched = results.map(r => {
      const key = `${r.testName}||${r.testDate}`;
      const batchScores = batchMap.get(key) ?? [];
      const studentScores = r.scores as Record<string, number>;
      const classAvgScores: Record<string, number> = {};
      for (const subj of Object.keys(studentScores)) {
        const vals = batchScores.map(s => s[subj]).filter((v): v is number => typeof v === "number");
        classAvgScores[subj] = vals.length
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
          : 0;
      }
      return { ...r, classAvgScores };
    });

    return Response.json(enriched);
  } catch (e) {
    console.error("[student-results]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
