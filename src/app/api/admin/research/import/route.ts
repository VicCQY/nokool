import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PromiseStatus } from "@prisma/client";

const VALID_STATUSES: Set<string> = new Set([
  "NOT_STARTED", "IN_PROGRESS", "FULFILLED", "PARTIAL", "BROKEN",
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
      const weight = Math.max(1, Math.min(5, Number(p.weight) || 3));

      const promise = await prisma.promise.create({
        data: {
          politicianId,
          title: String(p.title || "").slice(0, 500),
          description: String(p.description || ""),
          category: String(p.category || "Other"),
          status: status as PromiseStatus,
          weight,
          dateMade: new Date(p.dateMade || Date.now()),
          sourceUrl: p.sourceUrl || null,
        },
      });

      await prisma.promiseStatusChange.create({
        data: {
          promiseId: promise.id,
          oldStatus: null,
          newStatus: status as PromiseStatus,
          note: "Initial status from AI research import",
        },
      });

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
