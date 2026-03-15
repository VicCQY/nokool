import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Show current state
  const summaries = await prisma.fecSummary.findMany({
    select: { id: true, cycle: true, politicianId: true },
  });
  console.log(`FecSummary records: ${summaries.length}`);
  const sumCycles = [...new Set(summaries.map((s) => s.cycle))];
  console.log("FecSummary cycles:", sumCycles);

  const donationCycles = await prisma.donation.findMany({
    select: { electionCycle: true },
    distinct: ["electionCycle"],
  });
  console.log(
    "Donation cycles:",
    donationCycles.map((d) => d.electionCycle)
  );

  // 2. Delete ALL FecSummary records (will re-sync with corrected labels)
  const deletedSummaries = await prisma.fecSummary.deleteMany({});
  console.log(`\nDeleted ${deletedSummaries.count} FecSummary records`);

  // 3. Fix donation electionCycle labels: remove " Election" suffix
  const electionCycleDonations = await prisma.donation.findMany({
    where: { electionCycle: { contains: " Election" } },
    select: { id: true, electionCycle: true, donorId: true, politicianId: true, amount: true },
  });
  console.log(
    `\nDonation records with " Election" suffix: ${electionCycleDonations.length}`
  );

  for (const don of electionCycleDonations) {
    const newCycle = don.electionCycle.replace(" Election", "");
    // Check if there's already a record with the corrected cycle for same donor+politician
    const existing = await prisma.donation.findFirst({
      where: {
        donorId: don.donorId,
        politicianId: don.politicianId,
        electionCycle: newCycle,
      },
    });

    if (existing) {
      // Merge: add amount to existing and delete the old record
      await prisma.donation.update({
        where: { id: existing.id },
        data: { amount: existing.amount + don.amount },
      });
      await prisma.donation.delete({ where: { id: don.id } });
      console.log(
        `  Merged ${don.electionCycle} -> ${newCycle} (donor ${don.donorId})`
      );
    } else {
      // Just rename
      await prisma.donation.update({
        where: { id: don.id },
        data: { electionCycle: newCycle },
      });
      console.log(`  Renamed ${don.electionCycle} -> ${newCycle}`);
    }
  }

  // 4. Show final state
  const finalDonationCycles = await prisma.donation.findMany({
    select: { electionCycle: true },
    distinct: ["electionCycle"],
  });
  console.log(
    `\nFinal donation cycles:`,
    finalDonationCycles.map((d) => d.electionCycle)
  );

  console.log("\nDone! Now re-sync FEC summaries from the admin page.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
