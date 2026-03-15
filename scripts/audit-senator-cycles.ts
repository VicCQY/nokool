import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Actual senate election years by senator (from public record)
// Class I:   2006, 2012, 2018, 2024
// Class II:  2008, 2014, 2020, 2026
// Class III: 2010, 2016, 2022, 2028
const SENATOR_ELECTIONS: Record<string, number[]> = {
  "Ted Cruz":        [2012, 2018, 2024],       // Class I, TX
  "Elizabeth Warren": [2012, 2018, 2024],       // Class I, MA
  "Bernie Sanders":  [2006, 2012, 2018, 2024], // Class I, VT
  "Josh Hawley":     [2018, 2024],             // Class I, MO (first elected 2018)
  "Jon Ossoff":      [2020, 2026],             // Class II, GA (special 2020→2021)
  "Cory Booker":     [2014, 2020, 2026],       // Class II, NJ
  "Mitch McConnell": [2008, 2014, 2020, 2026], // Class II, KY
  "Susan Collins":   [2008, 2014, 2020, 2026], // Class II, ME
  "Mark Kelly":      [2020, 2022],             // Class III, AZ (special 2020, full 2022)
  "John Thune":      [2004, 2010, 2016, 2022], // Class III, SD
  "Chuck Schumer":   [2004, 2010, 2016, 2022], // Class III, NY
  "Rand Paul":       [2010, 2016, 2022],       // Class III, KY
  "Lisa Murkowski":  [2004, 2010, 2016, 2022], // Class III, AK
  "Katie Britt":     [2022],                   // Class III, AL (first elected 2022)
  "John Fetterman":  [2022],                   // Class III, PA (first elected 2022)
  "Amy Klobuchar":   [2006, 2012, 2018, 2024], // Class I, MN
  "Lindsey Graham":  [2008, 2014, 2020, 2026], // Class II, SC
};

async function main() {
  const senators = await prisma.politician.findMany({
    where: { country: "US", chamber: "senate" },
    select: { id: true, name: true, inOfficeSince: true, termStart: true },
  });

  console.log("=== Auditing senator cycles ===\n");

  const fixes: { senatorId: string; senatorName: string; badCycle: string; targetCycle: string }[] = [];

  for (const senator of senators) {
    const knownElections = SENATOR_ELECTIONS[senator.name];
    if (!knownElections) {
      console.log(`⚠ ${senator.name}: NOT in known elections list — skipping`);
      continue;
    }

    const validSet = new Set(knownElections.map(String));

    // Check FecSummary
    const summaries = await prisma.fecSummary.findMany({
      where: { politicianId: senator.id },
      select: { id: true, cycle: true },
    });
    const sumCycles = summaries.map((s) => s.cycle).sort();

    // Check Donations
    const donationCycles = await prisma.donation.findMany({
      where: { politicianId: senator.id },
      select: { electionCycle: true },
      distinct: ["electionCycle"],
    });
    const donCycles = donationCycles.map((d) => d.electionCycle).sort();

    const badSumCycles = sumCycles.filter((c) => !validSet.has(c));
    const badDonCycles = donCycles.filter((c) => !validSet.has(c));

    if (badSumCycles.length === 0 && badDonCycles.length === 0) {
      console.log(`✓ ${senator.name}: OK (summary: [${sumCycles}], donations: [${donCycles}], valid: [${knownElections}])`);
    } else {
      console.log(`✗ ${senator.name}:`);
      console.log(`    Valid elections: [${knownElections}]`);
      if (sumCycles.length > 0) console.log(`    FecSummary cycles: [${sumCycles}]${badSumCycles.length > 0 ? ` — BAD: [${badSumCycles}]` : ""}`);
      if (donCycles.length > 0) console.log(`    Donation cycles: [${donCycles}]${badDonCycles.length > 0 ? ` — BAD: [${badDonCycles}]` : ""}`);

      // Determine where to merge bad cycles
      for (const bad of [...new Set([...badSumCycles, ...badDonCycles])]) {
        const badNum = Number(bad);
        // Find nearest valid election year >= badNum, or the highest valid year
        const sorted = knownElections.sort((a, b) => a - b);
        const target = sorted.find((y) => y >= badNum) || sorted[sorted.length - 1];
        fixes.push({ senatorId: senator.id, senatorName: senator.name, badCycle: bad, targetCycle: String(target) });
      }
    }
  }

  if (fixes.length === 0) {
    console.log("\nNo fixes needed!");
    return;
  }

  console.log(`\n=== Applying ${fixes.length} fixes ===\n`);

  for (const fix of fixes) {
    console.log(`${fix.senatorName}: ${fix.badCycle} → ${fix.targetCycle}`);

    // Fix FecSummary records
    const badSummaries = await prisma.fecSummary.findMany({
      where: { politicianId: fix.senatorId, cycle: fix.badCycle },
    });
    for (const s of badSummaries) {
      // Check if target cycle already exists
      const existing = await prisma.fecSummary.findFirst({
        where: { politicianId: fix.senatorId, cycle: fix.targetCycle },
      });
      if (existing) {
        // Delete the bad one (target already has data)
        await prisma.fecSummary.delete({ where: { id: s.id } });
        console.log(`  Deleted FecSummary ${fix.badCycle} (target ${fix.targetCycle} exists)`);
      } else {
        // Rename
        await prisma.fecSummary.update({ where: { id: s.id }, data: { cycle: fix.targetCycle } });
        console.log(`  Renamed FecSummary ${fix.badCycle} → ${fix.targetCycle}`);
      }
    }

    // Fix Donation records
    const badDonations = await prisma.donation.findMany({
      where: { politicianId: fix.senatorId, electionCycle: fix.badCycle },
      select: { id: true, donorId: true, amount: true },
    });
    let merged = 0, renamed = 0;
    for (const don of badDonations) {
      const existing = await prisma.donation.findFirst({
        where: { donorId: don.donorId, politicianId: fix.senatorId, electionCycle: fix.targetCycle },
      });
      if (existing) {
        await prisma.donation.update({ where: { id: existing.id }, data: { amount: existing.amount + don.amount } });
        await prisma.donation.delete({ where: { id: don.id } });
        merged++;
      } else {
        await prisma.donation.update({ where: { id: don.id }, data: { electionCycle: fix.targetCycle } });
        renamed++;
      }
    }
    if (badDonations.length > 0) {
      console.log(`  Donations: ${merged} merged, ${renamed} renamed`);
    }
  }

  // Final state
  console.log("\n=== Final state ===\n");
  for (const senator of senators) {
    const summaries = await prisma.fecSummary.findMany({
      where: { politicianId: senator.id },
      select: { cycle: true },
      orderBy: { cycle: "desc" },
    });
    const donations = await prisma.donation.findMany({
      where: { politicianId: senator.id },
      select: { electionCycle: true },
      distinct: ["electionCycle"],
    });
    const s = summaries.map((x) => x.cycle).join(", ") || "(none)";
    const d = donations.map((x) => x.electionCycle).sort().join(", ") || "(none)";
    console.log(`${senator.name}: summary=[${s}] donations=[${d}]`);
  }

  console.log("\nDone!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
