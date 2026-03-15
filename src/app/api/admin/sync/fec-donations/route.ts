import { NextRequest, NextResponse } from "next/server";
import { syncFecDonations } from "@/lib/sync-donations";
import { prisma } from "@/lib/prisma";
import { getElectionYears } from "@/lib/election-years";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.FEC_API_KEY && !process.env.FEC_API_KEYS) {
      return NextResponse.json(
        { error: "FEC API key is not configured" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { politicianId, cycles } = body;

    if (!politicianId) {
      return NextResponse.json(
        { error: "politicianId is required" },
        { status: 400 }
      );
    }

    let electionYears: number[];
    if (cycles && Array.isArray(cycles) && cycles.length > 0) {
      electionYears = cycles.filter((c: number) => typeof c === "number" && c >= 2000 && c <= 2030);
    } else {
      // Auto-determine election years from politician data
      const pol = await prisma.politician.findUnique({
        where: { id: politicianId },
        select: { branch: true, chamber: true, inOfficeSince: true, termStart: true },
      });
      if (!pol) {
        return NextResponse.json({ error: "Politician not found" }, { status: 404 });
      }
      electionYears = getElectionYears(pol.branch, pol.chamber, pol.inOfficeSince || pol.termStart);
    }

    const result = await syncFecDonations(politicianId, electionYears);
    return NextResponse.json(result);
  } catch (err) {
    console.error("FEC sync error:", err);
    return NextResponse.json(
      { error: `Sync failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
