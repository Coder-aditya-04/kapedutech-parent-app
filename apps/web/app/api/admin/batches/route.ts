import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const center = request.nextUrl.searchParams.get("center") ?? undefined;
    const batches = await prisma.batch.findMany({
      where: center ? { center } : {},
      orderBy: { createdAt: "asc" },
    });
    return Response.json(batches);
  } catch (e) {
    console.error("[admin-batches-list]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { name, center } = await request.json() as { name?: string; center?: string };

    if (!name?.trim()) return Response.json({ message: "Batch name is required." }, { status: 400 });
    if (!center?.trim()) return Response.json({ message: "Center is required." }, { status: 400 });

    const existing = await prisma.batch.findFirst({ where: { name: name.trim(), center: center.trim() } });
    if (existing) return Response.json({ message: "Batch already exists for this center." }, { status: 409 });

    const batch = await prisma.batch.create({ data: { name: name.trim(), center: center.trim() } });
    return Response.json(batch, { status: 201 });
  } catch (e) {
    console.error("[admin-batches-create]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
