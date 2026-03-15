import { prisma } from "@/lib/prisma";
import { getCandidateTotals, getCandidateDetail, delay } from "@/lib/fec-api";

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

/**
 * Filter a list of requested election years to only the valid ones for this
 * politician type:
 * - Senate: every 6 years based on their class (derived from FEC election_years)
 * - Executive: every 4 years (2020, 2024, ...)
 * - House: every 2 years (all even years)
 */
/**
 * Determine which election years to sync.
 * For senators: use FEC API's election_years directly (source of truth for senate class).
 * For others: filter requestedYears by cycle length.
 * Always cap at the last completed election year and limit count.
 */
function resolveElectionYears(
  requestedYears: number[],
  chamber: string | null,
  branch: string | null,
  fecElectionYears?: number[]
): number[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  let maxYear = currentYear % 2 === 0 ? currentYear : currentYear - 1;
  if (currentYear % 2 === 0 && now.getMonth() < 11) maxYear = currentYear - 2;

  if (chamber === "senate" && fecElectionYears && fecElectionYears.length > 0) {
    // Use FEC's election_years directly — they know the senate class
    return fecElectionYears
      .filter((y) => y <= maxYear && y >= 2000)
      .sort((a, b) => b - a)
      .slice(0, 2);
  }
  if (branch === "executive") {
    return requestedYears.filter((y) => y % 4 === 0 && y <= maxYear).slice(-2);
  }
  // House: every even year
  return requestedYears.filter((y) => y % 2 === 0 && y <= maxYear).slice(-3);
}

function getCycleLabel(electionYear: number): string {
  return String(electionYear);
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
  electionYears: number[] = [2024]
): Promise<FecSummarySyncResult> {
  const result: FecSummarySyncResult = { synced: 0, errors: [] };

  const politician = await prisma.politician.findUnique({
    where: { id: politicianId },
    select: { name: true, fecCandidateId: true, branch: true, chamber: true },
  });

  if (!politician) {
    result.errors.push("Politician not found");
    return result;
  }

  if (!politician.fecCandidateId) {
    result.errors.push(`${politician.name}: no FEC candidate ID`);
    return result;
  }

  // Fetch FEC candidate info to get their actual election years
  let fecElectionYears: number[] | undefined;
  try {
    await delay(400);
    const candidateInfo = await getCandidateDetail(politician.fecCandidateId);
    fecElectionYears = candidateInfo?.election_years;
  } catch {
    // Non-fatal — we'll just use all requested years
  }

  const validYears = resolveElectionYears(
    electionYears,
    politician.chamber,
    politician.branch,
    fecElectionYears
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
          // For cash and debt, use the most recent cycle's value (not cumulative)
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
export async function syncAllFecSummaries(
  electionYears: number[] = [2024]
): Promise<FecSummarySyncResult> {
  const allResult: FecSummarySyncResult = { synced: 0, errors: [] };

  const politicians = await prisma.politician.findMany({
    where: { country: "US", fecCandidateId: { not: null } },
    select: { id: true },
  });

  for (const pol of politicians) {
    const r = await syncFecSummary(pol.id, electionYears);
    allResult.synced += r.synced;
    allResult.errors.push(...r.errors);
  }

  return allResult;
}
