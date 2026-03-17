import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { matches } = await request.json();

    if (!Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json(
        { error: "Non-empty matches array required" },
        { status: 400 },
      );
    }

    let billLinks = 0;
    let actionLinks = 0;

    for (const m of matches) {
      const promiseId = String(m.promiseId);
      const itemId = String(m.itemId);
      const itemType = String(m.itemType);
      const alignment = m.alignment === "contradicts" ? "contradicts" : "aligns";

      try {
        if (itemType === "bill") {
          await prisma.promiseBillLink.upsert({
            where: {
              promiseId_billId: { promiseId, billId: itemId },
            },
            create: {
              promiseId,
              billId: itemId,
              relevance: "ai",
              alignment,
            },
            update: {
              alignment,
              relevance: "ai",
            },
          });
          billLinks++;
        } else if (itemType === "action") {
          await prisma.promiseActionLink.upsert({
            where: {
              promiseId_actionId: { promiseId, actionId: itemId },
            },
            create: {
              promiseId,
              actionId: itemId,
              alignment: alignment === "aligns" ? "supports" : "contradicts",
            },
            update: {
              alignment: alignment === "aligns" ? "supports" : "contradicts",
            },
          });
          actionLinks++;
        }
      } catch {
        // Skip individual errors (e.g., FK constraint)
      }
    }

    return NextResponse.json({
      success: true,
      billLinks,
      actionLinks,
      total: billLinks + actionLinks,
    });
  } catch (err) {
    console.error("Approve matches error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approval failed" },
      { status: 500 },
    );
  }
}
