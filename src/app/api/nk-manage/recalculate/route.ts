import { NextRequest, NextResponse } from "next/server";
import {
  recalculatePromiseScore,
  recalculateAllScoresForPolitician,
  recalculateAllScores,
} from "@/lib/promise-score";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { promiseId, politicianId } = body;

    // Single promise
    if (promiseId) {
      const result = await recalculatePromiseScore(promiseId);
      return NextResponse.json({ success: true, promiseId, score: result.score, label: result.label });
    }

    // All promises for a politician
    if (politicianId) {
      const changed = await recalculateAllScoresForPolitician(politicianId);
      return NextResponse.json({ success: true, politicianId, changed });
    }

    // All promises in the system
    const result = await recalculateAllScores();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Recalculate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recalculation failed" },
      { status: 500 },
    );
  }
}
