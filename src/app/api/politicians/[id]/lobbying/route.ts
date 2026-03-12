import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const records = await prisma.lobbyingRecord.findMany({
    where: { politicianId: params.id },
    orderBy: { amount: "desc" },
  });
  return NextResponse.json(records);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const record = await prisma.lobbyingRecord.create({
    data: {
      lobbyistName: body.lobbyistName,
      clientName: body.clientName,
      clientIndustry: body.clientIndustry,
      politicianId: params.id,
      issue: body.issue,
      amount: body.amount,
      year: body.year,
      sourceUrl: body.sourceUrl || null,
    },
  });
  return NextResponse.json(record, { status: 201 });
}
