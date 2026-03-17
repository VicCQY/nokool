import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PromiseStatus } from "@prisma/client";

const VALID_STATUSES = new Set(["NOT_STARTED", "IN_PROGRESS", "FULFILLED", "PARTIAL", "BROKEN", "REVERSED"]);

export async function POST(request: NextRequest) {
  try {
    const { updates } = await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "Non-empty updates array required" },
        { status: 400 },
      );
    }

    let updated = 0;
    for (const u of updates) {
      const promiseId = String(u.promiseId);
      const newStatus = String(u.status);
      const reason = String(u.reason || "");

      if (!VALID_STATUSES.has(newStatus)) continue;

      const promise = await prisma.promise.findUnique({
        where: { id: promiseId },
        select: { status: true },
      });
      if (!promise) continue;

      const oldStatus = promise.status;
      if (oldStatus === newStatus) continue;

      await prisma.promise.update({
        where: { id: promiseId },
        data: { status: newStatus as PromiseStatus },
      });

      await prisma.promiseStatusChange.create({
        data: {
          promiseId,
          oldStatus: oldStatus as PromiseStatus,
          newStatus: newStatus as PromiseStatus,
          note: reason || "Status updated via AI research",
        },
      });

      updated++;
    }

    return NextResponse.json({ success: true, updated });
  } catch (err) {
    console.error("Update statuses error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    );
  }
}
