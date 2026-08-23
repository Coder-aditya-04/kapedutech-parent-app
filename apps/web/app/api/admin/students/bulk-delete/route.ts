import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { ids } = await request.json() as { ids?: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ message: "ids array is required" }, { status: 400 });
    }

    const students = await prisma.student.findMany({
      where: { id: { in: ids } },
      select: { parentId: true },
    });
    const parentIds = [...new Set(students.map(s => s.parentId))];

    await prisma.testResult.deleteMany({ where: { studentId: { in: ids } } });
    await prisma.attendance.deleteMany({ where: { studentId: { in: ids } } });
    const { count } = await prisma.student.deleteMany({ where: { id: { in: ids } } });

    for (const parentId of parentIds) {
      const remaining = await prisma.student.count({ where: { parentId } });
      if (remaining === 0) await prisma.parent.delete({ where: { id: parentId } }).catch(() => {});
    }

    return Response.json({ message: `Deleted ${count} students`, count });
  } catch (e) {
    console.error("[admin-students-bulk-delete]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
