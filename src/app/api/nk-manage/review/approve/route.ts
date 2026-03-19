import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // If this event has a status change, apply it
    if (event.statusChange || event.newStatus) {
      const newStatus = event.statusChange || event.newStatus;
      await prisma.promise.update({
        where: { id: event.promiseId },
        data: { status: newStatus as never },
      });
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
