import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const center = request.nextUrl.searchParams.get("center") ?? undefined;
    const tests = await prisma.testResult.groupBy({
      by: ["testName", "testDate"],
      where: center ? { student: { center } } : {},
      _count: { id: true },
      orderBy: { testDate: "desc" },
    });
    return Response.json(tests.map(t => ({ testName: t.testName, testDate: t.testDate, count: t._count.id })));
  } catch (e) {
    console.error("[admin-results-tests]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
