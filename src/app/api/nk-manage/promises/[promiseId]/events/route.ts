import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PromiseStatus } from "@prisma/client";

const VALID_EVENT_TYPES = ["announcement", "news", "legislation"];
const VALID_STATUSES = ["KEPT", "FIGHTING", "STALLED", "NOTHING", "BROKE"];

export async function GET(
  _request: NextRequest,
  { params }: { params: { promiseId: string } },
) {
  const events = await prisma.promiseEvent.findMany({
    where: { promiseId: params.promiseId },
    orderBy: { eventDate: "asc" },
  });

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      eventDate: e.eventDate.toISOString().split("T")[0],
      title: e.title,
      description: e.description,
      details: e.details,
      sourceUrl: e.sourceUrl,
      statusChange: e.statusChange,
      createdBy: e.createdBy,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { promiseId: string } },
) {
  try {
    const body = await request.json();
    const { eventType, eventDate, title, description, details, sourceUrl, statusChange } = body;

    if (!title || !eventDate) {
      return NextResponse.json({ error: "title and eventDate required" }, { status: 400 });
    }

    const type = VALID_EVENT_TYPES.includes(eventType) ? eventType : "news";

    const event = await prisma.promiseEvent.create({
      data: {
        promiseId: params.promiseId,
        eventType: type,
        eventDate: new Date(eventDate),
        title,
        description: description || null,
        details: details || null,
        sourceUrl: sourceUrl || null,
        statusChange: statusChange && VALID_STATUSES.includes(statusChange) ? statusChange : null,
        createdBy: "human",
        reviewed: true,
        approved: true,
      },
    });

    // If there's a status change, apply it to the promise
    if (statusChange && VALID_STATUSES.includes(statusChange)) {
      await prisma.promise.update({
        where: { id: params.promiseId },
        data: { status: statusChange as PromiseStatus },
      });
    }

    return NextResponse.json({ success: true, id: event.id });
  } catch (err) {
    console.error("Create event error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create event" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { promiseId: string } },
) {
  try {
    const body = await request.json();
    const { events } = body;

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: "events array required" }, { status: 400 });
    }

    // Track the latest status change to apply to the promise
    let latestStatusChange: { date: string; status: string } | null = null;

    for (const evt of events) {
      if (!evt.id) continue;

      const type = VALID_EVENT_TYPES.includes(evt.eventType) ? evt.eventType : "news";
      const sc = evt.statusChange && VALID_STATUSES.includes(evt.statusChange) ? evt.statusChange : null;

      await prisma.promiseEvent.update({
        where: { id: evt.id },
        data: {
          eventType: type,
          eventDate: new Date(evt.eventDate),
          title: evt.title,
          description: evt.description || null,
          details: evt.details || null,
          sourceUrl: evt.sourceUrl || null,
          statusChange: sc,
        },
      });

      if (sc) {
        if (!latestStatusChange || new Date(evt.eventDate) > new Date(latestStatusChange.date)) {
          latestStatusChange = { date: evt.eventDate, status: sc };
        }
      }
    }

    // Apply the most recent status change to the promise
    if (latestStatusChange) {
      await prisma.promise.update({
        where: { id: params.promiseId },
        data: { status: latestStatusChange.status as PromiseStatus },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update events error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update events" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
) {
  try {
    const { eventId } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    await prisma.promiseEvent.delete({ where: { id: eventId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete event error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete event" },
      { status: 500 },
    );
  }
}
