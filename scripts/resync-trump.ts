import * as fs from "fs";

// Load env manually
const envFile = fs.readFileSync(".env", "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  let val = trimmed.slice(eqIdx + 1);
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    val = val.slice(1, -1);
  process.env[key] = val;
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const trump = await prisma.politician.findFirst({
    where: { name: { contains: "Trump" } },
    select: { id: true, name: true, fecCandidateId: true },
  });

  if (!trump) {
    console.log("Trump not found in database");
    return;
  }

  console.log(`Found: ${trump.name} (FEC ID: ${trump.fecCandidateId})`);

  // Delete existing donations for Trump
  const deleted = await prisma.donation.deleteMany({
    where: { politicianId: trump.id },
  });
  console.log(`Deleted ${deleted.count} old donations\n`);

  const {
    getCandidateCommittees,
    getContributionsByEmployer,
    getContributions,
    getContributionsBySize,
    getCommitteeTotals,
    delay,
  } = await import("../src/lib/fec-api");
  const { classifyIndustry, guessDonorType } = await import("../src/lib/fec-industries");

  const EXCLUDED_EMPLOYERS = new Set([
    "retired", "self-employed", "self employed", "not employed", "none",
    "n/a", "null", "information requested", "information requested per best efforts",
    "entrepreneur", "homemaker", "disabled", "student", "unemployed", "refused", "requested",
  ]);

  const fecId = trump.fecCandidateId!;
  const cycle = 2024;

  // Get committees
  await delay(500);
  const committees = await getCandidateCommittees(fecId);
  console.log(`Found ${committees.length} committees`);

  // Find best committee by receipts
  let bestId = committees[0].committee_id;
  let bestName = committees[0].name;
  let bestReceipts = 0;
  const allCommitteeNames = new Set<string>();

  for (const c of committees) {
    allCommitteeNames.add(c.name.toUpperCase());
    try {
      await delay(300);
      const totals = await getCommitteeTotals(c.committee_id, cycle);
      if (totals && totals.receipts > bestReceipts) {
        bestReceipts = totals.receipts;
        bestId = c.committee_id;
        bestName = c.name;
      }
    } catch {}
  }

  console.log(`\nBest committee: ${bestName} (${bestId}) — $${bestReceipts.toLocaleString()} receipts\n`);

  let totalAmount = 0;
  let donorsCreated = 0;
  let donationsCreated = 0;

  async function upsertDonor(name: string, type: string, industry: string, amount: number) {
    if (!name || amount <= 0) return;
    let donor = await prisma.donor.findFirst({ where: { name, country: "US" } });
    if (!donor) {
      donor = await prisma.donor.create({
        data: { name, type: type as any, industry, country: "US" },
      });
      donorsCreated++;
    }
    const existing = await prisma.donation.findFirst({
      where: { donorId: donor.id, politicianId: trump.id, electionCycle: String(cycle) },
    });
    if (existing) {
      await prisma.donation.update({ where: { id: existing.id }, data: { amount } });
    } else {
      await prisma.donation.create({
        data: { donorId: donor.id, politicianId: trump.id, amount, date: new Date(), electionCycle: String(cycle) },
      });
      donationsCreated++;
    }
    totalAmount += amount;
  }

  // 1. Employer contributions
  console.log("=== EMPLOYER CONTRIBUTIONS (Top Organizations) ===");
  await delay(500);
  const employers = await getContributionsByEmployer(bestId, cycle, 50);
  for (const emp of employers) {
    if (!emp.employer || EXCLUDED_EMPLOYERS.has(emp.employer.toLowerCase().trim())) continue;
    const industry = classifyIndustry(emp.employer);
    const donorType = guessDonorType(emp.employer);
    await upsertDonor(emp.employer, donorType, industry, emp.total);
    console.log(`  ${emp.employer}: $${emp.total.toLocaleString()} [${industry}]`);
  }

  // 2. PAC/Committee contributions (filter out self-transfers)
  console.log("\n=== PAC/COMMITTEE CONTRIBUTIONS ===");
  await delay(500);
  const pacs = await getContributions(bestId, "committee", 50);
  for (const pac of pacs) {
    if (!pac.contributor_name || pac.contribution_receipt_amount <= 0) continue;
    const upperName = pac.contributor_name.toUpperCase();
    const isSelf = Array.from(allCommitteeNames).some(
      (cn) => upperName.includes(cn) || cn.includes(upperName)
    );
    if (isSelf) continue;
    if (upperName.includes("TRUMP") && (upperName.includes("COMMITTEE") || upperName.includes("JFC") || upperName.includes("JOINT FUNDRAISING") || upperName.includes("VICTORY") || upperName.includes("SAVE AMERICA"))) continue;

    const industry = classifyIndustry(pac.contributor_name);
    const donorType = guessDonorType(pac.contributor_name, "committee");
    await upsertDonor(pac.contributor_name, donorType, industry, pac.contribution_receipt_amount);
    console.log(`  ${pac.contributor_name}: $${pac.contribution_receipt_amount.toLocaleString()} [${industry}]`);
  }

  // 3. Aggregated categories from by_size endpoint
  console.log("\n=== CONTRIBUTION SIZE BREAKDOWN ===");
  await delay(500);
  const sizeBreakdown = await getContributionsBySize(bestId, cycle);
  let smallDollarTotal = 0;
  let largeDollarTotal = 0;
  for (const s of sizeBreakdown) {
    console.log(`  Size bucket ${s.size}: $${s.total?.toLocaleString()} (${s.count?.toLocaleString()} contributions)`);
    if (s.size <= 200) {
      smallDollarTotal += s.total;
    } else {
      largeDollarTotal += s.total;
    }
  }

  if (smallDollarTotal > 0) {
    await upsertDonor("Small-Dollar Individual Donors (Under $200)", "INDIVIDUAL", "Individual Contributions", smallDollarTotal);
    console.log(`\n  >> Small-Dollar Donors: $${smallDollarTotal.toLocaleString()}`);
  }
  if (largeDollarTotal > 0) {
    await upsertDonor("Large-Dollar Individual Donors ($200+)", "INDIVIDUAL", "Individual Contributions", largeDollarTotal);
    console.log(`  >> Large-Dollar Donors: $${largeDollarTotal.toLocaleString()}`);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Donors created: ${donorsCreated}`);
  console.log(`Donations created: ${donationsCreated}`);
  console.log(`Total amount: $${totalAmount.toLocaleString()}`);

  // Verify in DB
  const dbDonations = await prisma.donation.findMany({
    where: { politicianId: trump.id },
    include: { donor: true },
    orderBy: { amount: "desc" },
  });

  console.log(`\n=== TOP 20 DONATIONS IN DB ===`);
  let dbTotal = 0;
  for (const d of dbDonations.slice(0, 20)) {
    console.log(`  ${d.donor.name}: $${d.amount.toLocaleString()} [${d.donor.industry}]`);
  }
  for (const d of dbDonations) {
    dbTotal += d.amount;
  }
  console.log(`\nDB total: $${dbTotal.toLocaleString()} across ${dbDonations.length} donations`);

  await prisma.$disconnect();
}

main().catch(console.error);
