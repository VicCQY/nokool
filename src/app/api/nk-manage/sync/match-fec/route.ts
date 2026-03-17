import { NextResponse } from "next/server";
import { matchFecCandidates } from "@/lib/sync-donations";

export const maxDuration = 60;

export async function POST() {
  try {
    if (!process.env.FEC_API_KEY) {
      return NextResponse.json(
        { error: "FEC_API_KEY is not configured" },
        { status: 400 }
      );
    }

    const result = await matchFecCandidates();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Match FEC error:", err);
    return NextResponse.json(
      { error: `Failed to match candidates: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
