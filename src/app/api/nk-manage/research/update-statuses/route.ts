import { NextRequest, NextResponse } from "next/server";
import { PromiseStatus } from "@prisma/client";
import { applyStatusChange } from "@/lib/promise-updates";

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
    let flagged = 0;
    let skipped = 0;

    for (const u of updates) {
      const promiseId = String(u.promiseId);
      const newStatus = String(u.status || u.suggestedStatus);
      const reason = String(u.reason || "");
      const confidence = String(u.confidence || "medium");
      const sourceUrl = String(u.sourceUrl || "");

      if (!VALID_STATUSES.has(newStatus)) {
        skipped++;
        continue;
      }

      // Use AI's eventDate if provided, otherwise fall back to now
      const eventDate = u.eventDate ? new Date(u.eventDate) : new Date();

      // If this came from the admin UI (human accepted the AI suggestion),
      // treat it as a human override
      const isHumanAccepted = u.humanApproved === true;

      const result = await applyStatusChange({
        promiseId,
        newStatus: newStatus as PromiseStatus,
        eventDate,
        title: reason || `Status updated to ${newStatus}`,
        description: reason || undefined,
        sourceUrl: sourceUrl || undefined,
        createdBy: isHumanAccepted ? "human" : "ai_auto",
        confidence: isHumanAccepted ? null : (confidence as "high" | "medium" | "low"),
      });

      if (result.applied) {
        updated++;
      } else if (result.flagged) {
        flagged++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({ success: true, updated, flagged, skipped });
  } catch (err) {
    console.error("Update statuses error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    );
  }
}
