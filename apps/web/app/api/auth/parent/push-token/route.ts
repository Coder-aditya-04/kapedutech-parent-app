import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { parentId, pushToken } = await request.json() as { parentId?: string; pushToken?: string };

    if (!parentId) return Response.json({ message: "parentId is required." }, { status: 400 });

    await prisma.parent.update({ where: { id: parentId }, data: { pushToken: pushToken || null } });

    return Response.json({ message: "Push token saved." });
  } catch (e) {
    console.error("[push-token]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
