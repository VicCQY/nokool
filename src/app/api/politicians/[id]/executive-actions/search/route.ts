import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const actions = await prisma.executiveAction.findMany({
    where: {
      politicianId: params.id,
      title: { contains: q, mode: "insensitive" },
    },
    select: {
      id: true,
      title: true,
      type: true,
      category: true,
      dateIssued: true,
    },
    orderBy: { dateIssued: "desc" },
    take: 15,
  });

  return NextResponse.json(actions);
}
