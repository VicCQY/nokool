import { prisma } from "@/lib/prisma";
import {
  searchCandidates,
  getCandidateCommittees,
  getContributionsByEmployer,
  getContributions,
  delay,
} from "@/lib/fec-api";
import { classifyIndustry, guessDonorType } from "@/lib/fec-industries";

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

    // Determine office type
    let office: string | undefined;
    if (pol.branch === "executive") office = "P";
    else if (pol.chamber === "senate") office = "S";
    else if (pol.chamber === "house") office = "H";

    try {
      await delay(500);
      const candidates = await searchCandidates(pol.name, office);

      if (candidates.length > 0) {
        // Pick the best match — prefer exact-ish name match
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

  // Upsert donor by name + country
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

  // Check for existing donation from same donor, same politician, same cycle
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

export async function syncFecDonations(
  politicianId: string,
  cycles: number[] = [2024]
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

  // Get committees
  let committees;
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

  // Use the primary committee (usually first, or the one designated 'P')
  const primaryCommittee =
    committees.find((c) => c.designation === "P") || committees[0];
  const committeeId = primaryCommittee.committee_id;

  for (const cycle of cycles) {
    const cycleStr = String(cycle);

    // 1. Top employer contributions
    try {
      await delay(500);
      const employers = await getContributionsByEmployer(committeeId, cycle);

      for (const emp of employers) {
        if (!emp.employer || emp.employer === "NOT EMPLOYED" || emp.employer === "NONE" || emp.employer === "N/A")
          continue;

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

    // 2. Top individual contributions
    try {
      await delay(500);
      const individuals = await getContributions(committeeId, "individual", 20);

      for (const ind of individuals) {
        if (!ind.contributor_name || ind.contribution_receipt_amount <= 0)
          continue;

        const industry = classifyIndustry(
          ind.contributor_employer || ind.contributor_occupation || ""
        );

        await upsertDonorAndDonation(
          ind.contributor_name,
          "INDIVIDUAL",
          industry,
          politicianId,
          ind.contribution_receipt_amount,
          cycleStr,
          result
        );
      }
    } catch (err) {
      result.errors.push(
        `Individual contributions (${cycle}): ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // 3. Top committee/PAC contributions
    try {
      await delay(500);
      const pacs = await getContributions(committeeId, "committee", 20);

      for (const pac of pacs) {
        if (!pac.contributor_name || pac.contribution_receipt_amount <= 0)
          continue;

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
  }

  return result;
}
