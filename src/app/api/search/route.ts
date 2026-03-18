import { prisma } from "@/lib/prisma";
import { calculateFulfillment } from "@/lib/grades";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const full = req.nextUrl.searchParams.get("full") === "1";

  if (!q || q.length < 2) {
    return NextResponse.json({
      politicians: { results: [], totalCount: 0 },
      promises: { results: [], totalCount: 0 },
      bills: { results: [], totalCount: 0 },
      donors: { results: [], totalCount: 0 },
    });
  }

  const limit = full ? 50 : 5;

  const [politicians, politicianCount, promises, promiseCount, bills, billCount, donors, donorCount] =
    await Promise.all([
      prisma.politician.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { party: { contains: q, mode: "insensitive" } },
          ],
        },
        include: { promises: { select: { status: true, score: true } } },
        take: limit,
      }),
      prisma.politician.count({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { party: { contains: q, mode: "insensitive" } },
          ],
        },
      }),
      prisma.promise.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        },
        include: { politician: { select: { id: true, name: true } } },
        take: limit,
      }),
      prisma.promise.count({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        },
      }),
      prisma.bill.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { billNumber: { contains: q, mode: "insensitive" } },
          ],
        },
        include: {
          votes: {
            take: 1,
            select: { politician: { select: { id: true, name: true } } },
          },
        },
        take: limit,
      }),
      prisma.bill.count({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { billNumber: { contains: q, mode: "insensitive" } },
          ],
        },
      }),
      prisma.donor.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { industry: { contains: q, mode: "insensitive" } },
          ],
        },
        include: {
          donations: { select: { amount: true } },
        },
        take: limit,
      }),
      prisma.donor.count({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { industry: { contains: q, mode: "insensitive" } },
          ],
        },
      }),
    ]);

  return NextResponse.json({
    politicians: {
      results: politicians.map((p) => {
        const { percentage, grade } = calculateFulfillment(p.promises);
        return {
          id: p.id,
          name: p.name,
          country: p.country,
          party: p.party,
          photoUrl: p.photoUrl,
          grade,
          percentage,
          promiseCount: p.promises.length,
        };
      }),
      totalCount: politicianCount,
    },
    promises: {
      results: promises.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        category: p.category,
        description: p.description,
        politicianId: p.politician.id,
        politicianName: p.politician.name,
      })),
      totalCount: promiseCount,
    },
    bills: {
      results: bills.map((b) => ({
        id: b.id,
        title: b.title,
        billNumber: b.billNumber,
        category: b.category,
        country: b.country,
        summary: b.summary,
        dateVoted: b.dateVoted.toISOString(),
        politicianId: b.votes[0]?.politician.id ?? null,
        politicianName: b.votes[0]?.politician.name ?? null,
      })),
      totalCount: billCount,
    },
    donors: {
      results: donors.map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        industry: d.industry,
        totalDonated: d.donations.reduce((sum, don) => sum + don.amount, 0),
      })),
      totalCount: donorCount,
    },
  });
}
