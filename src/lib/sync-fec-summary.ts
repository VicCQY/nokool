import { prisma } from "@/lib/prisma";
import { getCandidateTotals, getCandidateDetail, delay } from "@/lib/fec-api";
import { getElectionYears } from "@/lib/election-years";

/**
 * Determine FEC 2-year filing cycles for a given election year.
 */
function getFecFilingCycles(
  electionYear: number,
  chamber: string | null,
  branch: string | null
): number[] {
  if (branch === "executive") return [electionYear, electionYear - 2];
  if (chamber === "senate") return [electionYear, electionYear - 2, electionYear - 4];
  return [electionYear];
}

function getCycleLabel(electionYear: number): string {
  return String(electionYear);
}

/** Cap at last completed election year (before November of even years). */
function getMaxElectionYear(): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  let maxYear = currentYear % 2 === 0 ? currentYear : currentYear - 1;
  if (currentYear % 2 === 0 && now.getMonth() < 11) maxYear = currentYear - 2;
  return maxYear;
}

/**
 * Get election years for a politician. Priority:
 * 1. Cached fecElectionYears from DB
 * 2. Fetch from FEC API and cache
 * 3. Fall back to calculation from getElectionYears()
 */
async function getResolvedElectionYears(
  politicianId: string,
  fecCandidateId: string | null,
  branch: string,
  chamber: string | null,
  cachedFecYears: string | null,
  inOfficeSince: Date | null,
  termStart: Date,
): Promise<number[]> {
  const maxYear = getMaxElectionYear();

  // 1. Try cached FEC election years
  if (cachedFecYears) {
    const years = cachedFecYears.split(",").map(Number).filter((y) => y >= 2000 && y <= maxYear);
    if (years.length > 0) return years.sort((a, b) => a - b);
  }

  // 2. Fetch from FEC API and cache
  if (fecCandidateId) {
    try {
      await delay(400);
      const candidateInfo = await getCandidateDetail(fecCandidateId);
      if (candidateInfo?.election_years && candidateInfo.election_years.length > 0) {
        const allYears = candidateInfo.election_years;
        const cached = allYears.sort((a, b) => a - b).join(",");
        await prisma.politician.update({
          where: { id: politicianId },
          data: { fecElectionYears: cached },
        });
        return allYears.filter((y) => y >= 2000 && y <= maxYear).sort((a, b) => a - b);
      }
    } catch {
      // Non-fatal — fall through to calculation
    }
  }

  // 3. Fall back to calculated years
  return getElectionYears(branch, chamber, inOfficeSince || termStart);
}

export interface FecSummarySyncResult {
  synced: number;
  errors: string[];
}

/**
 * Sync FEC official summary totals for a politician.
 * Uses the /candidate/{id}/totals/ endpoint which returns pre-calculated figures.
 */
export async function syncFecSummary(
  politicianId: string,
): Promise<FecSummarySyncResult> {
  const result: FecSummarySyncResult = { synced: 0, errors: [] };

  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: {
      name: true, fecCandidateId: true, branch: true, chamber: true,
      fecElectionYears: true, inOfficeSince: true, termStart: true,
    },
  });

  if (!politician) {
    result.errors.push("Politician not found");
    return result;
  }

  if (!politician.fecCandidateId) {
    result.errors.push(`${politician.name}: no FEC candidate ID`);
    return result;
  }

  const validYears = await getResolvedElectionYears(
    politicianId,
    politician.fecCandidateId,
    politician.branch,
    politician.chamber,
    politician.fecElectionYears,
    politician.inOfficeSince,
    politician.termStart,
  );

  for (const electionYear of validYears) {
    const cycleLabel = getCycleLabel(electionYear);
    const fecCycles = getFecFilingCycles(electionYear, politician.chamber, politician.branch);

    // Accumulate totals across all FEC filing cycles
    let totalReceipts = 0;
    let individualItemized = 0;
    let individualUnitemized = 0;
    let pacTotal = 0;
    let partyTotal = 0;
    let candidateTotal = 0;
    let disbursements = 0;
    let cashOnHand = 0;
    let debt = 0;
    let hasData = false;

    for (const fecCycle of fecCycles) {
      try {
        await delay(400);
        const totals = await getCandidateTotals(politician.fecCandidateId, fecCycle);
        if (totals) {
          hasData = true;
          totalReceipts += totals.receipts || 0;
          individualItemized += totals.individual_itemized_contributions || 0;
          individualUnitemized += totals.individual_unitemized_contributions || 0;
          pacTotal += totals.other_political_committee_contributions || 0;
          partyTotal += totals.transfers_from_affiliated_committee || 0;
          candidateTotal += totals.candidate_contribution || 0;
          disbursements += totals.disbursements || 0;
          cashOnHand = totals.cash_on_hand_end_period || cashOnHand;
          debt = totals.debts_owed_by_committee || debt;
        }
      } catch (err) {
        result.errors.push(
          `${politician.name} (${fecCycle}): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (!hasData) {
      result.errors.push(`${politician.name}: no FEC data for ${cycleLabel}`);
      continue;
    }

    const individualTotal = individualItemized + individualUnitemized;
    const otherTotal = Math.max(0, totalReceipts - individualTotal - pacTotal - partyTotal - candidateTotal);

    await prisma.fecSummary.upsert({
      where: {
        politicianId_cycle: { politicianId, cycle: cycleLabel },
      },
      create: {
        politicianId,
        cycle: cycleLabel,
        totalReceipts,
        individualTotal,
        pacTotal,
        partyTotal,
        candidateTotal,
        otherTotal,
        disbursements,
        cashOnHand,
        debt,
      },
      update: {
        totalReceipts,
        individualTotal,
        pacTotal,
        partyTotal,
        candidateTotal,
        otherTotal,
        disbursements,
        cashOnHand,
        debt,
        fetchedAt: new Date(),
      },
    });

    result.synced++;
    result.errors.push(`${politician.name}: ${cycleLabel} — receipts $${totalReceipts.toLocaleString()}`);
  }

  return result;
}

/**
 * Sync FEC summaries for ALL US politicians with FEC IDs.
 */
export async function syncAllFecSummaries(): Promise<FecSummarySyncResult> {
  const allResult: FecSummarySyncResult = { synced: 0, errors: [] };

  const politicians = await prisma.politician.findMany({
    where: { country: "US", fecCandidateId: { not: null } },
    select: { id: true },
  });

  for (const pol of politicians) {
    const r = await syncFecSummary(pol.id);
    allResult.synced += r.synced;
    allResult.errors.push(...r.errors);
  }

  return allResult;
}
