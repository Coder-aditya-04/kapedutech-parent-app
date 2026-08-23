import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { JWT_SECRET } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { phone, otp } = await request.json() as { phone?: string; otp?: string };

    if (!phone || !otp) {
      return Response.json({ message: "phone and otp are required." }, { status: 400 });
    }

    const record = await prisma.otp.findFirst({
      where: { phone, otp, verified: false },
      orderBy: { expiresAt: "desc" },
    });

    if (!record) return Response.json({ message: "Invalid OTP." }, { status: 401 });
    if (record.expiresAt < new Date()) {
      return Response.json({ message: "OTP has expired. Please request a new one." }, { status: 401 });
    }

    await prisma.otp.update({ where: { id: record.id }, data: { verified: true } });

    const parent = await prisma.parent.findFirst({
      where: { phone },
      include: { students: { select: { id: true, name: true, enrollmentNo: true, batch: true, qrCode: true } } },
    });

    if (!parent) return Response.json({ message: "Parent not found." }, { status: 404 });

    const token = jwt.sign({ parentId: parent.id, phone: parent.phone }, JWT_SECRET, { expiresIn: "30d" });

    return Response.json({ token, parent: { id: parent.id, name: parent.name, phone: parent.phone, students: parent.students } });
  } catch (e) {
    console.error("[verify-otp]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
