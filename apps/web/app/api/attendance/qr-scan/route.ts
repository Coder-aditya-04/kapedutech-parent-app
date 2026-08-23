import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  try {
    const { qrCode } = await request.json() as { qrCode?: string };

    if (!qrCode || typeof qrCode !== "string") {
      return Response.json({ message: "qrCode is required." }, { status: 400 });
    }

    let student;
    if (qrCode.includes(":")) {
      const studentId = qrCode.split(":")[0] as string;
      student = await prisma.student.findUnique({ where: { id: studentId }, include: { parent: true } });
    } else {
      let enrollmentNo = qrCode.trim();
      try {
        const parsed = JSON.parse(qrCode) as Record<string, unknown>;
        if (parsed?.roll_number) enrollmentNo = String(parsed.roll_number).trim();
      } catch { /* not JSON */ }
      student = await prisma.student.findFirst({ where: { enrollmentNo }, include: { parent: true } });
    }

    if (!student) return Response.json({ message: "Student not found." }, { status: 404 });

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
      return Response.json({ message: "Already completed attendance for today." }, { status: 409 });
    }

    if (hasPunchIn && !hasPunchOut) {
      const punchInRecord = todayRecords.find(r => r.type === "PUNCH_IN");
      if (punchInRecord) {
        const minutesElapsed = (Date.now() - new Date(punchInRecord.markedAt).getTime()) / 60000;
        if (minutesElapsed < 5) {
          const waitMins = Math.ceil(5 - minutesElapsed);
          return Response.json({
            code: "TOO_SOON",
            message: `Punch out too soon. Please wait ${waitMins} more minute${waitMins > 1 ? "s" : ""}.`,
          }, { status: 409 });
        }
      }
    }

    const type = hasPunchIn ? "PUNCH_OUT" : "PUNCH_IN";

    const record = await prisma.attendance.create({
      data: { studentId: student.id, date: today, type, notificationSent: false },
    });

    // Fire-and-forget — never block the scan response on notification
    const notifTitle = type === "PUNCH_IN" ? "Attendance Marked" : "Punch Out";
    const notifBody = type === "PUNCH_IN"
      ? `${studentName} punched in at ${time}`
      : `${studentName} punched out at ${time}`;
    const pushToken = student.parent?.pushToken ?? null;
    sendPushNotification(pushToken, notifTitle, notifBody)
      .then(() => prisma.attendance.update({ where: { id: record.id }, data: { notificationSent: true } }))
      .catch(err => console.error("[Attendance] Notification error:", err));

    return Response.json({ success: true, studentName, time, type });
  } catch (e) {
    console.error("[qr-scan]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
