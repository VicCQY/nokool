import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; actionId: string } },
) {
  const body = await req.json();

  const action = await prisma.executiveAction.update({
    where: { id: params.actionId },
    data: {
      title: body.title,
      type: body.type,
      summary: body.summary,
      category: body.category,
      dateIssued: new Date(body.dateIssued),
      sourceUrl: body.sourceUrl || null,
      relatedPromises: body.relatedPromises || [],
    },
  });

  return NextResponse.json(action);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; actionId: string } },
) {
  await prisma.executiveAction.delete({ where: { id: params.actionId } });
  return NextResponse.json({ ok: true });
}
