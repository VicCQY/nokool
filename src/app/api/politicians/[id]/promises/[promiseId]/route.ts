import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { PromiseStatus } from "@prisma/client";
import { recalculatePromiseScore } from "@/lib/promise-score";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; promiseId: string } },
) {
  const body = await req.json();

  const weight = body.weight !== undefined
    ? Math.min(5, Math.max(1, Number(body.weight) || 3))
    : undefined;
  const expectedMonths = body.expectedMonths !== undefined
    ? (body.expectedMonths != null ? Math.max(1, Math.round(Number(body.expectedMonths))) : null)
    : undefined;

  // Handle statusOverride — null clears the override, a valid status sets it
  const statusOverride = body.statusOverride !== undefined
    ? (body.statusOverride || null)
    : undefined;

  const promise = await prisma.promise.update({
    where: { id: params.promiseId },
    data: {
      title: body.title,
      description: body.description,
      category: body.category,
      dateMade: new Date(body.dateMade),
      sourceUrl: body.sourceUrl || null,
      ...(weight !== undefined && { weight }),
      ...(expectedMonths !== undefined && { expectedMonths }),
      ...(statusOverride !== undefined && { statusOverride: statusOverride as PromiseStatus | null }),
      reviewedAt: new Date(),
    },
  });

  // Recalculate score (respects statusOverride if set)
  await recalculatePromiseScore(params.promiseId);

  return NextResponse.json(promise);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; promiseId: string } },
) {
  await prisma.promise.delete({ where: { id: params.promiseId } });
  return NextResponse.json({ ok: true });
}
