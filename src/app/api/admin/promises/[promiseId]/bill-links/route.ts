import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { promiseId: string } },
) {
  const links = await prisma.promiseBillLink.findMany({
    where: { promiseId: params.promiseId },
    include: {
      bill: {
        select: {
          id: true,
          title: true,
          billNumber: true,
          category: true,
          dateVoted: true,
          votes: {
            select: { position: true, politicianId: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(links);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { promiseId: string } },
) {
  const body = await req.json();
  const { billId, alignment, relevance } = body;

  const link = await prisma.promiseBillLink.upsert({
    where: {
      promiseId_billId: {
        promiseId: params.promiseId,
        billId,
      },
    },
    create: {
      promiseId: params.promiseId,
      billId,
      alignment: alignment || "supports",
      relevance: relevance || "manual",
    },
    update: {
      alignment: alignment || "supports",
      relevance: relevance || "manual",
    },
  });

  return NextResponse.json(link, { status: 201 });
}
