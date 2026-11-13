import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { jwtSecret } from "@/lib/auth";
import { consumeOtp } from "@/lib/otp";

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json() as { email?: string; otp?: string };

    if (!email || !otp) return Response.json({ message: "email and otp are required." }, { status: 400 });

    const check = await consumeOtp(email, otp);
    if (check === "expired") return Response.json({ message: "OTP expired. Request a new one." }, { status: 401 });
    if (check !== "ok") return Response.json({ message: "Invalid OTP." }, { status: 401 });

    const parent = await prisma.parent.findFirst({
      where: { email },
      include: { students: { select: { id: true, name: true, enrollmentNo: true, qrCode: true } } },
    });

    if (!parent) return Response.json({ message: "Parent not found." }, { status: 404 });

    const token = jwt.sign({ parentId: parent.id, email: parent.email }, jwtSecret(), { expiresIn: "30d" });

    return Response.json({ token, parent: { id: parent.id, name: parent.name, phone: parent.phone, email: parent.email, students: parent.students } });
  } catch (e) {
    console.error("[verify-otp-email]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
