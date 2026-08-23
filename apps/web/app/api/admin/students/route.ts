import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

function str(v: unknown): string | undefined { return typeof v === "string" ? v : undefined; }

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const center = str(request.nextUrl.searchParams.get("center") ?? undefined);
    const students = await prisma.student.findMany({
      where: center ? { center } : {},
      include: { parent: true },
      orderBy: { name: "asc" },
    });
    return Response.json(students);
  } catch (e) {
    console.error("[admin-students-list]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { name, enrollmentNo, batch, center, parentPhone, parentName, parentEmail } = await request.json() as {
      name: string; enrollmentNo: string; batch: string; center?: string;
      parentPhone: string; parentName?: string; parentEmail?: string;
    };

    if (!name || !enrollmentNo || !batch || !parentPhone) {
      return Response.json({ message: "name, enrollmentNo, batch, parentPhone are required." }, { status: 400 });
    }

    if (parentEmail) {
      const emailOwner = await prisma.parent.findUnique({ where: { email: parentEmail } });
      const existingParent = await prisma.parent.findFirst({ where: { phone: parentPhone } });
      if (emailOwner && emailOwner.id !== existingParent?.id) {
        return Response.json({ message: `Email ${parentEmail} is already linked to another parent account.` }, { status: 409 });
      }
    }

    let parent = await prisma.parent.findFirst({ where: { phone: parentPhone } });
    if (!parent) {
      parent = await prisma.parent.create({
        data: { name: parentName || "Parent", phone: parentPhone, email: parentEmail || null },
      });
    } else if (parentEmail) {
      parent = await prisma.parent.update({ where: { id: parent.id }, data: { email: parentEmail } });
    }

    const student = await prisma.student.create({
      data: {
        userId: enrollmentNo,
        enrollmentNo,
        name,
        batch,
        center: center || "College Road",
        qrCode: `temp-${Date.now()}`,
        parentId: parent.id,
      },
    });

    const updated = await prisma.student.update({
      where: { id: student.id },
      data: { qrCode: `${student.id}:${enrollmentNo}`, qrCodeGenerated: true },
      include: { parent: true },
    });

    return Response.json(updated, { status: 201 });
  } catch (e) {
    console.error("[admin-students-create]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
