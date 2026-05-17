import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export async function listStudents(req: Request, res: Response): Promise<void> {
  const students = await prisma.student.findMany({
    include: { parent: true },
    orderBy: { name: "asc" },
  });
  res.json(students);
}

export async function createStudent(req: Request, res: Response): Promise<void> {
  const { name, enrollmentNo, batch, parentPhone, parentName, parentEmail } = req.body as {
    name: string; enrollmentNo: string; batch: string; parentPhone: string; parentName?: string; parentEmail?: string;
  };

  if (!name || !enrollmentNo || !batch || !parentPhone) {
    res.status(400).json({ message: "name, enrollmentNo, batch, parentPhone are required." });
    return;
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
  const records = await prisma.attendance.findMany({
    where: { date: today },
    include: { student: { include: { parent: true } } },
    orderBy: { markedAt: "asc" },
  });
  res.json(records);
}

export async function batchAttendance(req: Request, res: Response): Promise<void> {
  const batch = req.query["batch"] as string | undefined;
  const today = new Date().toISOString().slice(0, 10);
  const records = await prisma.attendance.findMany({
    where: batch ? { date: today, student: { batch } } : { date: today },
    include: { student: { include: { parent: true } } },
    orderBy: { markedAt: "asc" },
  });
  res.json(records);
}

export async function searchStudents(req: Request, res: Response): Promise<void> {
  const q = req.query["q"] as string | undefined;
  if (!q) { res.json([]); return; }
  const students = await prisma.student.findMany({
    where: {
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
  const students = await prisma.student.findMany({
    include: { parent: true },
    orderBy: { name: "asc" },
  });
  res.json(students);
}

export async function updateStudent(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, enrollmentNo, batch, parentPhone, parentName, parentEmail } = req.body as {
    name: string; enrollmentNo: string; batch: string; parentPhone: string; parentName?: string; parentEmail?: string;
  };

  if (!name || !enrollmentNo || !batch || !parentPhone) {
    res.status(400).json({ message: "name, enrollmentNo, batch, parentPhone are required." });
    return;
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
    data: { name, enrollmentNo, batch, parentId: parent.id },
    include: { parent: true },
  });
  res.json(updated);
}

export async function deleteStudent(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await prisma.attendance.deleteMany({ where: { studentId: id } });
  await prisma.student.delete({ where: { id } });
  res.json({ message: "Student deleted" });
}

export async function dateAttendance(req: Request, res: Response): Promise<void> {
  const date = req.query["date"] as string | undefined;
  const batch = req.query["batch"] as string | undefined;
  if (!date) { res.status(400).json({ message: "date query param required" }); return; }
  const records = await prisma.attendance.findMany({
    where: batch ? { date, student: { batch } } : { date },
    include: { student: { include: { parent: true } } },
    orderBy: { markedAt: "asc" },
  });
  res.json(records);
}

export async function importStudents(req: Request, res: Response): Promise<void> {
  const { rows } = req.body as {
    rows?: { name: string; enrollmentNo: string; batch: string; parentName: string; parentPhone: string; parentEmail?: string }[];
  };
  if (!rows?.length) { res.status(400).json({ message: "rows array is required." }); return; }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const { name, enrollmentNo, batch, parentName, parentPhone, parentEmail } = row;
    if (!name || !enrollmentNo || !batch || !parentPhone) {
      errors.push(`Row skipped (missing fields): ${JSON.stringify(row)}`);
      skipped++;
      continue;
    }
    try {
      let parent = await prisma.parent.findFirst({ where: { phone: parentPhone } });
      if (!parent) {
        parent = await prisma.parent.create({
          data: { name: parentName || "Parent", phone: parentPhone, email: parentEmail || null },
        });
      } else if (parentEmail && !parent.email) {
        parent = await prisma.parent.update({ where: { id: parent.id }, data: { email: parentEmail } });
      }
      const existing = await prisma.student.findFirst({ where: { enrollmentNo } });
      if (existing) { skipped++; continue; }
      const student = await prisma.student.create({
        data: { userId: enrollmentNo, enrollmentNo, name, batch, qrCode: `temp-${Date.now()}-${Math.random()}`, parentId: parent.id },
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
