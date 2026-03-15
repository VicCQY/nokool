import { prisma } from "@/lib/prisma";
import {
  searchCandidates,
  getCandidateCommittees,
  getCandidateDetail,
  getContributionsByEmployer,
  getContributions,
  getContributionsBySize,
  delay,
} from "@/lib/fec-api";
import type { FecCommittee } from "@/lib/fec-api";
import { classifyIndustry, guessDonorType } from "@/lib/fec-industries";
import { getElectionYears } from "@/lib/election-years";

// Employer names that are not real organizations — these are FEC employer
// field entries for individual donors and should be skipped entirely.
const EXCLUDED_EMPLOYERS = new Set([
  "retired",
  "self-employed",
  "self employed",
  "self",
  "not employed",
  "not applicable",
  "none",
  "n/a",
  "null",
  "information requested",
  "information requested per best efforts",
  "entrepreneur",
  "homemaker",
  "disabled",
  "student",
  "unemployed",
  "refused",
  "requested",
]);

function isRealEmployer(name: string): boolean {
  return !EXCLUDED_EMPLOYERS.has(name.toLowerCase().trim());
}

// Fundraising platforms that process donations but aren't real donors.
// Individual donations flow through these — counting both the individuals
// AND the platform transfer would double-count.
const PASSTHROUGH_PLATFORMS = new Set([
  "winred",
  "actblue",
  "anedot",
  "efundraising connections",
  "piryx",
  "revv",
]);

function isPassthroughPlatform(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return Array.from(PASSTHROUGH_PLATFORMS).some(
    (p) => lower.includes(p)
  );
}

// FEC placeholder text that appears as donor names — not real donors
function isFecPlaceholder(name: string): boolean {
  return name.toUpperCase().trim().startsWith("INFORMATION REQUESTED");
}

// Self-campaign committee patterns (name + year/office combos)
const SELF_CAMPAIGN_SUFFIXES = [
  "FOR PRESIDENT",
  "FOR SENATE",
  "FOR CONGRESS",
  "FOR AMERICA",
  "FOR TEXAS",
  "FOR KENTUCKY",
  "FOR IOWA",
  "FOR FLORIDA",
  "FOR OHIO",
  "FOR GEORGIA",
  "FOR ARIZONA",
  "VICTORY FUND",
  "JOINT FUNDRAISING",
  "LEADERSHIP PAC",
  "LEADERSHIP FUND",
];

/**
 * Check if a donor name looks like the candidate's own campaign committee.
 * Matches patterns like "BERNIE 2020", "CRUZ FOR PRESIDENT", "FRIENDS OF BERNIE", "AMY FOR AMERICA".
 */
function isSelfCampaignName(donorName: string, politicianName: string): boolean {
  const upper = donorName.toUpperCase();
  const parts = politicianName.toUpperCase().split(" ");
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];

  // Check if donor name contains first or last name
  const hasFirstName = upper.includes(firstName);
  const hasLastName = upper.includes(lastName);

  if (!hasFirstName && !hasLastName) return false;

  // Check for year pattern (e.g., "BERNIE 2020", "CRUZ 2024")
  if (/\b20\d{2}\b/.test(upper)) return true;

  // Check for "FRIENDS OF [NAME]"
  if (upper.includes("FRIENDS OF")) return true;

  // Check for campaign suffixes
  for (const suffix of SELF_CAMPAIGN_SUFFIXES) {
    if (upper.includes(suffix)) return true;
  }

  // Check for "COMMITTEE" or "JFC" with candidate name
  if (upper.includes("COMMITTEE") || upper.includes("JFC")) return true;

  return false;
}

// ── Candidate Matching ──

export interface FecMatchResult {
  matched: { name: string; fecCandidateId: string }[];
  unmatched: string[];
}

export async function matchFecCandidates(): Promise<FecMatchResult> {
  const usPoliticians = await prisma.politician.findMany({
    where: { country: "US" },
    select: { id: true, name: true, fecCandidateId: true, branch: true, chamber: true },
  });

  const matched: { name: string; fecCandidateId: string }[] = [];
  const unmatched: string[] = [];

  for (const pol of usPoliticians) {
    if (pol.fecCandidateId) {
      matched.push({ name: pol.name, fecCandidateId: pol.fecCandidateId });
      continue;
    }

    let office: string | undefined;
    if (pol.branch === "executive") office = "P";
    else if (pol.chamber === "senate") office = "S";
    else if (pol.chamber === "house") office = "H";

    try {
      await delay(500);
      let candidates = await searchCandidates(pol.name, office);

      // If full name search fails, try last name only
      if (candidates.length === 0) {
        const lastName = pol.name.split(" ").pop() || "";
        if (lastName && lastName !== pol.name) {
          await delay(500);
          candidates = await searchCandidates(lastName, office);
        }
      }

      if (candidates.length > 0) {
        const polLast = pol.name.split(" ").pop()?.toLowerCase() || "";
        const best =
          candidates.find((c) => c.name.toLowerCase().includes(polLast)) ||
          candidates[0];

        await prisma.politician.update({
          where: { id: pol.id },
          data: { fecCandidateId: best.candidate_id },
        });
        matched.push({ name: pol.name, fecCandidateId: best.candidate_id });
      } else {
        unmatched.push(pol.name);
      }
    } catch (err) {
      unmatched.push(
        `${pol.name} (error: ${err instanceof Error ? err.message : String(err)})`
      );
    }
  }

  return { matched, unmatched };
}

// ── Cycle helpers ──

/**
 * Determine FEC 2-year filing cycles to pull for a given election year.
 * - Senate: 6-year term → pull 3 cycles (electionYear, electionYear-2, electionYear-4)
 * - House: 2-year term → pull 1 cycle (electionYear)
 * - Executive: 4-year term → pull 2 cycles (electionYear, electionYear-2)
 */
function getFecFilingCycles(
  electionYear: number,
  chamber: string | null,
  branch: string | null
): number[] {
  if (branch === "executive") {
    return [electionYear, electionYear - 2];
  }
  if (chamber === "senate") {
    return [electionYear, electionYear - 2, electionYear - 4];
  }
  // house or default
  return [electionYear];
}

/**
 * Get the display label for an election cycle — always just the year.
 */
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

// ── Donation Sync ──

export interface DonationSyncResult {
  donorsCreated: number;
  donationsCreated: number;
  totalAmount: number;
  errors: string[];
}

async function upsertDonorAndDonation(
  donorName: string,
  donorType: "INDIVIDUAL" | "CORPORATION" | "PAC" | "SUPER_PAC" | "UNION" | "NONPROFIT",
  industry: string,
  politicianId: string,
  amount: number,
  cycle: string,
  result: DonationSyncResult
) {
  if (!donorName || amount <= 0) return;

  let donor = await prisma.donor.findFirst({
    where: { name: donorName, country: "US" },
  });

  if (!donor) {
    donor = await prisma.donor.create({
      data: {
        name: donorName,
        type: donorType,
        industry,
        country: "US",
      },
    });
    result.donorsCreated++;
  }

  const existing = await prisma.donation.findFirst({
    where: {
      donorId: donor.id,
      politicianId,
      electionCycle: cycle,
    },
  });

  if (existing) {
    // Update with the higher amount (accumulate across committees)
    await prisma.donation.update({
      where: { id: existing.id },
      data: { amount: existing.amount + amount },
    });
  } else {
    await prisma.donation.create({
      data: {
        donorId: donor.id,
        politicianId,
        amount,
        date: new Date(),
        electionCycle: cycle,
      },
    });
    result.donationsCreated++;
  }

  result.totalAmount += amount;
}

/**
 * Sync donations from a single committee for a single FEC filing cycle.
 */
async function syncCommitteeForCycle(
  committeeId: string,
  committeeName: string,
  allCommitteeNames: Set<string>,
  allCommitteeIds: Set<string>,
  politicianName: string,
  politicianId: string,
  fecCycle: number,
  cycleLabel: string,
  result: DonationSyncResult
) {
  // 1. Top employer contributions (aggregated totals)
  try {
    await delay(400);
    const employers = await getContributionsByEmployer(committeeId, fecCycle, 50);

    for (const emp of employers) {
      if (!emp.employer || !isRealEmployer(emp.employer)) continue;
      if (isPassthroughPlatform(emp.employer)) continue;
      if (isFecPlaceholder(emp.employer)) continue;
      if (isSelfCampaignName(emp.employer, politicianName)) continue;

      const donorType = guessDonorType(emp.employer);
      const industry = classifyIndustry(emp.employer, donorType);

      await upsertDonorAndDonation(
        emp.employer,
        donorType,
        industry,
        politicianId,
        emp.total,
        cycleLabel,
        result
      );
    }
  } catch (err) {
    result.errors.push(
      `Employer contributions ${committeeName} (${fecCycle}): ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 2. Top committee/PAC contributions (filter out self-transfers and platforms)
  try {
    await delay(400);
    const pacs = await getContributions(committeeId, "committee", 50);

    for (const pac of pacs) {
      if (!pac.contributor_name || pac.contribution_receipt_amount <= 0)
        continue;

      const upperName = pac.contributor_name.toUpperCase();

      // Skip pass-through fundraising platforms
      if (isPassthroughPlatform(pac.contributor_name)) continue;

      // Skip FEC placeholder names
      if (isFecPlaceholder(pac.contributor_name)) continue;

      // Skip transfers from the candidate's own committees (by committee ID)
      if (pac.committee_id && allCommitteeIds.has(pac.committee_id)) continue;

      // Skip transfers from the candidate's own committees (by name match)
      const isSelfTransfer = Array.from(allCommitteeNames).some(
        (cn) => upperName.includes(cn) || cn.includes(upperName)
      );
      if (isSelfTransfer) continue;

      // Skip self-campaign committees (name-based pattern matching)
      if (isSelfCampaignName(pac.contributor_name, politicianName)) continue;

      const donorType = guessDonorType(pac.contributor_name, "committee");
      const industry = classifyIndustry(pac.contributor_name, donorType);

      await upsertDonorAndDonation(
        pac.contributor_name,
        donorType,
        industry,
        politicianId,
        pac.contribution_receipt_amount,
        cycleLabel,
        result
      );
    }
  } catch (err) {
    result.errors.push(
      `Committee contributions ${committeeName} (${fecCycle}): ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 3. Aggregated individual donor totals from the by_size endpoint.
  try {
    await delay(400);
    const sizeBreakdown = await getContributionsBySize(committeeId, fecCycle);
    let smallDollarTotal = 0;
    let largeDollarTotal = 0;
    for (const s of sizeBreakdown) {
      if (s.size <= 200) {
        smallDollarTotal += s.total;
      } else {
        largeDollarTotal += s.total;
      }
    }

    if (smallDollarTotal > 0) {
      await upsertDonorAndDonation(
        "Small-Dollar Individual Donors (Under $200)",
        "INDIVIDUAL",
        "Individual Contributions",
        politicianId,
        smallDollarTotal,
        cycleLabel,
        result
      );
    }

    if (largeDollarTotal > 0) {
      await upsertDonorAndDonation(
        "Large-Dollar Individual Donors ($200+)",
        "INDIVIDUAL",
        "Individual Contributions",
        politicianId,
        largeDollarTotal,
        cycleLabel,
        result
      );
    }
  } catch (err) {
    result.errors.push(
      `Aggregated contributions ${committeeName} (${fecCycle}): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function syncFecDonations(
  politicianId: string,
  { replace = true }: { replace?: boolean } = {}
): Promise<DonationSyncResult> {
  const result: DonationSyncResult = {
    donorsCreated: 0,
    donationsCreated: 0,
    totalAmount: 0,
    errors: [],
  };

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
    result.errors.push(
      `${politician.name} has no FEC candidate ID. Run 'Match FEC Candidates' first.`
    );
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

  // Get ALL committees for this candidate
  let committees: FecCommittee[];
  try {
    await delay(500);
    committees = await getCandidateCommittees(politician.fecCandidateId);
  } catch (err) {
    result.errors.push(
      `Failed to get committees: ${err instanceof Error ? err.message : String(err)}`
    );
    return result;
  }

  if (committees.length === 0) {
    result.errors.push("No committees found for this candidate");
    return result;
  }

  // Collect all committee names and IDs (used to filter out self-transfers)
  const allCommitteeNames = new Set<string>();
  const allCommitteeIds = new Set<string>();
  for (const c of committees) {
    allCommitteeNames.add(c.name.toUpperCase());
    allCommitteeIds.add(c.committee_id);
  }

  for (const electionYear of validYears) {
    const cycleLabel = getCycleLabel(electionYear);
    const fecFilingCycles = getFecFilingCycles(electionYear, politician.chamber, politician.branch);

    result.errors.push(`${politician.name}: syncing ${cycleLabel} (FEC cycles: ${fecFilingCycles.join(", ")})`);

    // Delete existing donations for this politician+cycle label before re-importing
    if (replace) {
      const deleted = await prisma.donation.deleteMany({
        where: { politicianId, electionCycle: cycleLabel },
      });
      if (deleted.count > 0) {
        result.errors.push(`Cleared ${deleted.count} existing donations for ${cycleLabel}`);
      }
    }

    // Sync from ALL committees across all FEC filing cycles
    for (const committee of committees) {
      for (const fecCycle of fecFilingCycles) {
        // Check if this committee has data for this cycle
        const hasCycleData = committee.cycles?.includes(fecCycle);
        if (committee.cycles && !hasCycleData) continue;

        result.errors.push(`  Pulling from: ${committee.name} (${committee.committee_id}) cycle ${fecCycle}`);

        await syncCommitteeForCycle(
          committee.committee_id,
          committee.name,
          allCommitteeNames,
          allCommitteeIds,
          politician.name,
          politicianId,
          fecCycle,
          cycleLabel,
          result
        );
      }
    }
  }

  return result;
}
