import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Country } from "@prisma/client";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const politician = await prisma.politician.create({
    data: {
      name: body.name,
      country: body.country as Country,
      party: body.party,
      photoUrl: body.photoUrl || null,
      termStart: new Date(body.termStart),
      termEnd: body.termEnd ? new Date(body.termEnd) : null,
    },
  });

  return NextResponse.json(politician, { status: 201 });
}
