import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PromiseStatus } from "@prisma/client";
import { recordPromiseEvent, applyStatusChange } from "@/lib/promise-updates";

const VALID_STATUSES: Set<string> = new Set([
  "NOT_STARTED", "IN_PROGRESS", "FULFILLED", "PARTIAL", "BROKEN", "REVERSED",
]);

export async function POST(request: NextRequest) {
  try {
    const { politicianId, promises } = await request.json();

    if (!politicianId || !Array.isArray(promises) || promises.length === 0) {
      return NextResponse.json(
        { error: "politicianId and non-empty promises array required" },
        { status: 400 },
      );
    }

    const politician = await prisma.politician.findUnique({
      where: { id: politicianId },
      select: { id: true, name: true },
    });

    if (!politician) {
      return NextResponse.json({ error: "Politician not found" }, { status: 404 });
    }

    let created = 0;
    for (const p of promises) {
      const status = VALID_STATUSES.has(p.status) ? p.status : "NOT_STARTED";
      const weight = Math.max(1, Math.min(5, Number(p.weight || p.severity) || 3));
      const expectedMonths = p.expectedMonths ? Math.max(1, Number(p.expectedMonths)) : null;
      const confidence = p.statusConfidence || "low";

      // Create the promise with NOT_STARTED initially
      const promise = await prisma.promise.create({
        data: {
          politicianId,
          title: String(p.title || "").slice(0, 500),
          description: String(p.description || ""),
          category: String(p.category || "Other"),
          status: "NOT_STARTED" as PromiseStatus,
          weight,
          expectedMonths,
          billRelated: p.billRelated === true,
          dateMade: new Date(p.dateMade || Date.now()),
          sourceUrl: p.sourceUrl || null,
        },
      });

      // Create initial PromiseStatusChange (backward compat)
      await prisma.promiseStatusChange.create({
        data: {
          promiseId: promise.id,
          oldStatus: null,
          newStatus: "NOT_STARTED" as PromiseStatus,
          note: "Initial status from AI research import",
        },
      });

      // Create "promise_made" event
      await recordPromiseEvent({
        promiseId: promise.id,
        eventType: "promise_made",
        eventDate: new Date(p.dateMade || Date.now()),
        title: `Promise made: ${String(p.title || "").slice(0, 200)}`,
        sourceUrl: p.sourceUrl || undefined,
        createdBy: "ai_auto",
        confidence,
        reviewed: false,
        approved: true,
      });

      // If AI provided a non-NOT_STARTED status, apply it through the rules engine
      if (status !== "NOT_STARTED") {
        const eventDate = p.statusDate
          ? new Date(p.statusDate)
          : new Date();

        await applyStatusChange({
          promiseId: promise.id,
          newStatus: status as PromiseStatus,
          eventDate,
          title: p.statusReason || `Initial status set to ${status} via AI research`,
          description: p.statusReason || undefined,
          sourceUrl: p.statusSource || undefined,
          createdBy: confidence === "high" ? "ai_auto" : "ai_flagged",
          confidence,
        });
      }

      created++;
    }

    return NextResponse.json({
      success: true,
      imported: created,
      politicianName: politician.name,
    });
  } catch (err) {
    console.error("Research import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 },
    );
  }
}
