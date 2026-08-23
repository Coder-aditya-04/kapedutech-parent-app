import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParentAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ parentId: string }> }
) {
  try {
    const auth = requireParentAuth(request);
    if (auth instanceof Response) return auth;

    const { parentId } = await params;

    if (auth.parentId !== parentId) {
      return Response.json({ message: "Forbidden" }, { status: 403 });
    }

    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      include: { students: { select: { id: true, name: true, enrollmentNo: true, batch: true, qrCode: true } } },
    });

    if (!parent) return Response.json({ message: "Parent not found." }, { status: 404 });

    return Response.json(parent.students);
  } catch (e) {
    console.error("[parent-students]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
