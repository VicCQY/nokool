import { NextRequest, NextResponse } from "next/server";
import { syncFecSummary, syncAllFecSummaries } from "@/lib/sync-fec-summary";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.FEC_API_KEY && !process.env.FEC_API_KEYS) {
      return NextResponse.json(
        { error: "FEC API key is not configured" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { politicianId, cycles } = body;

    const electionYears: number[] = (cycles || [2024])
      .filter((c: number) => typeof c === "number" && c >= 2000 && c <= 2030);

    let result;
    if (politicianId) {
      result = await syncFecSummary(politicianId, electionYears);
    } else {
      // Sync all politicians
      result = await syncAllFecSummaries(electionYears);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("FEC summary sync error:", err);
    return NextResponse.json(
      { error: `Sync failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
