import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { sendBatchPushNotifications } from "../services/notification.service.js";

// Admin: upload results for a batch test
export async function uploadResults(req: Request, res: Response): Promise<void> {
  const { testName, testDate, results, subjectMaxes } = req.body as {
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
    res.status(400).json({ message: "testName, testDate, and results are required." });
    return;
  }

  // Calculate percentile for each student: (students below / total - 1) * 100
  const withPercentile = results.map(r => {
    const studentsBelow = r.totalInBatch - r.rank;
    const percentile = r.totalInBatch > 1
      ? Math.round((studentsBelow / (r.totalInBatch - 1)) * 100 * 10) / 10
      : 100;
    return { ...r, percentile };
  });

  // Delete existing results for same test + students to allow re-upload
  await prisma.testResult.deleteMany({
    where: {
      testName,
      testDate,
      studentId: { in: results.map(r => r.studentId) },
    },
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

  // Notify parents — fire-and-forget, never block the response
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

  res.status(201).json({ message: `${results.length} results uploaded.` });
}

function str(v: unknown): string | undefined { return typeof v === "string" ? v : undefined; }

// Admin: list all tests uploaded
export async function listTests(req: Request, res: Response): Promise<void> {
  const center = str(req.query["center"]);
  const tests = await prisma.testResult.groupBy({
    by: ["testName", "testDate"],
    where: center ? { student: { center } } : {},
    _count: { id: true },
    orderBy: { testDate: "desc" },
  });
  res.json(tests.map(t => ({ testName: t.testName, testDate: t.testDate, count: t._count.id })));
}

// Admin: delete all results for a specific test
export async function deleteTest(req: Request, res: Response): Promise<void> {
  const testName = decodeURIComponent(req.params["testName"] as string);
  const testDate = str(req.query["date"]);
  if (!testDate) { res.status(400).json({ message: "date is required" }); return; }
  const { count } = await prisma.testResult.deleteMany({ where: { testName, testDate } });
  res.json({ message: `Deleted ${count} results for "${testName}"` });
}

// Admin: get all results for a specific test
export async function getTestResults(req: Request, res: Response): Promise<void> {
  const testName = decodeURIComponent(req.params["testName"] as string);
  const testDate = str(req.query["date"]);
  const center = str(req.query["center"]);
  const results = await prisma.testResult.findMany({
    where: {
      testName,
      ...(testDate ? { testDate } : {}),
      ...(center ? { student: { center } } : {}),
    },
    include: { student: { select: { name: true, enrollmentNo: true, batch: true, center: true } } },
    orderBy: { rank: "asc" },
  });
  res.json(results);
}

// Parent/mobile: get results for a specific student (with class averages per subject)
export async function getStudentResults(req: Request, res: Response): Promise<void> {
  const studentId = req.params["studentId"] as string;
  const results = await prisma.testResult.findMany({
    where: { studentId },
    orderBy: { testDate: "desc" },
    take: 20,
  });

  if (!results.length) { res.json([]); return; }

  // One query to fetch all classmates' scores for these tests
  const allBatch = await prisma.testResult.findMany({
    where: { OR: results.map(r => ({ testName: r.testName, testDate: r.testDate })) },
    select: { testName: true, testDate: true, scores: true },
  });

  // Group by "testName||testDate"
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

  res.json(enriched);
}
