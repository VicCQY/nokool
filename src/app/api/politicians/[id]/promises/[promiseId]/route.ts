import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { PromiseStatus } from "@prisma/client";
import { applyStatusChange } from "@/lib/promise-updates";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; promiseId: string } },
) {
  const body = await req.json();
  const newStatus = body.status as PromiseStatus;

  // Fetch current status to detect changes
  const current = await prisma.promise.findUnique({
    where: { id: params.promiseId },
    select: { status: true },
  });

  const weight = body.weight !== undefined
    ? Math.min(5, Math.max(1, Number(body.weight) || 3))
    : undefined;
  const expectedMonths = body.expectedMonths !== undefined
    ? (body.expectedMonths != null ? Math.max(1, Math.round(Number(body.expectedMonths))) : null)
    : undefined;

  // Update non-status fields
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
      reviewedAt: new Date(),
    },
  });

  // Handle status change through the rules engine (human override)
  if (current && current.status !== newStatus) {
    await applyStatusChange({
      promiseId: params.promiseId,
      newStatus,
      eventDate: new Date(),
      title: body.statusNote || `Status manually changed to ${newStatus}`,
      createdBy: "human",
    });
  }

  return NextResponse.json(promise);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; promiseId: string } },
) {
  await prisma.promise.delete({ where: { id: params.promiseId } });
  return NextResponse.json({ ok: true });
}
