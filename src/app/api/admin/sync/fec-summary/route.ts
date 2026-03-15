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
    const { politicianId } = body;

    let result;
    if (politicianId) {
      // Election years are resolved internally from FEC API / cache / calculation
      result = await syncFecSummary(politicianId);
    } else {
      result = await syncAllFecSummaries();
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
