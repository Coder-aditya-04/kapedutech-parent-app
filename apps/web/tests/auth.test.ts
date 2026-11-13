import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { student: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

import { requireAdmin, requireParentAuth, requireParentOwnsStudent } from "@/lib/auth";
import { parentToken, req } from "./helpers";

const bearer = (t: string) => ({ headers: { Authorization: `Bearer ${t}` } });

describe("requireParentAuth", () => {
  it("rejects a request with no token", () => {
    const r = requireParentAuth(req("/x"));
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).status).toBe(401);
  });

  it("rejects a token signed with another secret", () => {
    const r = requireParentAuth(req("/x", bearer(parentToken("p1", "someone-else"))));
    expect((r as Response).status).toBe(401);
  });

  it("rejects a tampered token", () => {
    const [h, , s] = parentToken("p1").split(".");
    const forged = Buffer.from(JSON.stringify({ parentId: "p2" })).toString("base64url");
    expect((requireParentAuth(req("/x", bearer(`${h}.${forged}.${s}`))) as Response).status).toBe(401);
  });

  it("rejects an expired token", () => {
    const old = jwt.sign({ parentId: "p1", exp: Math.floor(Date.now() / 1000) - 60 }, "test-jwt-secret");
    expect((requireParentAuth(req("/x", bearer(old))) as Response).status).toBe(401);
  });

  it("returns the parent id for a valid token", () => {
    expect(requireParentAuth(req("/x", bearer(parentToken("p1"))))).toEqual({ parentId: "p1" });
  });
});

describe("requireParentOwnsStudent", () => {
  beforeEach(() => findUnique.mockReset());

  it("lets a parent read their own child", async () => {
    findUnique.mockResolvedValue({ parentId: "p1" });
    expect(await requireParentOwnsStudent(req("/x", bearer(parentToken("p1"))), "s1")).toEqual({ parentId: "p1" });
  });

  it("blocks a parent from another family's child", async () => {
    findUnique.mockResolvedValue({ parentId: "p2" });
    const r = await requireParentOwnsStudent(req("/x", bearer(parentToken("p1"))), "s9");
    expect((r as Response).status).toBe(403);
  });

  it("answers 403, not 404, for a student that does not exist", async () => {
    findUnique.mockResolvedValue(null);
    const r = await requireParentOwnsStudent(req("/x", bearer(parentToken("p1"))), "nope");
    expect((r as Response).status).toBe(403);
  });
});

describe("requireAdmin", () => {
  it("rejects a missing or wrong secret", () => {
    expect(requireAdmin(req("/x"))?.status).toBe(401);
    expect(requireAdmin(req("/x", { headers: { "x-admin-secret": "nope" } }))?.status).toBe(401);
  });

  it("accepts the configured secret", () => {
    expect(requireAdmin(req("/x", { headers: { "x-admin-secret": "test-admin-secret" } }))).toBeNull();
  });
});
