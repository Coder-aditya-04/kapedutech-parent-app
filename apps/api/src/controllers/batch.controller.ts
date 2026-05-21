import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

function str(v: unknown): string | undefined { return typeof v === "string" ? v : undefined; }

export async function listBatches(req: Request, res: Response): Promise<void> {
  const center = str(req.query["center"]);
  const batches = await prisma.batch.findMany({
    where: center ? { center } : {},
    orderBy: { createdAt: "asc" },
  });
  res.json(batches);
}

export async function createBatch(req: Request, res: Response): Promise<void> {
  const { name, center } = req.body as { name?: string; center?: string };
  if (!name?.trim()) { res.status(400).json({ message: "Batch name is required." }); return; }
  if (!center?.trim()) { res.status(400).json({ message: "Center is required." }); return; }
  const existing = await prisma.batch.findFirst({ where: { name: name.trim(), center: center.trim() } });
  if (existing) { res.status(409).json({ message: "Batch already exists for this center." }); return; }
  const batch = await prisma.batch.create({ data: { name: name.trim(), center: center.trim() } });
  res.status(201).json(batch);
}

export async function deleteBatch(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const count = await prisma.student.count({ where: { batch: (await prisma.batch.findUnique({ where: { id } }))?.name ?? "" } });
  if (count > 0) { res.status(400).json({ message: `Cannot delete — ${count} student(s) are in this batch.` }); return; }
  await prisma.batch.delete({ where: { id } });
  res.json({ message: "Batch deleted." });
}

export async function batchDetail(req: Request, res: Response): Promise<void> {
  const batchName = decodeURIComponent(req.params["name"] as string);
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
      select: { date: true }, distinct: ["date"],
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

  res.json({ batchName, totalStudents: students.length, totalWorkingDays, students: studentsWithData });
}

export async function batchAnalytics(req: Request, res: Response): Promise<void> {
  const center = str(req.query["center"]);
  const batches = await prisma.batch.findMany({
    where: center ? { center } : {},
    orderBy: { createdAt: "asc" },
  });
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
  const endDate = today.toISOString().slice(0, 10);

  const analytics = await Promise.all(batches.map(async (batch) => {
    const students = await prisma.student.findMany({ where: { batch: batch.name, ...(center ? { center } : {}) }, select: { id: true } });
    const studentIds = students.map(s => s.id);
    const totalStudents = studentIds.length;

    if (totalStudents === 0) return { ...batch, totalStudents: 0, avgAttendancePct: 0 };

    // Count unique present days per student in last 30 days
    const attendances = await prisma.attendance.findMany({
      where: { studentId: { in: studentIds }, date: { gte: startDate, lte: endDate }, type: "PUNCH_IN" },
      select: { studentId: true, date: true },
    });

    // Unique days in range
    const allDates = new Set(attendances.map(a => a.date));
    const totalWorkingDays = allDates.size;

    if (totalWorkingDays === 0) return { ...batch, totalStudents, avgAttendancePct: 0 };

    // Per student: count unique days present
    const perStudent = new Map<string, Set<string>>();
    for (const a of attendances) {
      if (!perStudent.has(a.studentId)) perStudent.set(a.studentId, new Set());
      perStudent.get(a.studentId)!.add(a.date);
    }

    const totalPresent = Array.from(perStudent.values()).reduce((sum, days) => sum + days.size, 0);
    const avgAttendancePct = Math.round((totalPresent / (totalStudents * totalWorkingDays)) * 100);

    return { ...batch, totalStudents, avgAttendancePct, totalWorkingDays };
  }));

  res.json(analytics);
}
