import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; lobbyingId: string } },
) {
  const body = await req.json();
  const record = await prisma.lobbyingRecord.update({
    where: { id: params.lobbyingId },
    data: {
      lobbyistName: body.lobbyistName,
      clientName: body.clientName,
      clientIndustry: body.clientIndustry,
      issue: body.issue,
      amount: body.amount,
      year: body.year,
      sourceUrl: body.sourceUrl ?? undefined,
    },
  });
  return NextResponse.json(record);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; lobbyingId: string } },
) {
  await prisma.lobbyingRecord.delete({ where: { id: params.lobbyingId } });
  return NextResponse.json({ success: true });
}
