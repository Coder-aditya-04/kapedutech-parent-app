import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const center = request.nextUrl.searchParams.get("center") ?? undefined;

    if (!q) return Response.json([]);

    const students = await prisma.student.findMany({
      where: {
        ...(center ? { center } : {}),
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { enrollmentNo: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { parent: true },
      take: 20,
    });

    return Response.json(students);
  } catch (e) {
    console.error("[admin-students-search]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
