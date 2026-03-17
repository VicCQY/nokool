import { NextRequest, NextResponse } from "next/server";
import { syncCongressVotes } from "@/lib/sync-votes";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.CONGRESS_API_KEY) {
      return NextResponse.json(
        { error: "CONGRESS_API_KEY is not configured" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const congress = body.congress === 119 ? 119 : 118;
    const limit = Math.min(Math.max(body.limit || 20, 1), 100);

    const result = await syncCongressVotes(congress, limit);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Sync votes error:", err);
    return NextResponse.json(
      {
        error: `Sync failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
