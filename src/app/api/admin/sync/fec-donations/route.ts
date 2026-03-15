import { NextRequest, NextResponse } from "next/server";
import { syncFecDonations } from "@/lib/sync-donations";

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

    if (!politicianId) {
      return NextResponse.json(
        { error: "politicianId is required" },
        { status: 400 }
      );
    }

    // Election years are resolved internally from FEC API / cache / calculation
    const result = await syncFecDonations(politicianId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("FEC sync error:", err);
    return NextResponse.json(
      { error: `Sync failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
