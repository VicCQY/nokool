import { NextRequest, NextResponse } from "next/server";
import { matchPromisesToBills, isAiConfigured } from "@/lib/ai-provider";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI provider not configured. Set PERPLEXITY_API_KEY in .env" },
      { status: 503 },
    );
  }

  try {
    const { politicianId } = await request.json();

    if (!politicianId) {
      return NextResponse.json({ error: "politicianId is required" }, { status: 400 });
    }

    const matches = await matchPromisesToBills(politicianId);

    return NextResponse.json({ success: true, matches });
  } catch (err) {
    console.error("Match promises error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Matching failed" },
      { status: 500 },
    );
  }
}
