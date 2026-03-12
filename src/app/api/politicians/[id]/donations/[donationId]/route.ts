import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; donationId: string } },
) {
  const body = await req.json();
  const donation = await prisma.donation.update({
    where: { id: params.donationId },
    data: {
      donorId: body.donorId,
      amount: body.amount,
      date: body.date ? new Date(body.date) : undefined,
      electionCycle: body.electionCycle,
      sourceUrl: body.sourceUrl ?? undefined,
    },
    include: { donor: true },
  });
  return NextResponse.json(donation);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; donationId: string } },
) {
  await prisma.donation.delete({ where: { id: params.donationId } });
  return NextResponse.json({ success: true });
}
