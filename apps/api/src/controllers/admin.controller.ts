import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

function str(v: unknown): string | undefined { return typeof v === "string" ? v : undefined; }

export async function listStudents(req: Request, res: Response): Promise<void> {
  const center = str(req.query["center"]);
  const students = await prisma.student.findMany({
    where: center ? { center } : {},
    include: { parent: true },
    orderBy: { name: "asc" },
  });
  res.json(students);
}

export async function createStudent(req: Request, res: Response): Promise<void> {
  const { name, enrollmentNo, batch, center, parentPhone, parentName, parentEmail } = req.body as {
    name: string; enrollmentNo: string; batch: string; center?: string;
    parentPhone: string; parentName?: string; parentEmail?: string;
  };

  if (!name || !enrollmentNo || !batch || !parentPhone) {
    res.status(400).json({ message: "name, enrollmentNo, batch, parentPhone are required." });
    return;
  }

  if (parentEmail) {
    const emailOwner = await prisma.parent.findUnique({ where: { email: parentEmail } });
    const existingParent = await prisma.parent.findFirst({ where: { phone: parentPhone } });
    if (emailOwner && emailOwner.id !== existingParent?.id) {
      res.status(409).json({ message: `Email ${parentEmail} is already linked to another parent account.` });
      return;
    }
  }

  let parent = await prisma.parent.findFirst({ where: { phone: parentPhone } });
  if (!parent) {
    parent = await prisma.parent.create({
      data: { name: parentName || "Parent", phone: parentPhone, email: parentEmail || null },
    });
  } else if (parentEmail) {
    parent = await prisma.parent.update({ where: { id: parent.id }, data: { email: parentEmail } });
  }

  const student = await prisma.student.create({
    data: {
      userId: enrollmentNo,
      enrollmentNo,
      name,
      batch,
      center: center || "College Road",
      qrCode: `temp-${Date.now()}`,
      parentId: parent.id,
    },
  });

  const updated = await prisma.student.update({
    where: { id: student.id },
    data: { qrCode: `${student.id}:${enrollmentNo}`, qrCodeGenerated: true },
    include: { parent: true },
  });

  res.status(201).json(updated);
}

export async function todayAttendance(req: Request, res: Response): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const center = str(req.query["center"]);
  const records = await prisma.attendance.findMany({
    where: { date: today, ...(center ? { student: { center } } : {}) },
    include: { student: { include: { parent: true } } },
    orderBy: { markedAt: "asc" },
  });
  res.json(records);
}

export async function batchAttendance(req: Request, res: Response): Promise<void> {
  const batch = str(req.query["batch"]);
  const center = str(req.query["center"]);
  const today = new Date().toISOString().slice(0, 10);
  const studentFilter = {
    ...(batch ? { batch } : {}),
    ...(center ? { center } : {}),
  };
  const records = await prisma.attendance.findMany({
    where: { date: today, ...(Object.keys(studentFilter).length ? { student: studentFilter } : {}) },
    include: { student: { include: { parent: true } } },
    orderBy: { markedAt: "asc" },
  });
  res.json(records);
}

export async function searchStudents(req: Request, res: Response): Promise<void> {
  const q = str(req.query["q"]);
  const center = str(req.query["center"]);
  if (!q) { res.json([]); return; }
  const students = await prisma.student.findMany({
    where: {
      ...(center ? { center } : {}),
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { enrollmentNo: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { parent: true },
    take: 20,
  });
  res.json(students);
}

export async function getStudentAttendanceHistory(req: Request, res: Response): Promise<void> {
  const studentId = req.params["studentId"] as string;
  const records = await prisma.attendance.findMany({
    where: { studentId },
    orderBy: { markedAt: "desc" },
    take: 60,
  });
  res.json(records);
}

export async function getAllStudents(req: Request, res: Response): Promise<void> {
  const center = str(req.query["center"]);
  const students = await prisma.student.findMany({
    where: center ? { center } : {},
    include: { parent: true },
    orderBy: { name: "asc" },
  });
  res.json(students);
}

export async function updateStudent(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const { name, enrollmentNo, batch, center, parentPhone, parentName, parentEmail } = req.body as {
    name: string; enrollmentNo: string; batch: string; center?: string;
    parentPhone: string; parentName?: string; parentEmail?: string;
  };

  if (!name || !enrollmentNo || !batch || !parentPhone) {
    res.status(400).json({ message: "name, enrollmentNo, batch, parentPhone are required." });
    return;
  }

  // If an email is provided, make sure it isn't already taken by a DIFFERENT parent
  // Compare against the student's actual current parent (not by new phone, which may have changed)
  if (parentEmail) {
    const emailOwner = await prisma.parent.findUnique({ where: { email: parentEmail } });
    if (emailOwner) {
      const student = await prisma.student.findUnique({ where: { id }, select: { parentId: true } });
      if (emailOwner.id !== student?.parentId) {
        res.status(409).json({ message: `Email ${parentEmail} is already linked to another parent account.` });
        return;
      }
    }
  }

  let parent = await prisma.parent.findFirst({ where: { phone: parentPhone } });
  if (!parent) {
    parent = await prisma.parent.create({ data: { name: parentName || "Parent", phone: parentPhone, email: parentEmail || null } });
  } else {
    parent = await prisma.parent.update({
      where: { id: parent.id },
      data: {
        ...(parentName ? { name: parentName } : {}),
        ...(parentEmail !== undefined ? { email: parentEmail || null } : {}),
      },
    });
  }

  const updated = await prisma.student.update({
    where: { id },
    data: { name, enrollmentNo, batch, center: center || "College Road", parentId: parent.id },
    include: { parent: true },
  });
  res.json(updated);
}

export async function deleteStudent(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const student = await prisma.student.findUnique({ where: { id }, select: { parentId: true } });
  if (!student) { res.status(404).json({ message: "Student not found" }); return; }
  await prisma.testResult.deleteMany({ where: { studentId: id } });
  await prisma.attendance.deleteMany({ where: { studentId: id } });
  await prisma.student.delete({ where: { id } });
  // Delete parent if they have no remaining students (so email/phone are freed for re-add)
  const remaining = await prisma.student.count({ where: { parentId: student.parentId } });
  if (remaining === 0) await prisma.parent.delete({ where: { id: student.parentId } }).catch(() => {});
  res.json({ message: "Student deleted" });
}

export async function bulkDeleteStudents(req: Request, res: Response): Promise<void> {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ message: "ids array is required" });
    return;
  }
  const students = await prisma.student.findMany({ where: { id: { in: ids } }, select: { parentId: true } });
  const parentIds = [...new Set(students.map(s => s.parentId))];
  await prisma.testResult.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.attendance.deleteMany({ where: { studentId: { in: ids } } });
  const { count } = await prisma.student.deleteMany({ where: { id: { in: ids } } });
  // Delete orphaned parents so their email/phone are freed
  for (const parentId of parentIds) {
    const remaining = await prisma.student.count({ where: { parentId } });
    if (remaining === 0) await prisma.parent.delete({ where: { id: parentId } }).catch(() => {});
  }
  res.json({ message: `Deleted ${count} students`, count });
}

export async function dateAttendance(req: Request, res: Response): Promise<void> {
  const date = str(req.query["date"]);
  const batch = str(req.query["batch"]);
  const center = str(req.query["center"]);
  if (!date) { res.status(400).json({ message: "date query param required" }); return; }
  const studentFilter = {
    ...(batch ? { batch } : {}),
    ...(center ? { center } : {}),
  };
  const records = await prisma.attendance.findMany({
    where: { date, ...(Object.keys(studentFilter).length ? { student: studentFilter } : {}) },
    include: { student: { include: { parent: true } } },
    orderBy: { markedAt: "asc" },
  });
  res.json(records);
}

export async function getStudentProfile(req: Request, res: Response): Promise<void> {
  const id = req.params["id"] as string;
  const student = await prisma.student.findUnique({
    where: { id },
    include: { parent: { select: { name: true, phone: true, email: true } } },
  });
  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  const [results, attendances] = await Promise.all([
    prisma.testResult.findMany({ where: { studentId: id }, orderBy: { testDate: "desc" }, take: 30 }),
    prisma.attendance.findMany({ where: { studentId: id }, orderBy: { markedAt: "desc" }, take: 90 }),
  ]);

  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const batchDates = await prisma.attendance.findMany({
    where: { student: { batch: student.batch, center: student.center }, date: { gte: sixtyDaysAgo } },
    select: { date: true },
    distinct: ["date"],
  });

  const totalWorkingDays = batchDates.length;
  const presentDays = attendances.filter(a => a.date >= sixtyDaysAgo).length;
  const attendancePct = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;

  res.json({
    id: student.id, name: student.name, enrollmentNo: student.enrollmentNo,
    batch: student.batch, center: student.center, parent: student.parent,
    attendancePct, presentDays, totalWorkingDays,
    lastSeen: attendances[0]?.markedAt ?? null,
    results: results.map(r => ({
      testName: r.testName, testDate: r.testDate, rank: r.rank, total: r.total,
      percentage: r.percentage, percentile: r.percentile, scores: r.scores, totalInBatch: r.totalInBatch,
    })),
  });
}

export async function importStudents(req: Request, res: Response): Promise<void> {
  const { rows, center: batchCenter } = req.body as {
    rows?: { name: string; enrollmentNo: string; batch: string; parentName: string; parentPhone: string; parentEmail?: string; center?: string }[];
    center?: string;
  };
  if (!rows?.length) { res.status(400).json({ message: "rows array is required." }); return; }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const { name, enrollmentNo, batch, parentName, parentPhone, parentEmail } = row;
    const centerValue = row.center || batchCenter || "College Road";
    if (!name || !enrollmentNo || !batch || !parentPhone) {
      errors.push(`Row skipped (missing fields): ${JSON.stringify(row)}`);
      skipped++;
      continue;
    }
    try {
      let parent = await prisma.parent.findFirst({ where: { phone: parentPhone } });
      if (!parent) {
        // If the email is already taken by a different parent, import without email
        const safeEmail = parentEmail
          ? (await prisma.parent.findUnique({ where: { email: parentEmail } })) ? null : parentEmail
          : null;
        parent = await prisma.parent.create({
          data: { name: parentName || "Parent", phone: parentPhone, email: safeEmail },
        });
      } else if (parentEmail && !parent.email) {
        const emailTaken = await prisma.parent.findUnique({ where: { email: parentEmail } });
        if (!emailTaken) {
          parent = await prisma.parent.update({ where: { id: parent.id }, data: { email: parentEmail } });
        }
      }
      const existing = await prisma.student.findFirst({ where: { enrollmentNo } });
      if (existing) { skipped++; continue; }
      const student = await prisma.student.create({
        data: { userId: enrollmentNo, enrollmentNo, name, batch, center: centerValue, qrCode: `temp-${Date.now()}-${Math.random()}`, parentId: parent.id },
      });
      await prisma.student.update({
        where: { id: student.id },
        data: { qrCode: `${student.id}:${enrollmentNo}`, qrCodeGenerated: true },
      });
      created++;
    } catch (e) {
      errors.push(`Error for ${name}: ${e instanceof Error ? e.message : String(e)}`);
      skipped++;
    }
  }

  res.status(201).json({ created, skipped, errors });
}
