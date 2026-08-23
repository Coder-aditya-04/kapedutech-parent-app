import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const student = await prisma.student.findUnique({ where: { id }, include: { parent: true } });
    if (!student) return Response.json({ message: "Student not found" }, { status: 404 });
    return Response.json(student);
  } catch (e) {
    console.error("[admin-student-get]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const { name, enrollmentNo, batch, center, parentPhone, parentName, parentEmail } = await request.json() as {
      name: string; enrollmentNo: string; batch: string; center?: string;
      parentPhone: string; parentName?: string; parentEmail?: string;
    };

    if (!name || !enrollmentNo || !batch || !parentPhone) {
      return Response.json({ message: "name, enrollmentNo, batch, parentPhone are required." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id }, select: { parentId: true } });
    if (!student) return Response.json({ message: "Student not found" }, { status: 404 });

    if (parentEmail) {
      const emailOwner = await prisma.parent.findUnique({ where: { email: parentEmail } });
      if (emailOwner && emailOwner.id !== student.parentId) {
        return Response.json({ message: `Email ${parentEmail} is already linked to another parent account.` }, { status: 409 });
      }
    }

    let parent = await prisma.parent.findFirst({ where: { phone: parentPhone } });
    if (!parent) {
      const emailIsCurrentParents = parentEmail
        ? await prisma.parent.count({ where: { id: student.parentId, email: parentEmail } })
        : 0;

      if (emailIsCurrentParents) {
        parent = await prisma.parent.update({
          where: { id: student.parentId },
          data: { phone: parentPhone, ...(parentName ? { name: parentName } : {}), email: parentEmail ?? null },
        });
      } else {
        parent = await prisma.parent.create({
          data: { name: parentName || "Parent", phone: parentPhone, email: parentEmail || null },
        });
      }
    } else {
      parent = await prisma.parent.update({
        where: { id: parent.id },
        data: {
          ...(parentName ? { name: parentName } : {}),
          ...(parentEmail !== undefined ? { email: parentEmail || null } : {}),
        },
      });
    }

    const updated = await prisma.student.update({
      where: { id },
      data: { name, enrollmentNo, batch, center: center || "College Road", parentId: parent.id },
      include: { parent: true },
    });

    return Response.json(updated);
  } catch (e) {
    console.error("[admin-student-update]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const student = await prisma.student.findUnique({ where: { id }, select: { parentId: true } });
    if (!student) return Response.json({ message: "Student not found" }, { status: 404 });

    await prisma.testResult.deleteMany({ where: { studentId: id } });
    await prisma.attendance.deleteMany({ where: { studentId: id } });
    await prisma.student.delete({ where: { id } });

    const remaining = await prisma.student.count({ where: { parentId: student.parentId } });
    if (remaining === 0) await prisma.parent.delete({ where: { id: student.parentId } }).catch(() => {});

    return Response.json({ message: "Student deleted" });
  } catch (e) {
    console.error("[admin-student-delete]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
