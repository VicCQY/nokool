import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { researchNews, isAiConfigured } from "@/lib/ai-provider";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI provider not configured. Set PERPLEXITY_API_KEY in .env" },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();

    if (!body.politicianId) {
      return NextResponse.json({ error: "politicianId is required" }, { status: 400 });
    }

    const pol = await prisma.politician.findUnique({
      where: { id: body.politicianId },
      select: { name: true },
    });

    if (!pol) {
      return NextResponse.json({ error: "Politician not found" }, { status: 404 });
    }

    const articles = await researchNews(pol.name);

    return NextResponse.json({ success: true, articles });
  } catch (err) {
    console.error("News research error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "News research failed" },
      { status: 500 },
    );
  }
}
