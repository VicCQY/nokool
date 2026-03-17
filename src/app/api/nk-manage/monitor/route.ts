import { NextRequest, NextResponse } from "next/server";
import { monitorPromises } from "@/lib/monitor";
import { isAiConfigured } from "@/lib/ai-provider";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI provider not configured" },
      { status: 503 },
    );
  }

  try {
    const { politicianId } = await request.json();

    if (!politicianId) {
      return NextResponse.json({ error: "politicianId required" }, { status: 400 });
    }

    const result = await monitorPromises(politicianId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Monitor error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Monitor failed" },
      { status: 500 },
    );
  }
}
