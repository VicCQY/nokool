import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ISSUE_WEIGHTS } from "@/lib/issue-weights";
import { invalidateIssueWeightsCache } from "@/lib/issue-weights-cache";

export async function GET() {
  const dbWeights = await prisma.issueWeight.findMany({
    orderBy: { category: "asc" },
  });

  // Merge DB weights with defaults so all categories are present
  const allCategories = Object.keys(ISSUE_WEIGHTS);
  const dbMap = new Map(dbWeights.map((w) => [w.category, w]));

  const weights = allCategories.map((category) => {
    const db = dbMap.get(category);
    return {
      category,
      weight: db?.weight ?? ISSUE_WEIGHTS[category],
      source: db?.source ?? "Pew Research Center, Sept 2024 (default)",
      updatedAt: db?.updatedAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json(weights);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { weights } = body as {
    weights: Array<{ category: string; weight: number; source: string }>;
  };

  if (!Array.isArray(weights)) {
    return NextResponse.json({ error: "weights array required" }, { status: 400 });
  }

  for (const w of weights) {
    if (w.weight < 1 || w.weight > 5) {
      return NextResponse.json(
        { error: `Weight for ${w.category} must be between 1.0 and 5.0` },
        { status: 400 },
      );
    }
  }

  // Upsert all weights
  for (const w of weights) {
    await prisma.issueWeight.upsert({
      where: { category: w.category },
      update: { weight: w.weight, source: w.source || null },
      create: { category: w.category, weight: w.weight, source: w.source || null },
    });
  }

  invalidateIssueWeightsCache();

  return NextResponse.json({ success: true });
}
