import { NextRequest, NextResponse } from "next/server";
import { syncFecDonations } from "@/lib/sync-donations";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.FEC_API_KEY) {
      return NextResponse.json(
        { error: "FEC_API_KEY is not configured" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { politicianId, cycles } = body;

    if (!politicianId) {
      return NextResponse.json(
        { error: "politicianId is required" },
        { status: 400 }
      );
    }

    const validCycles = (cycles || [2024])
      .filter((c: number) => [2020, 2022, 2024].includes(c));

    const result = await syncFecDonations(politicianId, validCycles);
    return NextResponse.json(result);
  } catch (err) {
    console.error("FEC sync error:", err);
    return NextResponse.json(
      { error: `Sync failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
