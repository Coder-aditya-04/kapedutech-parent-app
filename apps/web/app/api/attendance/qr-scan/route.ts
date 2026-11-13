import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/notifications";

function istDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// Opt-in kiosk lock. While SCAN_KIOSK_KEY is unset this endpoint stays open,
// as it always was; once it is set, only a scanner opened with
// /scan?key=<value> (remembered on that device) can mark attendance, so a
// stranger cannot mark a roll number present and push "arrived" to a parent.
function kioskAllowed(request: NextRequest): boolean {
  const key = process.env["SCAN_KIOSK_KEY"];
  if (!key) return true;
  const sent = request.headers.get("x-kiosk-key") ?? "";
  const a = Buffer.from(sent);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!kioskAllowed(request)) {
    return Response.json({ message: "This scanner is not authorised. Open it with the kiosk link." }, { status: 401 });
  }
  try {
    const { qrCode } = await request.json() as { qrCode?: string };

    if (!qrCode || typeof qrCode !== "string") {
      return Response.json({ message: "qrCode is required." }, { status: 400 });
    }

    const today = istDateString();
    let student;

    if (qrCode.includes(":")) {
      // QR contains studentId — fetch student and today's records in parallel
      const studentId = qrCode.split(":")[0] as string;
      const [foundStudent, todayRecords] = await Promise.all([
        prisma.student.findUnique({ where: { id: studentId }, include: { parent: true } }),
        prisma.attendance.findMany({ where: { studentId, date: today } }),
      ]);

      if (!foundStudent) return Response.json({ message: "Student not found." }, { status: 404 });

      return await markAttendance(foundStudent, todayRecords, today);
    } else {
      // QR contains enrollment number — must find student first
      let enrollmentNo = qrCode.trim();
      try {
        const parsed = JSON.parse(qrCode) as Record<string, unknown>;
        if (parsed?.roll_number) enrollmentNo = String(parsed.roll_number).trim();
      } catch { /* not JSON */ }

      student = await prisma.student.findFirst({ where: { enrollmentNo }, include: { parent: true } });
      if (!student) return Response.json({ message: "Student not found." }, { status: 404 });

      const todayRecords = await prisma.attendance.findMany({
        where: { studentId: student.id, date: today },
      });

      return await markAttendance(student, todayRecords, today);
    }
  } catch (e) {
    console.error("[qr-scan]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

async function markAttendance(
  student: { id: string; name: string | null; enrollmentNo: string; parent: { pushToken: string | null } | null },
  todayRecords: { type: string; markedAt: Date; id: string }[],
  today: string
): Promise<Response> {
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
  const studentName = student.name || student.enrollmentNo;
  const time = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });

  const record = await prisma.attendance.create({
    data: { studentId: student.id, date: today, type, notificationSent: false },
  });

  // Fire-and-forget — never block the scan response on notification
  const notifTitle = type === "PUNCH_IN" ? "Attendance Marked" : "Punch Out";
  const notifBody = type === "PUNCH_IN"
    ? `${studentName} punched in at ${time}`
    : `${studentName} punched out at ${time}`;
  sendPushNotification(student.parent?.pushToken ?? null, notifTitle, notifBody)
    .then(() => prisma.attendance.update({ where: { id: record.id }, data: { notificationSent: true } }))
    .catch(err => console.error("[Attendance] Notification error:", err));

  return Response.json({ success: true, studentName, time, type });
}
