import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { researchPromises, isAiConfigured } from "@/lib/ai-provider";

export const maxDuration = 300;

function getPosition(branch: string, chamber: string | null, state: string | null, district: string | null): string {
  if (branch === "executive") {
    return "President of the United States";
  }
  if (chamber === "senate") {
    return `U.S. Senator from ${state || "unknown state"}`;
  }
  return `U.S. Representative for ${district || state || "unknown district"}`;
}

export async function POST(request: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI provider not configured. Set PERPLEXITY_API_KEY in .env" },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();

    let politicianName: string;
    let party = "";
    let position = "";

    if (body.politicianId) {
      const pol = await prisma.politician.findUnique({
        where: { id: body.politicianId },
        select: { name: true, party: true, branch: true, chamber: true, state: true, district: true },
      });
      if (!pol) {
        return NextResponse.json({ error: "Politician not found" }, { status: 404 });
      }
      politicianName = pol.name;
      party = pol.party;
      position = getPosition(pol.branch, pol.chamber, pol.state, pol.district);
    } else {
      politicianName = body.politicianName;
      party = body.party || "";
      position = body.position || "U.S. politician";
    }

    if (!politicianName) {
      return NextResponse.json({ error: "politicianName is required" }, { status: 400 });
    }

    const promises = await researchPromises(politicianName, party, position);

    return NextResponse.json({ success: true, promises });
  } catch (err) {
    console.error("Promise research error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed" },
      { status: 500 },
    );
  }
}
