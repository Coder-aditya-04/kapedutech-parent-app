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
    await prisma.testResult.delete({ where: { id } });
    return Response.json({ message: "Entry removed" });
  } catch {
    return Response.json({ message: "Result entry not found" }, { status: 404 });
  }
}
