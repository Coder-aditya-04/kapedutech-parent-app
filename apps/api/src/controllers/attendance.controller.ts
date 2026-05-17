import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { sendPushNotification } from "../services/notification.service.js";

export async function qrScan(req: Request, res: Response): Promise<void> {
  const { qrCode } = req.body as { qrCode?: string };

  if (!qrCode || typeof qrCode !== "string") {
    res.status(400).json({ message: "qrCode is required." });
    return;
  }

  // Support multiple QR formats:
  // 1. "studentId:enrollmentNo" — KAP-generated QR codes
  // 2. JSON {"roll_number":"...","validity":...} — Unacademy/institute ID cards
  // 3. Plain enrollment number string
  let student;
  if (qrCode.includes(":")) {
    const [studentId] = qrCode.split(":");
    student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { parent: true },
    });
  } else {
    let enrollmentNo = qrCode.trim();
    try {
      const parsed = JSON.parse(qrCode);
      if (parsed?.roll_number) enrollmentNo = String(parsed.roll_number).trim();
    } catch { /* not JSON, use raw string */ }
    student = await prisma.student.findFirst({
      where: { enrollmentNo },
      include: { parent: true },
    });
  }

  if (!student) {
    res.status(404).json({ message: "Student not found." });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const studentName = student.name || student.enrollmentNo;
  const time = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });

  const todayRecords = await prisma.attendance.findMany({
    where: { studentId: student.id, date: today },
  });

  const hasPunchIn = todayRecords.some(r => r.type === "PUNCH_IN");
  const hasPunchOut = todayRecords.some(r => r.type === "PUNCH_OUT");

  if (hasPunchIn && hasPunchOut) {
    res.status(409).json({ message: "Already completed attendance for today." });
    return;
  }

  // Enforce 5-minute minimum between punch in and punch out
  if (hasPunchIn && !hasPunchOut) {
    const punchInRecord = todayRecords.find(r => r.type === "PUNCH_IN");
    if (punchInRecord) {
      const minutesElapsed = (Date.now() - new Date(punchInRecord.markedAt).getTime()) / 60000;
      if (minutesElapsed < 5) {
        const waitMins = Math.ceil(5 - minutesElapsed);
        res.status(409).json({
          code: "TOO_SOON",
          message: `Punch out too soon. Please wait ${waitMins} more minute${waitMins > 1 ? "s" : ""}.`,
        });
        return;
      }
    }
  }

  const type = hasPunchIn ? "PUNCH_OUT" : "PUNCH_IN";

  const record = await prisma.attendance.create({
    data: { studentId: student.id, date: today, type, notificationSent: false },
  });

  const notifTitle = type === "PUNCH_IN" ? "Attendance Marked" : "Punch Out";
  const notifBody = type === "PUNCH_IN"
    ? `${studentName} punched in at ${time}`
    : `${studentName} punched out at ${time}`;

  await sendPushNotification(student.parent.pushToken ?? null, notifTitle, notifBody);
  await prisma.attendance.update({ where: { id: record.id }, data: { notificationSent: true } });

  console.log(`[${type}] ${studentName} at ${time}`);
  res.status(200).json({ success: true, studentName, time, type });
}

export async function getStudentAttendance(req: Request, res: Response): Promise<void> {
  const studentId = req.params["studentId"] as string;
  const records = await prisma.attendance.findMany({
    where: { studentId },
    orderBy: { markedAt: "desc" },
    take: 60,
  });
  res.json(records);
}

export async function getAttendanceSummary(req: Request, res: Response): Promise<void> {
  const studentId = req.params["studentId"] as string;

  // All student's PUNCH_IN dates (unique)
  const allRecords = await prisma.attendance.findMany({
    where: { studentId, type: "PUNCH_IN" },
    select: { date: true },
    orderBy: { date: "asc" },
  });
  const presentDates = [...new Set(allRecords.map(r => r.date))];
  const totalPresent = presentDates.length;

  // Working days = distinct dates any student in the SAME BATCH punched in
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

  // Current streak — consecutive present days, skipping non-working days (weekends/holidays)
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
      // Not a working day — skip it (weekend/holiday doesn't break streak)
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break; // Working day but absent — streak ends
    }
  }

  const allTimePct = totalWorkingDays > 0 ? Math.round((totalPresent / totalWorkingDays) * 100) : 0;

  res.json({ totalPresent, totalWorkingDays, currentStreak: streak, allTimePct, workingDates });
}

export async function getStudentTodayAttendance(req: Request, res: Response): Promise<void> {
  const studentId = req.params["studentId"] as string;
  const today = new Date().toISOString().slice(0, 10);
  const records = await prisma.attendance.findMany({
    where: { studentId, date: today },
  });
  const punchIn = records.find(r => r.type === "PUNCH_IN");
  const punchOut = records.find(r => r.type === "PUNCH_OUT");
  // Return raw ISO timestamps so the mobile client formats in its own timezone
  res.json({
    punchIn: punchIn ? punchIn.markedAt.toISOString() : null,
    punchOut: punchOut ? punchOut.markedAt.toISOString() : null,
  });
}
