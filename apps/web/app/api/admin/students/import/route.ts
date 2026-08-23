import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { rows, center: batchCenter } = await request.json() as {
      rows?: { name: string; enrollmentNo: string; batch: string; parentName: string; parentPhone: string; parentEmail?: string; center?: string }[];
      center?: string;
    };

    if (!rows?.length) return Response.json({ message: "rows array is required." }, { status: 400 });

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const { name, enrollmentNo, batch, parentName, parentPhone, parentEmail } = row;
      const centerValue = row.center || batchCenter || "College Road";

      if (!name || !enrollmentNo || !batch || !parentPhone) {
        errors.push(`Row skipped (missing fields): ${JSON.stringify(row)}`);
        skipped++;
        continue;
      }

      try {
        let parent = await prisma.parent.findFirst({ where: { phone: parentPhone } });
        if (!parent) {
          const safeEmail = parentEmail
            ? ((await prisma.parent.findUnique({ where: { email: parentEmail } })) ? null : parentEmail)
            : null;
          parent = await prisma.parent.create({
            data: { name: parentName || "Parent", phone: parentPhone, email: safeEmail },
          });
        } else if (parentEmail && !parent.email) {
          const emailTaken = await prisma.parent.findUnique({ where: { email: parentEmail } });
          if (!emailTaken) {
            parent = await prisma.parent.update({ where: { id: parent.id }, data: { email: parentEmail } });
          }
        }

        const existing = await prisma.student.findFirst({ where: { enrollmentNo } });
        if (existing) { skipped++; continue; }

        const student = await prisma.student.create({
          data: {
            userId: enrollmentNo,
            enrollmentNo,
            name,
            batch,
            center: centerValue,
            qrCode: `temp-${Date.now()}-${Math.random()}`,
            parentId: parent.id,
          },
        });
        await prisma.student.update({
          where: { id: student.id },
          data: { qrCode: `${student.id}:${enrollmentNo}`, qrCodeGenerated: true },
        });
        created++;
      } catch (e) {
        errors.push(`Error for ${name}: ${e instanceof Error ? e.message : String(e)}`);
        skipped++;
      }
    }

    return Response.json({ created, skipped, errors }, { status: 201 });
  } catch (e) {
    console.error("[admin-students-import]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
