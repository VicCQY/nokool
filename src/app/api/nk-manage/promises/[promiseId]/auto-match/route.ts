import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { matchBillsToPromise } from "@/lib/promise-bill-matcher";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: { promiseId: string } },
) {
  const promise = await prisma.promise.findUnique({
    where: { id: params.promiseId },
    include: { politician: { select: { country: true } } },
  });

  if (!promise) {
    return NextResponse.json({ error: "Promise not found" }, { status: 404 });
  }

  const bills = await prisma.bill.findMany({
    where: { country: promise.politician.country },
    select: { id: true, title: true, summary: true, billNumber: true, category: true },
  });

  const matches = matchBillsToPromise(
    {
      id: promise.id,
      title: promise.title,
      description: promise.description,
      category: promise.category,
    },
    bills,
  );

  let created = 0;
  for (const match of matches) {
    try {
      await prisma.promiseBillLink.upsert({
        where: {
          promiseId_billId: {
            promiseId: promise.id,
            billId: match.billId,
          },
        },
        create: {
          promiseId: promise.id,
          billId: match.billId,
          relevance: "auto",
          alignment: match.alignment,
        },
        update: {},
      });
      created++;
    } catch {
      // skip errors
    }
  }

  return NextResponse.json({ matched: created, total: matches.length });
}
