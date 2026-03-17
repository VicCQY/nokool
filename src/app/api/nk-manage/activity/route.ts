import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const events = await prisma.promiseEvent.findMany({
      include: {
        promise: {
          select: {
            title: true,
            politician: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        title: e.title,
        promiseTitle: e.promise.title,
        politicianName: e.promise.politician.name,
        oldStatus: e.oldStatus,
        newStatus: e.newStatus,
        createdBy: e.createdBy,
        confidence: e.confidence,
        approved: e.approved,
        reviewed: e.reviewed,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Activity log error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load activity" },
      { status: 500 },
    );
  }
}
