import { NextRequest, NextResponse } from "next/server";
import { backfillVotesForPolitician } from "@/lib/full-vote-sync";

export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { politicianId } = body;

  if (!politicianId || typeof politicianId !== "string") {
    return NextResponse.json({ error: "politicianId is required" }, { status: 400 });
  }

  try {
    const result = await backfillVotesForPolitician(politicianId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backfill failed" },
      { status: 500 },
    );
  }
}
