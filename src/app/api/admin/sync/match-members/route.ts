import { NextResponse } from "next/server";
import { matchMembers } from "@/lib/sync-votes";

export const maxDuration = 60;

export async function POST() {
  try {
    if (!process.env.CONGRESS_API_KEY) {
      return NextResponse.json(
        { error: "CONGRESS_API_KEY is not configured" },
        { status: 400 }
      );
    }

    const result = await matchMembers();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Match members error:", err);
    return NextResponse.json(
      {
        error: `Failed to match members: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }
}
