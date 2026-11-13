import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParentOwnsStudent } from "@/lib/auth";
import { fetchHomework, kapcoreConfigured } from "@/lib/kapcore";

// Homework for one of the signed-in parent's children, read from KAP Core
// by the child's roll number (enrollmentNo).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const auth = await requireParentOwnsStudent(request, studentId);
    if (auth instanceof Response) return auth;

    if (!kapcoreConfigured()) return Response.json({ available: false, homework: [] });

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { enrollmentNo: true },
    });
    if (!student?.enrollmentNo) return Response.json({ available: true, homework: [] });

    const homework = await fetchHomework([student.enrollmentNo]);
    return Response.json({ available: true, homework });
  } catch (e) {
    console.error("[student-homework]", e);
    return Response.json({ available: false, homework: [], message: "Homework is unavailable right now." }, { status: 502 });
  }
}
