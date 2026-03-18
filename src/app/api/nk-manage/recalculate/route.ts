import { NextRequest, NextResponse } from "next/server";
import {
  recalculatePromiseStatus,
  recalculateAllForPolitician,
  recalculateAll,
} from "@/lib/calculate-promise-status";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { promiseId, politicianId } = body;

    // Single promise
    if (promiseId) {
      const newStatus = await recalculatePromiseStatus(promiseId);
      return NextResponse.json({ success: true, promiseId, newStatus });
    }

    // All promises for a politician
    if (politicianId) {
      const changed = await recalculateAllForPolitician(politicianId);
      return NextResponse.json({ success: true, politicianId, changed });
    }

    // All promises in the system
    const result = await recalculateAll();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Recalculate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recalculation failed" },
      { status: 500 },
    );
  }
}
