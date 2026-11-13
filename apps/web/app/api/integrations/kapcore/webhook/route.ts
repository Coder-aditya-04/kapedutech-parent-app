import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBatchPushNotifications } from "@/lib/notifications";

type Event =
  | { type: "homework.assigned"; homework_id: string; kc_batch_id: string; subject: string; title: string; due_on: string }
  | { type: "homework.checked"; homework_id: string; subject: string; title: string; rolls: { roll: string; status: string }[] };

const STATUS_TEXT: Record<string, string> = {
  done: "completed",
  partial: "partly completed",
  not_done: "did not complete",
};

const MAX_AGE_MS = 5 * 60 * 1000;

function verify(body: string, signature: string | null): boolean {
  const secret = process.env["KAPCORE_WEBHOOK_SECRET"];
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function dueText(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// KAP Core tells us homework was set or checked; we push to the parents.
// The homework itself is read from KAP Core on demand, never stored here.
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verify(raw, request.headers.get("x-kapcore-signature"))) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const event = JSON.parse(raw) as Event & { sent_at?: string };
    // sent_at is inside the signed body, so a captured request cannot be
    // replayed later to re-send pushes to every parent in a batch.
    const sentAt = Date.parse(event.sent_at ?? "");
    if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > MAX_AGE_MS) {
      return Response.json({ message: "Stale event" }, { status: 401 });
    }
    const messages: { to: string; title: string; body: string }[] = [];

    if (event.type === "homework.assigned") {
      // KAP Core batch ids are KAP Connect Batch ids; students carry the batch by name + centre.
      const batch = await prisma.batch.findUnique({ where: { id: event.kc_batch_id } });
      if (!batch) return Response.json({ ok: true, sent: 0 });
      const students = await prisma.student.findMany({
        where: { batch: batch.name, center: batch.center },
        select: { name: true, parent: { select: { pushToken: true } } },
      });
      for (const s of students) {
        if (!s.parent.pushToken) continue;
        messages.push({
          to: s.parent.pushToken,
          title: `New ${event.subject} homework`,
          body: `${s.name || "Your child"}: ${event.title} (due ${dueText(event.due_on)})`,
        });
      }
    } else if (event.type === "homework.checked") {
      const rolls = event.rolls.slice(0, 500);
      const students = await prisma.student.findMany({
        where: { enrollmentNo: { in: rolls.map(r => r.roll) } },
        select: { name: true, enrollmentNo: true, parent: { select: { pushToken: true } } },
      });
      const status = new Map(rolls.map(r => [r.roll, r.status]));
      for (const s of students) {
        const st = status.get(s.enrollmentNo);
        if (!s.parent.pushToken || !st) continue;
        messages.push({
          to: s.parent.pushToken,
          title: `Homework checked: ${event.subject}`,
          body: `${s.name || "Your child"} ${STATUS_TEXT[st] ?? st} "${event.title}".`,
        });
      }
    } else {
      return Response.json({ message: "Unknown event" }, { status: 400 });
    }

    await sendBatchPushNotifications(messages);
    return Response.json({ ok: true, sent: messages.length });
  } catch (e) {
    console.error("[kapcore-webhook]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
