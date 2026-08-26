import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { sendBatchPushNotifications } from "@/lib/notifications";

const WORKING_DAY_THRESHOLD = 0.15;

// Shared logic used by both manual trigger and cron
export async function sendAbsentAlerts(center?: string): Promise<{ sent: number; skipped: number; holiday: number }> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  // All students with a parent that has a push token, grouped by batch
  const allStudents = await prisma.student.findMany({
    where: {
      ...(center ? { center } : {}),
      parent: { pushToken: { not: null } },
    },
    select: {
      id: true,
      name: true,
      enrollmentNo: true,
      batch: true,
      parent: { select: { pushToken: true } },
    },
  });

  if (!allStudents.length) return { sent: 0, skipped: 0, holiday: 0 };

  // Total students per batch (including those without push tokens — for threshold calculation)
  const batchTotals = await prisma.student.groupBy({
    by: ["batch"],
    where: { ...(center ? { center } : {}) },
    _count: { id: true },
  });
  const totalByBatch = new Map(batchTotals.map(b => [b.batch, b._count.id]));

  // Today's PUNCH_IN records for each batch
  const todayRecords = await prisma.attendance.findMany({
    where: { date: today, type: "PUNCH_IN" },
    select: { studentId: true, student: { select: { batch: true } } },
  });

  // Count distinct students who punched in per batch
  const presentByBatch = new Map<string, Set<string>>();
  for (const r of todayRecords) {
    const b = r.student.batch;
    if (!presentByBatch.has(b)) presentByBatch.set(b, new Set());
    presentByBatch.get(b)!.add(r.studentId);
  }

  // Determine which batches are "working days" (≥15% attendance)
  const workingBatches = new Set<string>();
  for (const [batchName, total] of totalByBatch) {
    const present = presentByBatch.get(batchName)?.size ?? 0;
    const threshold = Math.max(1, Math.ceil(total * WORKING_DAY_THRESHOLD));
    if (present >= threshold) workingBatches.add(batchName);
  }

  const presentIds = new Set([...presentByBatch.values()].flatMap(s => [...s]));

  let holidayCount = 0;
  const messages: { to: string; title: string; body: string }[] = [];

  for (const s of allStudents) {
    if (!s.parent?.pushToken) continue;

    if (!workingBatches.has(s.batch)) {
      // This batch hasn't crossed the 15% threshold — treat as holiday, don't alert
      holidayCount++;
      continue;
    }

    if (presentIds.has(s.id)) continue; // already present

    messages.push({
      to: s.parent.pushToken,
      title: "Attendance Alert",
      body: `${s.name || s.enrollmentNo} has not punched in yet today. Please check with your child.`,
    });
  }

  const skipped = allStudents.length - messages.length - holidayCount;
  if (messages.length) await sendBatchPushNotifications(messages);

  return { sent: messages.length, skipped, holiday: holidayCount };
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
