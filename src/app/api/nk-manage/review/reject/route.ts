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

    await prisma.promiseEvent.update({
      where: { id: eventId },
      data: { reviewed: true, approved: false },
    });

    // Recalculate score — rejecting an event may change it
    const { recalculatePromiseScore } = await import("@/lib/promise-score");
    await recalculatePromiseScore(event.promiseId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Review reject error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reject failed" },
      { status: 500 },
    );
  }
}
