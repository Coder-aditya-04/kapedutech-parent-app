import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const batchRecord = await prisma.batch.findUnique({ where: { id } });
    if (!batchRecord) return Response.json({ message: "Batch not found." }, { status: 404 });

    const count = await prisma.student.count({ where: { batch: batchRecord.name } });
    if (count > 0) {
      return Response.json({ message: `Cannot delete — ${count} student(s) are in this batch.` }, { status: 400 });
    }

    await prisma.batch.delete({ where: { id } });
    return Response.json({ message: "Batch deleted." });
  } catch (e) {
    console.error("[admin-batch-delete]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
