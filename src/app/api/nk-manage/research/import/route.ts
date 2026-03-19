import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PromiseStatus } from "@prisma/client";
import { recordPromiseEvent } from "@/lib/promise-updates";

const EVENT_TYPE_MAP: Record<string, string> = {
  executive_action: "executive_action",
  legislation: "legislation",
};

const VALID_STATUSES = new Set(["KEPT", "FIGHTING", "STALLED", "NOTHING", "BROKE"]);

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
      const weight = Math.max(1, Math.min(5, Number(p.weight || p.severity) || 3));
      const expectedMonths = p.expectedMonths ? Math.max(1, Number(p.expectedMonths)) : null;

      // Use AI's status directly, default to NOTHING
      const aiStatus = String(p.status || "NOTHING").toUpperCase();
      const status = VALID_STATUSES.has(aiStatus) ? aiStatus : "NOTHING";

      const promise = await prisma.promise.create({
        data: {
          politicianId,
          title: String(p.title || "").slice(0, 500),
          description: String(p.description || ""),
          category: String(p.category || "Other"),
          status: status as PromiseStatus,
          weight,
          expectedMonths,
          billRelated: p.billRelated === true,
          dateMade: new Date(p.dateMade || Date.now()),
          sourceUrl: p.sourceUrl || null,
        },
      });

      // Create "promise_made" event
      await recordPromiseEvent({
        promiseId: promise.id,
        eventType: "promise_made",
        eventDate: new Date(p.dateMade || Date.now()),
        title: `Promise made: ${String(p.title || "").slice(0, 200)}`,
        sourceUrl: p.sourceUrl || undefined,
        createdBy: "human",
        reviewed: true,
        approved: true,
      });

      // Process timeline events — only legislation and executive_action
      const timeline = Array.isArray(p.timeline) ? p.timeline : [];

      for (const evt of timeline) {
        if (!evt || typeof evt !== "object") continue;

        const evtDate = String(evt.date || "");
        if (!evtDate || isNaN(new Date(evtDate).getTime())) continue;

        const evtType = String(evt.type || "legislation");
        const mappedType = EVENT_TYPE_MAP[evtType] || "legislation";

        await recordPromiseEvent({
          promiseId: promise.id,
          eventType: mappedType,
          eventDate: new Date(evtDate),
          title: String(evt.title || ""),
          description: String(evt.description || "") || undefined,
          sourceUrl: String(evt.sourceUrl || "") || undefined,
          createdBy: "human",
          reviewed: true,
          approved: true,
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
