import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { PromiseStatus } from "@prisma/client";
import { matchBillsToPromise } from "@/lib/promise-bill-matcher";

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

  // Auto-match bills to this new promise
  try {
    const politician = await prisma.politician.findUnique({
      where: { id: params.id },
      select: { country: true },
    });
    if (politician) {
      const bills = await prisma.bill.findMany({
        where: { country: politician.country },
        select: { id: true, title: true, summary: true, billNumber: true, category: true },
      });
      const matches = matchBillsToPromise(
        { id: promise.id, title: promise.title, description: promise.description, category: promise.category },
        bills,
      );
      for (const match of matches) {
        await prisma.promiseBillLink.upsert({
          where: { promiseId_billId: { promiseId: promise.id, billId: match.billId } },
          create: { promiseId: promise.id, billId: match.billId, relevance: "auto", alignment: match.alignment },
          update: {},
        });
      }
    }
  } catch {
    // Don't fail the promise creation if auto-matching fails
  }

  return NextResponse.json(promise, { status: 201 });
}
