import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { researchTimelines, isAiConfigured } from "@/lib/ai-provider";
import type { ResearchedPromiseBase } from "@/lib/ai-provider";

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
    const { politicianId, promises } = body;

    if (!politicianId || !Array.isArray(promises) || promises.length === 0) {
      return NextResponse.json(
        { error: "politicianId and non-empty promises array required" },
        { status: 400 },
      );
    }

    const pol = await prisma.politician.findUnique({
      where: { id: politicianId },
      select: { name: true, party: true, branch: true, chamber: true, state: true, district: true },
    });

    if (!pol) {
      return NextResponse.json({ error: "Politician not found" }, { status: 404 });
    }

    const position = getPosition(pol.branch, pol.chamber, pol.state, pol.district);
    const today = new Date().toISOString().split("T")[0];

    const promiseBases: ResearchedPromiseBase[] = promises.map((p: Record<string, unknown>) => ({
      title: String(p.title || ""),
      description: String(p.description || ""),
      category: String(p.category || "Other"),
      dateMade: String(p.dateMade || ""),
      sourceUrl: String(p.sourceUrl || ""),
      severity: Number(p.severity) || 3,
      expectedMonths: Number(p.expectedMonths) || 12,
      billRelated: p.billRelated === true,
    }));

    const timelines = await researchTimelines(pol.name, pol.party, position, promiseBases, today);

    return NextResponse.json({ success: true, timelines });
  } catch (err) {
    console.error("Timeline research error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Timeline research failed" },
      { status: 500 },
    );
  }
}
