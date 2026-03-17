import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { promiseId: string } },
) {
  const links = await prisma.promiseActionLink.findMany({
    where: { promiseId: params.promiseId },
    include: {
      action: {
        select: {
          id: true,
          title: true,
          type: true,
          category: true,
          dateIssued: true,
          sourceUrl: true,
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
  const { actionId, alignment } = body;

  const link = await prisma.promiseActionLink.upsert({
    where: {
      promiseId_actionId: {
        promiseId: params.promiseId,
        actionId,
      },
    },
    create: {
      promiseId: params.promiseId,
      actionId,
      alignment: alignment || "supports",
    },
    update: {
      alignment: alignment || "supports",
    },
  });

  return NextResponse.json(link, { status: 201 });
}
