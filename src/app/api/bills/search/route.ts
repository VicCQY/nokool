import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim();
  const politicianId = searchParams.get("politicianId");

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const bills = await prisma.bill.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { billNumber: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      billNumber: true,
      category: true,
      votes: politicianId
        ? {
            where: { politicianId },
            select: { position: true },
          }
        : false,
    },
    orderBy: { dateVoted: "desc" },
    take: 15,
  });

  const results = bills.map((bill) => ({
    id: bill.id,
    title: bill.title,
    billNumber: bill.billNumber,
    category: bill.category,
    votePosition: politicianId && bill.votes?.length > 0
      ? bill.votes[0].position
      : null,
  }));

  return NextResponse.json(results);
}
