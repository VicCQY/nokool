import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [pending, autoAppliedCount, rejectedCount] = await Promise.all([
      prisma.promiseEvent.findMany({
        where: { reviewed: false },
        include: {
          promise: {
            select: {
              title: true,
              status: true,
              politician: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.promiseEvent.count({
        where: {
          createdBy: "ai_auto",
          approved: true,
          createdAt: { gte: oneWeekAgo },
        },
      }),
      prisma.promiseEvent.count({
        where: {
          reviewed: true,
          approved: false,
          createdAt: { gte: oneWeekAgo },
        },
      }),
    ]);

    return NextResponse.json({
      pending: pending.map((e) => ({
        id: e.id,
        promiseId: e.promiseId,
        promiseTitle: e.promise.title,
        promiseStatus: e.promise.status,
        politicianName: e.promise.politician.name,
        eventType: e.eventType,
        eventDate: e.eventDate.toISOString(),
        oldStatus: e.oldStatus,
        newStatus: e.newStatus,
        statusChange: e.statusChange,
        title: e.title,
        description: e.description,
        details: e.details,
        sourceUrl: e.sourceUrl,
        createdBy: e.createdBy,
        confidence: e.confidence,
        createdAt: e.createdAt.toISOString(),
      })),
      stats: {
        pendingCount: pending.length,
        autoAppliedThisWeek: autoAppliedCount,
        rejectedThisWeek: rejectedCount,
      },
    });
  } catch (err) {
    console.error("Review queue error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load review queue" },
      { status: 500 },
    );
  }
}
