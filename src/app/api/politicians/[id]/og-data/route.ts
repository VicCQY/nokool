import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateFulfillment } from "@/lib/grades";
import { getIssueWeights } from "@/lib/issue-weights-cache";
import { calculateKoolAidLevel } from "@/lib/koolaid";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
    select: {
      name: true,
      party: true,
      country: true,
      branch: true,
      chamber: true,
      termStart: true,
      termEnd: true,
      promises: {
        select: { status: true, category: true, weight: true, dateMade: true, score: true },
      },
    },
  });

  if (!politician) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const weights = await getIssueWeights();
  const { percentage, grade } = calculateFulfillment(
    politician.promises,
    undefined,
    weights,
  );
  const koolAid = calculateKoolAidLevel(percentage);

  return NextResponse.json({
    name: politician.name,
    party: politician.party,
    country: politician.country,
    grade,
    percentage,
    promiseCount: politician.promises.length,
    koolAidTier: koolAid.tier,
    koolAidColor: koolAid.color,
  });
}
