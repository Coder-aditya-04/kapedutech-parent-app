import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const batchFindUnique = vi.fn();
const studentFindMany = vi.fn();
const send = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    batch: { findUnique: (...a: unknown[]) => batchFindUnique(...a) },
    student: { findMany: (...a: unknown[]) => studentFindMany(...a) },
  },
}));
vi.mock("@/lib/notifications", () => ({ sendBatchPushNotifications: (...a: unknown[]) => send(...a) }));

import { POST } from "@/app/api/integrations/kapcore/webhook/route";
import { req } from "./helpers";

function signed(body: unknown, secret = "test-webhook-secret") {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  return req("/api/integrations/kapcore/webhook", { method: "POST", body: raw, headers: { "x-kapcore-signature": sig } });
}

beforeEach(() => {
  batchFindUnique.mockReset();
  studentFindMany.mockReset();
  send.mockReset();
});

const assigned = { type: "homework.assigned", homework_id: "h1", kc_batch_id: "b1", subject: "Physics", title: "Ch 5", due_on: "2026-11-20" };

describe("POST /api/integrations/kapcore/webhook", () => {
  it("rejects an unsigned or wrongly signed call", async () => {
    expect((await POST(req("/w", { method: "POST", body: JSON.stringify(assigned) }))).status).toBe(401);
    expect((await POST(signed(assigned, "wrong-secret"))).status).toBe(401);
  });

  it("answers 400, not 500, for a signed but malformed event", async () => {
    expect((await POST(signed("{not json"))).status).toBe(400);
    expect((await POST(signed({ type: "homework.checked", homework_id: "h1", subject: "P", title: "T" }))).status).toBe(400);
    expect((await POST(signed({ type: "homework.deleted", homework_id: "h1" }))).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("pushes new homework to every parent in the batch who has a push token", async () => {
    batchFindUnique.mockResolvedValue({ id: "b1", name: "JEE Growth-1", center: "College Road" });
    studentFindMany.mockResolvedValue([
      { name: "Asha", parent: { pushToken: "ExponentPushToken[a]" } },
      { name: "Ravi", parent: { pushToken: null } },
    ]);
    const res = await POST(signed(assigned));
    expect(await res.json()).toEqual({ ok: true, sent: 1 });
    expect(studentFindMany.mock.calls[0]![0].where).toEqual({ batch: "JEE Growth-1", center: "College Road" });
    expect(send.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ to: "ExponentPushToken[a]", title: "New Physics homework" }),
    ]);
  });

  it("sends nothing for a batch the parent app does not know", async () => {
    batchFindUnique.mockResolvedValue(null);
    expect(await (await POST(signed(assigned))).json()).toEqual({ ok: true, sent: 0 });
  });

  it("tells only the parents of the students whose check changed", async () => {
    studentFindMany.mockResolvedValue([{ name: "Asha", enrollmentNo: "R1", parent: { pushToken: "ExponentPushToken[a]" } }]);
    const res = await POST(signed({ type: "homework.checked", homework_id: "h1", subject: "Physics", title: "Ch 5", rolls: [{ roll: "R1", status: "partial" }] }));
    expect(await res.json()).toEqual({ ok: true, sent: 1 });
    expect(studentFindMany.mock.calls[0]![0].where).toEqual({ enrollmentNo: { in: ["R1"] } });
    expect(send.mock.calls[0]![0][0].body).toBe('Asha partly completed "Ch 5".');
  });
});
