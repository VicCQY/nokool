import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: { promiseId: string; linkId: string } },
) {
  const body = await req.json();

  const link = await prisma.promiseBillLink.update({
    where: { id: params.linkId },
    data: {
      alignment: body.alignment,
      relevance: body.relevance,
    },
  });

  return NextResponse.json(link);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { promiseId: string; linkId: string } },
) {
  await prisma.promiseBillLink.delete({ where: { id: params.linkId } });
  return NextResponse.json({ ok: true });
}
