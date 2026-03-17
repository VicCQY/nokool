import { NextRequest, NextResponse } from "next/server";
import { syncExecutiveActions } from "@/lib/sync-executive-actions";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { politicianId, year } = body;

    if (!politicianId) {
      return NextResponse.json(
        { error: "politicianId is required" },
        { status: 400 },
      );
    }

    const result = await syncExecutiveActions(
      politicianId,
      year ? Number(year) : undefined,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
