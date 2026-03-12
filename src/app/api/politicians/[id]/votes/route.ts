import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const votes = await prisma.vote.findMany({
    where: { politicianId: params.id },
    include: { bill: true },
    orderBy: { bill: { dateVoted: "desc" } },
  });

  return NextResponse.json(votes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();

  const vote = await prisma.vote.create({
    data: {
      politicianId: params.id,
      billId: body.billId,
      position: body.position,
    },
    include: { bill: true },
  });

  return NextResponse.json(vote, { status: 201 });
}
