import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";

  const politicians = await prisma.politician.findMany({
    where: q
      ? { name: { contains: q, mode: "insensitive" } }
      : undefined,
    select: {
      id: true,
      name: true,
      country: true,
      party: true,
      photoUrl: true,
    },
    orderBy: { name: "asc" },
    take: 10,
  });

  return NextResponse.json(politicians);
}
