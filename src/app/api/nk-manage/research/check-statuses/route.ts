import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPromiseStatuses, isAiConfigured } from "@/lib/ai-provider";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI provider not configured. Set PERPLEXITY_API_KEY in .env" },
      { status: 503 },
    );
  }

  try {
    const { politicianId, promiseIds } = await request.json();

    if (!politicianId) {
      return NextResponse.json({ error: "politicianId is required" }, { status: 400 });
    }

    const pol = await prisma.politician.findUnique({
      where: { id: politicianId },
      select: { name: true, party: true },
    });

    if (!pol) {
      return NextResponse.json({ error: "Politician not found" }, { status: 404 });
    }

    const where: { politicianId: string; id?: { in: string[] } } = { politicianId };
    if (Array.isArray(promiseIds) && promiseIds.length > 0) {
      where.id = { in: promiseIds };
    }

    const promises = await prisma.promise.findMany({
      where,
      select: { id: true, title: true, description: true, status: true },
      orderBy: { dateMade: "desc" },
    });

    const suggestions = await checkPromiseStatuses(pol.name, pol.party, promises);

    return NextResponse.json({ success: true, suggestions });
  } catch (err) {
    console.error("Check statuses error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status check failed" },
      { status: 500 },
    );
  }
}
