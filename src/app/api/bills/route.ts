import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country");
  const category = searchParams.get("category");

  const where: Record<string, string> = {};
  if (country) where.country = country;
  if (category) where.category = category;

  const bills = await prisma.bill.findMany({
    where,
    include: { votes: { include: { politician: true } } },
    orderBy: { dateVoted: "desc" },
  });

  return NextResponse.json(bills);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const bill = await prisma.bill.create({
    data: {
      title: body.title,
      summary: body.summary,
      billNumber: body.billNumber,
      category: body.category,
      country: body.country,
      session: body.session,
      dateVoted: new Date(body.dateVoted),
      sourceUrl: body.sourceUrl || null,
    },
  });

  return NextResponse.json(bill, { status: 201 });
}
