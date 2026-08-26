import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { sendBatchPushNotifications } from "@/lib/notifications";

// Shared logic used by both manual trigger and cron
export async function sendAbsentAlerts(center?: string): Promise<{ sent: number; skipped: number }> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  // All students with a parent that has a push token
  const allStudents = await prisma.student.findMany({
    where: {
      ...(center ? { center } : {}),
      parent: { pushToken: { not: null } },
    },
    select: {
      id: true,
      name: true,
      enrollmentNo: true,
      parent: { select: { pushToken: true } },
    },
  });

  if (!allStudents.length) return { sent: 0, skipped: 0 };

  // Students who already punched in today
  const presentIds = new Set(
    (await prisma.attendance.findMany({
      where: { date: today, type: "PUNCH_IN", studentId: { in: allStudents.map(s => s.id) } },
      select: { studentId: true },
    })).map(r => r.studentId)
  );

  const absentStudents = allStudents.filter(s => !presentIds.has(s.id));
  const skipped = allStudents.length - absentStudents.length;

  if (!absentStudents.length) return { sent: 0, skipped };

  const messages = absentStudents
    .filter(s => s.parent?.pushToken)
    .map(s => ({
      to: s.parent!.pushToken!,
      title: "Attendance Alert",
      body: `${s.name || s.enrollmentNo} has not punched in yet today. Please check with your child.`,
    }));

  await sendBatchPushNotifications(messages);

  return { sent: messages.length, skipped };
}

// Manual trigger — admin clicks a button in the portal
export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const center = request.nextUrl.searchParams.get("center") ?? undefined;
    const result = await sendAbsentAlerts(center);
    return Response.json({ success: true, ...result });
  } catch (e) {
    console.error("[absent-alert]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
