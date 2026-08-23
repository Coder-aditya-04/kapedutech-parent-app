import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ testName: string }> }
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { testName: rawName } = await params;
    const testName = decodeURIComponent(rawName);
    const testDate = request.nextUrl.searchParams.get("date") ?? undefined;
    const center = request.nextUrl.searchParams.get("center") ?? undefined;

    const results = await prisma.testResult.findMany({
      where: {
        testName,
        ...(testDate ? { testDate } : {}),
        ...(center ? { student: { center } } : {}),
      },
      include: { student: { select: { name: true, enrollmentNo: true, batch: true, center: true } } },
      orderBy: { rank: "asc" },
    });

    return Response.json(results);
  } catch (e) {
    console.error("[admin-results-test-get]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ testName: string }> }
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { testName: rawName } = await params;
    const testName = decodeURIComponent(rawName);
    const testDate = request.nextUrl.searchParams.get("date") ?? "";

    if (!testDate) return Response.json({ message: "date is required" }, { status: 400 });

    const { count } = await prisma.testResult.deleteMany({ where: { testName, testDate } });
    return Response.json({ message: `Deleted ${count} results for "${testName}"` });
  } catch (e) {
    console.error("[admin-results-test-delete]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
