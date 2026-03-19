import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateFulfillment } from "@/lib/grades";
import { getIssueWeights } from "@/lib/issue-weights-cache";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { politicianId } = body;

    const issueWeights = await getIssueWeights();

    if (politicianId) {
      const promises = await prisma.promise.findMany({
        where: { politicianId },
        select: { status: true, weight: true, category: true },
      });
      const { percentage, grade } = calculateFulfillment(promises, undefined, issueWeights);
      return NextResponse.json({ success: true, politicianId, percentage, grade });
    }

    // All politicians
    const politicians = await prisma.politician.findMany({
      select: {
        id: true,
        name: true,
        promises: { select: { status: true, weight: true, category: true } },
      },
    });

    const results = politicians.map((pol) => {
      const { percentage, grade } = calculateFulfillment(pol.promises, undefined, issueWeights);
      return { id: pol.id, name: pol.name, percentage, grade, promises: pol.promises.length };
    });

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("Recalculate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recalculation failed" },
      { status: 500 },
    );
  }
}
