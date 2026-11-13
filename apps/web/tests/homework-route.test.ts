import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const studentFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { student: { findUnique: (...a: unknown[]) => studentFindUnique(...a) } } }));

import { GET } from "@/app/api/homework/student/[studentId]/route";
import { params, parentToken, req } from "./helpers";

const fetchMock = vi.fn();

beforeEach(() => {
  studentFindUnique.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const call = (parentId: string, studentId: string) =>
  GET(req(`/api/homework/student/${studentId}`, { headers: { Authorization: `Bearer ${parentToken(parentId)}` } }), params({ studentId }));

describe("GET /api/homework/student/[studentId]", () => {
  it("does not let one parent read another child's homework", async () => {
    studentFindUnique.mockResolvedValue({ parentId: "other" });
    const res = await call("p1", "s1");
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks KAP Core for that child's roll number only, with the API key", async () => {
    studentFindUnique.mockImplementation(({ select }: { select: Record<string, boolean> }) =>
      Promise.resolve(select.parentId ? { parentId: "p1" } : { enrollmentNo: "R100" }));
    fetchMock.mockResolvedValue(Response.json({ homework: [{ student_roll: "R100", title: "Ch 5", status: "done" }] }));

    const res = await call("p1", "s1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: true, homework: [{ student_roll: "R100", title: "Ch 5", status: "done" }] });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://core.test/api/connect/homework?rolls=R100");
    expect(init.headers.Authorization).toBe("Bearer test-kapcore-key");
  });

  it("returns an empty list for a child with no roll number, without calling KAP Core", async () => {
    studentFindUnique.mockImplementation(({ select }: { select: Record<string, boolean> }) =>
      Promise.resolve(select.parentId ? { parentId: "p1" } : { enrollmentNo: "" }));
    const res = await call("p1", "s1");
    expect(await res.json()).toEqual({ available: true, homework: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says homework is unavailable when KAP Core is down", async () => {
    studentFindUnique.mockImplementation(({ select }: { select: Record<string, boolean> }) =>
      Promise.resolve(select.parentId ? { parentId: "p1" } : { enrollmentNo: "R100" }));
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const res = await call("p1", "s1");
    expect(res.status).toBe(502);
    expect((await res.json()).available).toBe(false);
  });

  it("reports not available when KAP Core is not configured", async () => {
    const saved = process.env["KAPCORE_URL"];
    delete process.env["KAPCORE_URL"];
    studentFindUnique.mockResolvedValue({ parentId: "p1" });
    try {
      const res = await call("p1", "s1");
      expect(await res.json()).toEqual({ available: false, homework: [] });
    } finally {
      process.env["KAPCORE_URL"] = saved;
    }
  });
});
