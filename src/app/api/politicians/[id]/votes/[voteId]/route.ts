import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; voteId: string } },
) {
  const body = await req.json();

  const vote = await prisma.vote.update({
    where: { id: params.voteId },
    data: { position: body.position },
    include: { bill: true },
  });

  return NextResponse.json(vote);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; voteId: string } },
) {
  await prisma.vote.delete({ where: { id: params.voteId } });
  return NextResponse.json({ success: true });
}
