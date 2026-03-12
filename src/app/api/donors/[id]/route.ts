import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const donor = await prisma.donor.findUnique({
    where: { id: params.id },
    include: { donations: { include: { politician: true }, orderBy: { date: "desc" } } },
  });

  if (!donor) {
    return NextResponse.json({ error: "Donor not found" }, { status: 404 });
  }

  return NextResponse.json(donor);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const donor = await prisma.donor.update({
    where: { id: params.id },
    data: {
      name: body.name,
      type: body.type,
      industry: body.industry,
      country: body.country,
    },
  });
  return NextResponse.json(donor);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await prisma.donor.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
