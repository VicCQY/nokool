import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { researchPromises, isAiConfigured } from "@/lib/ai-provider";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI provider not configured. Set ANTHROPIC_API_KEY in .env" },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();

    let politicianName: string;
    let country = "US";
    let party = "";

    if (body.politicianId) {
      const pol = await prisma.politician.findUnique({
        where: { id: body.politicianId },
        select: { name: true, country: true, party: true },
      });
      if (!pol) {
        return NextResponse.json({ error: "Politician not found" }, { status: 404 });
      }
      politicianName = pol.name;
      country = pol.country;
      party = pol.party;
    } else {
      politicianName = body.politicianName;
      country = body.country || "US";
      party = body.party || "";
    }

    if (!politicianName) {
      return NextResponse.json({ error: "politicianName is required" }, { status: 400 });
    }

    const promises = await researchPromises(politicianName, country, party);

    return NextResponse.json({ success: true, promises });
  } catch (err) {
    console.error("Promise research error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed" },
      { status: 500 },
    );
  }
}
