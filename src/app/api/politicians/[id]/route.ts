import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Country } from "@prisma/client";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();

  const politician = await prisma.politician.update({
    where: { id: params.id },
    data: {
      name: body.name,
      country: body.country as Country,
      party: body.party,
      photoUrl: body.photoUrl || null,
      termStart: new Date(body.termStart),
      termEnd: body.termEnd ? new Date(body.termEnd) : null,
      inOfficeSince: body.inOfficeSince ? new Date(body.inOfficeSince) : null,
      congressId: body.congressId || null,
      fecCandidateId: body.fecCandidateId || null,
      state: body.state || null,
      district: body.district || null,
    },
  });

  return NextResponse.json(politician);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await prisma.politician.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
