import { PrismaClient } from "@prisma/client";
import { syncAllFecSummaries } from "../src/lib/sync-fec-summary";

const prisma = new PrismaClient();

async function main() {
  // ── 1. Show current state ──
  const summaries = await prisma.fecSummary.findMany({
    select: { id: true, cycle: true, politicianId: true },
  });
  console.log(`FecSummary records: ${summaries.length}`);
  console.log("FecSummary cycles:", [...new Set(summaries.map((s) => s.cycle))]);

  const donationCycles = await prisma.donation.findMany({
    select: { electionCycle: true },
    distinct: ["electionCycle"],
  });
  console.log("Donation cycles:", donationCycles.map((d) => d.electionCycle));

  // ── 2. Delete ALL FecSummary records ──
  const deletedSummaries = await prisma.fecSummary.deleteMany({});
  console.log(`\nDeleted ${deletedSummaries.count} FecSummary records`);

  // ── 3. Fix any remaining "Election" suffixes in donations (bulk update) ──
  const fixResult = await prisma.$executeRaw`
    UPDATE "Donation"
    SET "electionCycle" = REPLACE("electionCycle", ' Election', '')
    WHERE "electionCycle" LIKE '% Election'
  `;
  console.log(`Fixed ${fixResult} donations with "Election" suffix (bulk)`);

  // ── 4. For senators: merge non-election-year donations into election years ──
  console.log("\n── Merging senator donation cycles ──");
  const senators = await prisma.politician.findMany({
    where: { country: "US", chamber: "senate" },
    select: { id: true, name: true, fecCandidateId: true },
  });

  for (const senator of senators) {
    const donations = await prisma.donation.findMany({
      where: { politicianId: senator.id },
      select: { id: true, electionCycle: true, donorId: true, amount: true },
    });
    if (donations.length === 0) continue;

    const cycles = [...new Set(donations.map((d) => d.electionCycle))].sort();
    const cycleNums = cycles.map(Number).filter((n) => !isNaN(n) && n % 2 === 0);
    if (cycleNums.length === 0) continue;

    // Determine election class: use FEC election_years if available
    // For now, use the most common pattern: Cruz elected 2012,2018,2024
    // Kelly elected 2020 (special), 2022... etc
    // The key insight: for each non-election year, merge UP to the next election year
    // We need to know which years are actual election years

    // Simple approach: for each senator, their election years are every 6 years
    // from their most recent one. We determine the most recent by looking at what
    // cycles they have data for. The highest year with data is likely their election year
    // or close to it.

    // Better approach: check if they have FEC candidate data with election_years
    // For the script, we'll use the FEC data we already synced.
    // Since we're about to re-sync, let's just determine class from the pattern:
    // Class I:   2018, 2024, 2030 (remainder 0 when (year-2018)%6 == 0)
    // Class II:  2020, 2026, 2032
    // Class III: 2022, 2028, 2034

    // Guess the class from highest even cycle year
    const highestYear = cycleNums.sort((a, b) => b - a)[0];

    // Try all 3 classes and pick the one that includes the highest year
    const classes = [
      { base: 2018, name: "I" },   // 2018, 2024, 2030
      { base: 2020, name: "II" },  // 2020, 2026, 2032
      { base: 2022, name: "III" }, // 2022, 2028, 2034
    ];

    let validYears = new Set<number>();
    for (const cls of classes) {
      const test = new Set<number>();
      for (let y = cls.base; y >= 2000; y -= 6) test.add(y);
      for (let y = cls.base; y <= 2030; y += 6) test.add(y);
      if (test.has(highestYear)) {
        validYears = test;
        break;
      }
    }

    // If no class matched, fall back to accepting all
    if (validYears.size === 0) {
      console.log(`  ${senator.name}: could not determine class, skipping`);
      continue;
    }

    const nonElectionCycles = cycles.filter((c) => !validYears.has(Number(c)));
    if (nonElectionCycles.length === 0) {
      console.log(`  ${senator.name}: cycles [${cycles.join(", ")}] — all valid`);
      continue;
    }

    console.log(`  ${senator.name}: cycles [${cycles.join(", ")}], non-election: [${nonElectionCycles.join(", ")}]`);
    console.log(`    Valid election years: [${[...validYears].sort().join(", ")}]`);

    for (const badCycle of nonElectionCycles) {
      const badNum = Number(badCycle);
      // Find the nearest election year >= badNum
      const sortedValid = [...validYears].sort((a, b) => a - b);
      const target = sortedValid.find((y) => y >= badNum) || sortedValid[sortedValid.length - 1];
      const targetCycle = String(target);

      const badDonations = donations.filter((d) => d.electionCycle === badCycle);
      console.log(`    Merging ${badDonations.length} donations from ${badCycle} → ${targetCycle}`);

      for (const don of badDonations) {
        const existing = await prisma.donation.findFirst({
          where: { donorId: don.donorId, politicianId: senator.id, electionCycle: targetCycle },
        });
        if (existing) {
          await prisma.donation.update({ where: { id: existing.id }, data: { amount: existing.amount + don.amount } });
          await prisma.donation.delete({ where: { id: don.id } });
        } else {
          await prisma.donation.update({ where: { id: don.id }, data: { electionCycle: targetCycle } });
        }
      }
    }
  }

  // ── 5. For executive: merge non-presidential-year donations ──
  console.log("\n── Checking executive donation cycles ──");
  const executives = await prisma.politician.findMany({
    where: { country: "US", branch: "executive" },
    select: { id: true, name: true },
  });

  const presidentialYears = new Set([2000, 2004, 2008, 2012, 2016, 2020, 2024, 2028]);
  for (const exec of executives) {
    const donations = await prisma.donation.findMany({
      where: { politicianId: exec.id },
      select: { id: true, electionCycle: true, donorId: true, amount: true },
    });
    if (donations.length === 0) continue;
    const cycles = [...new Set(donations.map((d) => d.electionCycle))].sort();
    const nonPres = cycles.filter((c) => !presidentialYears.has(Number(c)));

    if (nonPres.length === 0) {
      console.log(`  ${exec.name}: cycles [${cycles.join(", ")}] — all valid`);
      continue;
    }

    console.log(`  ${exec.name}: cycles [${cycles.join(", ")}], non-presidential: [${nonPres.join(", ")}]`);
    for (const badCycle of nonPres) {
      const badNum = Number(badCycle);
      const presArr = [...presidentialYears].sort((a, b) => a - b);
      const target = presArr.find((y) => y >= badNum) || presArr[presArr.length - 1];
      const targetCycle = String(target);

      const badDonations = donations.filter((d) => d.electionCycle === badCycle);
      console.log(`    Merging ${badDonations.length} donations from ${badCycle} → ${targetCycle}`);
      for (const don of badDonations) {
        const existing = await prisma.donation.findFirst({
          where: { donorId: don.donorId, politicianId: exec.id, electionCycle: targetCycle },
        });
        if (existing) {
          await prisma.donation.update({ where: { id: existing.id }, data: { amount: existing.amount + don.amount } });
          await prisma.donation.delete({ where: { id: don.id } });
        } else {
          await prisma.donation.update({ where: { id: don.id }, data: { electionCycle: targetCycle } });
        }
      }
    }
  }

  // ── 6. Show final donation state ──
  const finalDonCycles = await prisma.donation.findMany({
    select: { electionCycle: true },
    distinct: ["electionCycle"],
  });
  console.log(`\nFinal donation cycles:`, finalDonCycles.map((d) => d.electionCycle));

  // ── 7. Re-sync FEC Summary totals (now with filterValidElectionYears) ──
  console.log("\n── Re-syncing FEC Summary totals ──");
  const syncResult = await syncAllFecSummaries([2024, 2022, 2020, 2018]);
  console.log(`Synced ${syncResult.synced} FecSummary records`);
  for (const msg of syncResult.errors) {
    console.log(`  ${msg}`);
  }

  // ── 8. Final state ──
  const finalSummaries = await prisma.fecSummary.findMany({
    include: { politician: { select: { name: true, chamber: true, branch: true } } },
    orderBy: [{ politicianId: "asc" }, { cycle: "desc" }],
  });
  console.log(`\nFinal FecSummary records: ${finalSummaries.length}`);
  console.log("Cycles per politician:");
  const byPol = new Map<string, string[]>();
  for (const s of finalSummaries) {
    const key = s.politician.name;
    if (!byPol.has(key)) byPol.set(key, []);
    byPol.get(key)!.push(s.cycle);
  }
  for (const [name, cycles] of byPol) {
    console.log(`  ${name}: [${cycles.join(", ")}]`);
  }

  console.log("\nDone!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
