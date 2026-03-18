import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculatePromiseStatus } from "@/lib/calculate-promise-status";

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

    // Recalculate status — the newly approved event may change it
    await recalculatePromiseStatus(event.promiseId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Review approve error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approve failed" },
      { status: 500 },
    );
  }
}
