import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { verifyFirebaseIdToken } from "@/lib/firebase";
import { JWT_SECRET } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json() as { idToken?: string };

    if (!idToken) return Response.json({ message: "idToken is required." }, { status: 400 });

    let phone: string;
    try {
      ({ phone } = await verifyFirebaseIdToken(idToken));
    } catch (e) {
      console.error("[Firebase] verifyIdToken failed:", e);
      return Response.json({ message: "Firebase token verification failed." }, { status: 401 });
    }

    const normalizedPhone = phone.replace(/^\+91/, "");

    const parent = await prisma.parent.findFirst({
      where: { phone: normalizedPhone },
      include: { students: { select: { id: true, name: true, enrollmentNo: true, batch: true, qrCode: true } } },
    });

    if (!parent) {
      return Response.json({ message: "No parent account found for this number. Contact your institute." }, { status: 404 });
    }

    const token = jwt.sign({ parentId: parent.id, phone: parent.phone }, JWT_SECRET, { expiresIn: "30d" });

    return Response.json({ token, parent: { id: parent.id, name: parent.name, phone: parent.phone, students: parent.students } });
  } catch (e) {
    console.error("[firebase-verify]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
