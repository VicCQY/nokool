import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const hasPromises = req.nextUrl.searchParams.get("hasPromises") === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (hasPromises) where.promises = { some: {} };

  const politicians = await prisma.politician.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    select: {
      id: true,
      name: true,
      country: true,
      party: true,
      branch: true,
      photoUrl: true,
    },
    orderBy: { name: "asc" },
    take: 10,
  });

  return NextResponse.json(politicians);
}
