import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireParentAuth } from "@/lib/auth";

// The parent is taken from the login token, never from the request body, so
// nobody can point another parent's notifications at their own phone.
export async function POST(request: NextRequest) {
  try {
    const auth = requireParentAuth(request);
    if (auth instanceof Response) return auth;

    const { pushToken } = await request.json() as { pushToken?: string };

    await prisma.parent.update({ where: { id: auth.parentId }, data: { pushToken: pushToken || null } });

    return Response.json({ message: "Push token saved." });
  } catch (e) {
    console.error("[push-token]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
