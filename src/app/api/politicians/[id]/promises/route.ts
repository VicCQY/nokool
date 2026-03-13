import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { PromiseStatus } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const initialStatus = (body.status as PromiseStatus) || "NOT_STARTED";

  const weight = Math.min(5, Math.max(1, Number(body.weight) || 3));

  const promise = await prisma.promise.create({
    data: {
      title: body.title,
      description: body.description,
      category: body.category,
      dateMade: new Date(body.dateMade),
      sourceUrl: body.sourceUrl || null,
      status: initialStatus,
      weight,
      politicianId: params.id,
      statusChanges: {
        create: {
          oldStatus: null,
          newStatus: initialStatus,
        },
      },
    },
    include: { statusChanges: true },
  });

  return NextResponse.json(promise, { status: 201 });
}
