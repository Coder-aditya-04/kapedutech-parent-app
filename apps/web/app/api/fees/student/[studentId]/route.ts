import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParentOwnsStudent } from "@/lib/auth";
import { erpConfigured, fetchFees } from "@/lib/erp";

// Fees for one of the signed-in parent's children, read live from the ERP.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const auth = await requireParentOwnsStudent(request, studentId);
    if (auth instanceof Response) return auth;

    if (!erpConfigured()) return Response.json({ available: false, accounts: [] });

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { enrollmentNo: true, parent: { select: { phone: true, students: { select: { id: true, enrollmentNo: true } } } } },
    });
    if (!student) return Response.json({ available: true, accounts: [] });

    const phone = String(student.parent.phone ?? "").replace(/\D/g, "").slice(-10);
    const siblingRolls = student.parent.students
      .filter(s => s.id !== studentId)
      .map(s => s.enrollmentNo.trim());
    const accounts = await fetchFees(student.enrollmentNo.trim(), phone, siblingRolls);
    return Response.json({ available: true, accounts });
  } catch (e) {
    console.error("[student-fees]", e);
    return Response.json({ available: false, accounts: [], message: "Fees are unavailable right now." }, { status: 502 });
  }
}
