import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

function isSelfCampaignName(donorName: string, politicianName: string): boolean {
  const upper = donorName.toUpperCase();
  const parts = politicianName.toUpperCase().split(" ");
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];

  const hasFirstName = upper.includes(firstName);
  const hasLastName = upper.includes(lastName);

  if (!hasFirstName && !hasLastName) return false;

  if (/\b20\d{2}\b/.test(upper)) return true;
  if (upper.includes("FRIENDS OF")) return true;
  for (const suffix of SELF_CAMPAIGN_SUFFIXES) {
    if (upper.includes(suffix)) return true;
  }
  if (upper.includes("COMMITTEE") || upper.includes("JFC")) return true;

  return false;
}

async function main() {
  // 1. Clean up FEC placeholder donors
  console.log("=== Cleaning up FEC placeholder donors ===\n");

  const placeholderDonors = await prisma.donor.findMany({
    where: {
      name: { startsWith: "INFORMATION REQUESTED", mode: "insensitive" },
    },
    include: { donations: true },
  });

  for (const donor of placeholderDonors) {
    const donationCount = donor.donations.length;
    const totalAmount = donor.donations.reduce((sum, d) => sum + d.amount, 0);
    console.log(`  Deleting placeholder: "${donor.name}" (${donationCount} donations, $${totalAmount.toLocaleString()})`);
    await prisma.donation.deleteMany({ where: { donorId: donor.id } });
    await prisma.donor.delete({ where: { id: donor.id } });
  }
  console.log(`  Deleted ${placeholderDonors.length} placeholder donors\n`);

  // 2. Clean up self-transfer donors
  console.log("=== Cleaning up self-transfer donors ===\n");

  const politicians = await prisma.politician.findMany({
    where: { country: "US" },
    select: { id: true, name: true, fecCandidateId: true },
  });

  let totalSelfTransfers = 0;

  for (const pol of politicians) {
    // Get all donations for this politician with donor info
    const donations = await prisma.donation.findMany({
      where: { politicianId: pol.id },
      include: { donor: true },
    });

    const selfDonorIds = new Set<string>();

    for (const donation of donations) {
      if (isSelfCampaignName(donation.donor.name, pol.name)) {
        selfDonorIds.add(donation.donorId);
      }
    }

    if (selfDonorIds.size > 0) {
      for (const donorId of selfDonorIds) {
        const donor = await prisma.donor.findUnique({ where: { id: donorId } });
        if (!donor) continue;

        const polDonations = await prisma.donation.findMany({
          where: { donorId, politicianId: pol.id },
        });
        const totalAmount = polDonations.reduce((sum, d) => sum + d.amount, 0);

        console.log(`  ${pol.name} ← "${donor.name}" ($${totalAmount.toLocaleString()}) — DELETING`);

        // Delete donations from this donor to this politician
        await prisma.donation.deleteMany({
          where: { donorId, politicianId: pol.id },
        });

        // If donor has no other donations, delete the donor too
        const remaining = await prisma.donation.count({ where: { donorId } });
        if (remaining === 0) {
          await prisma.donor.delete({ where: { id: donorId } });
        }

        totalSelfTransfers++;
      }
    }
  }

  console.log(`\n  Deleted ${totalSelfTransfers} self-transfer donor relationships\n`);
  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
