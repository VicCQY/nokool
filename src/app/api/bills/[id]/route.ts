import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const bill = await prisma.bill.findUnique({
    where: { id: params.id },
    include: { votes: { include: { politician: true } } },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  return NextResponse.json(bill);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();

  const bill = await prisma.bill.update({
    where: { id: params.id },
    data: {
      title: body.title,
      summary: body.summary,
      billNumber: body.billNumber,
      category: body.category,
      country: body.country,
      session: body.session,
      dateVoted: body.dateVoted ? new Date(body.dateVoted) : undefined,
      sourceUrl: body.sourceUrl ?? undefined,
    },
  });

  return NextResponse.json(bill);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await prisma.bill.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
