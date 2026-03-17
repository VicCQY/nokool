import { NextRequest, NextResponse } from "next/server";
import { runFullVoteSync } from "@/lib/full-vote-sync";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const congress = Number(body.congress) || 118;
  const chamber = (body.chamber || "both") as "house" | "senate" | "both";

  if (![118, 119].includes(congress)) {
    return NextResponse.json({ error: "Congress must be 118 or 119" }, { status: 400 });
  }
  if (!["house", "senate", "both"].includes(chamber)) {
    return NextResponse.json({ error: "Chamber must be house, senate, or both" }, { status: 400 });
  }

  try {
    const result = await runFullVoteSync(congress, chamber);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}
