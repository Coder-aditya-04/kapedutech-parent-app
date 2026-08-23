import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    const parent = await prisma.parent.findFirst({ where: { phone } });
    return Response.json({ registered: !!parent });
  } catch (e) {
    console.error("[check-phone]", e);
    return Response.json({ registered: false });
  }
}
