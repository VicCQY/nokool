import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PromiseStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const { eventId } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    const event = await prisma.promiseEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Mark as reviewed and approved
    await prisma.promiseEvent.update({
      where: { id: eventId },
      data: { reviewed: true, approved: true },
    });

    // If it's a status change, apply it
    if (event.eventType === "status_change" && event.newStatus) {
      const VALID = ["NOT_STARTED", "IN_PROGRESS", "ADVANCING", "FULFILLED", "PARTIAL", "BROKEN", "REVERSED"];
      if (VALID.includes(event.newStatus)) {
        await prisma.$transaction([
          prisma.promise.update({
            where: { id: event.promiseId },
            data: { status: event.newStatus as PromiseStatus, reviewedAt: new Date() },
          }),
          prisma.promiseStatusChange.create({
            data: {
              promiseId: event.promiseId,
              oldStatus: event.oldStatus as PromiseStatus | null,
              newStatus: event.newStatus as PromiseStatus,
              changedAt: event.eventDate,
              note: event.title,
            },
          }),
        ]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Review approve error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approve failed" },
      { status: 500 },
    );
  }
}
