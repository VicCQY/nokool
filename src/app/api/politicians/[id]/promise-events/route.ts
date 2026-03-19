import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isInternalEvent } from "@/lib/event-filters";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const events = await prisma.promiseEvent.findMany({
      where: {
        promise: { politicianId: params.id },
        approved: true,
      },
      include: {
        promise: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: { eventDate: "desc" },
      take: 200,
    });

    // Filter out internal correction events from public view
    const publicEvents = events.filter((e) => !isInternalEvent(e.title, e.description));

    return NextResponse.json({
      events: publicEvents.map((e) => ({
        id: e.id,
        promiseId: e.promiseId,
        promiseTitle: e.promise.title,
        promiseStatus: e.promise.status,
        eventType: e.eventType,
        eventDate: e.eventDate.toISOString(),
        oldStatus: e.oldStatus,
        newStatus: e.newStatus,
        statusChange: e.statusChange,
        title: e.title,
        description: e.description,
        details: e.details,
        sourceUrl: e.sourceUrl,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Promise events error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load events" },
      { status: 500 },
    );
  }
}
