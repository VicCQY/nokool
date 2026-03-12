import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (type) where.type = type;

  const donors = await prisma.donor.findMany({
    where,
    include: { donations: { include: { politician: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(donors);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const donor = await prisma.donor.create({
    data: {
      name: body.name,
      type: body.type,
      industry: body.industry,
      country: body.country,
    },
  });
  return NextResponse.json(donor, { status: 201 });
}
