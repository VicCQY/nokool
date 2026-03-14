import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { PromiseStatus } from "@prisma/client";
// import { matchBillsToPromise } from "@/lib/promise-bill-matcher";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const initialStatus = (body.status as PromiseStatus) || "NOT_STARTED";

  const weight = Math.min(5, Math.max(1, Number(body.weight) || 3));
  const expectedMonths = body.expectedMonths != null
    ? Math.max(1, Math.round(Number(body.expectedMonths)))
    : null;

  const promise = await prisma.promise.create({
    data: {
      title: body.title,
      description: body.description,
      category: body.category,
      dateMade: new Date(body.dateMade),
      sourceUrl: body.sourceUrl || null,
      status: initialStatus,
      weight,
      expectedMonths,
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

  // Auto-match disabled — keyword matcher produces too many false positives.
  // Will be replaced with AI-powered matching via Anthropic API.
  // See scripts/auto-match-promises.ts for the original implementation.

  return NextResponse.json(promise, { status: 201 });
}
