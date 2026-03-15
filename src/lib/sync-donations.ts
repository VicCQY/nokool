import { prisma } from "@/lib/prisma";
import {
  searchCandidates,
  getCandidateCommittees,
  getContributionsByEmployer,
  getContributions,
  getContributionsBySize,
  getCommitteeTotals,
  delay,
} from "@/lib/fec-api";
import type { FecCommittee } from "@/lib/fec-api";
import { classifyIndustry, guessDonorType } from "@/lib/fec-industries";

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
    await prisma.donation.update({
      where: { id: existing.id },
      data: { amount },
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
 * Find the best committee for a candidate in a given cycle.
 * Strategy: get all committees, fetch their financial totals,
 * and pick the one with the highest receipts for this cycle.
 */
async function findBestCommittee(
  committees: FecCommittee[],
  cycle: number
): Promise<{ committeeId: string; committeeName: string; allCommitteeNames: Set<string> }> {
  // Collect all committee names (used to filter out self-transfers)
  const allCommitteeNames = new Set<string>();
  for (const c of committees) {
    allCommitteeNames.add(c.name.toUpperCase());
  }

  // Try to find the committee with the most receipts for this cycle
  let bestId = committees[0].committee_id;
  let bestName = committees[0].name;
  let bestReceipts = 0;

  for (const c of committees) {
    try {
      await delay(300);
      const totals = await getCommitteeTotals(c.committee_id, cycle);
      if (totals && totals.receipts > bestReceipts) {
        bestReceipts = totals.receipts;
        bestId = c.committee_id;
        bestName = c.name;
      }
    } catch {
      // skip committees that error
    }
  }

  return { committeeId: bestId, committeeName: bestName, allCommitteeNames };
}

export async function syncFecDonations(
  politicianId: string,
  cycles: number[] = [2024],
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
    select: { name: true, fecCandidateId: true },
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

  // Get all committees for this candidate
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

  for (const cycle of cycles) {
    const cycleStr = String(cycle);

    // Delete existing donations for this politician+cycle before re-importing
    if (replace) {
      const deleted = await prisma.donation.deleteMany({
        where: { politicianId, electionCycle: cycleStr },
      });
      if (deleted.count > 0) {
        result.errors.push(`Cleared ${deleted.count} existing donations for ${cycleStr} cycle`);
      }
    }

    // Find the committee with the most money for this cycle
    const { committeeId, committeeName, allCommitteeNames } =
      await findBestCommittee(committees, cycle);

    result.errors.push(`Using committee: ${committeeName} (${committeeId})`);

    // 1. Top employer contributions (aggregated totals)
    try {
      await delay(500);
      const employers = await getContributionsByEmployer(committeeId, cycle, 50);

      for (const emp of employers) {
        if (!emp.employer || !isRealEmployer(emp.employer)) continue;

        const industry = classifyIndustry(emp.employer);
        const donorType = guessDonorType(emp.employer);

        await upsertDonorAndDonation(
          emp.employer,
          donorType,
          industry,
          politicianId,
          emp.total,
          cycleStr,
          result
        );
      }
    } catch (err) {
      result.errors.push(
        `Employer contributions (${cycle}): ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // 2. Top committee/PAC contributions (filter out self-transfers)
    try {
      await delay(500);
      const pacs = await getContributions(committeeId, "committee", 50);

      for (const pac of pacs) {
        if (!pac.contributor_name || pac.contribution_receipt_amount <= 0)
          continue;

        // Skip transfers from the candidate's own committees
        const upperName = pac.contributor_name.toUpperCase();
        const isSelfTransfer = Array.from(allCommitteeNames).some(
          (cn) => upperName.includes(cn) || cn.includes(upperName)
        );
        if (isSelfTransfer) continue;

        // Also skip committees with the candidate's name (JFCs, victory funds, etc.)
        const polLastName = politician.name.split(" ").pop()?.toUpperCase() || "";
        if (
          upperName.includes(polLastName) &&
          (upperName.includes("COMMITTEE") ||
            upperName.includes("JFC") ||
            upperName.includes("JOINT FUNDRAISING") ||
            upperName.includes("VICTORY FUND") ||
            upperName.includes("SAVE AMERICA"))
        ) {
          continue;
        }

        const industry = classifyIndustry(pac.contributor_name);
        const donorType = guessDonorType(pac.contributor_name, "committee");

        await upsertDonorAndDonation(
          pac.contributor_name,
          donorType,
          industry,
          politicianId,
          pac.contribution_receipt_amount,
          cycleStr,
          result
        );
      }
    } catch (err) {
      result.errors.push(
        `Committee contributions (${cycle}): ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // 3. Aggregated individual donor totals from the by_size endpoint.
    // We only create two aggregate entries (small-dollar and large-dollar)
    // rather than importing named individual donors, which would double-count.
    try {
      await delay(500);
      const sizeBreakdown = await getContributionsBySize(committeeId, cycle);
      let smallDollarTotal = 0;
      let largeDollarTotal = 0;
      for (const s of sizeBreakdown) {
        if (s.size <= 200) {
          smallDollarTotal += s.total;
        } else {
          largeDollarTotal += s.total;
        }
      }

      // Add small-dollar donors as an aggregated entry (if significant)
      if (smallDollarTotal > 0) {
        // The small-dollar total includes unitemized contributions
        // Don't double-count with employer data (which only covers itemized)
        await upsertDonorAndDonation(
          "Small-Dollar Individual Donors (Under $200)",
          "INDIVIDUAL",
          "Individual Contributions",
          politicianId,
          smallDollarTotal,
          cycleStr,
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
          cycleStr,
          result
        );
      }
    } catch (err) {
      result.errors.push(
        `Aggregated contributions (${cycle}): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}
