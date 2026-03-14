import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Country } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const country = searchParams.get("country");
  const branch = searchParams.get("branch");
  const chamber = searchParams.get("chamber");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (country) where.country = country;
  if (branch) where.branch = branch;
  if (chamber) where.chamber = chamber;

  const politicians = await prisma.politician.findMany({
    where,
    include: { promises: { select: { status: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(politicians);
}

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
      inOfficeSince: body.inOfficeSince ? new Date(body.inOfficeSince) : null,
      congressId: body.congressId || null,
      fecCandidateId: body.fecCandidateId || null,
      branch: body.branch || "executive",
      chamber: body.chamber || null,
    },
  });

  return NextResponse.json(politician, { status: 201 });
}
