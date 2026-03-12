import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const donations = await prisma.donation.findMany({
    where: { politicianId: params.id },
    include: { donor: true },
    orderBy: { amount: "desc" },
  });
  return NextResponse.json(donations);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const donation = await prisma.donation.create({
    data: {
      donorId: body.donorId,
      politicianId: params.id,
      amount: body.amount,
      date: new Date(body.date),
      electionCycle: body.electionCycle,
      sourceUrl: body.sourceUrl || null,
    },
    include: { donor: true },
  });
  return NextResponse.json(donation, { status: 201 });
}
