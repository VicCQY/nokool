import { PrismaClient } from "@prisma/client";
import { classifyIndustry, guessDonorType } from "../src/lib/fec-industries";

const prisma = new PrismaClient();

async function main() {
  const donors = await prisma.donor.findMany({
    select: { id: true, name: true, type: true, industry: true },
  });

  console.log(`Total donors: ${donors.length}`);

  let reclassified = 0;
  let fromOther = 0;
  const industryCounts: Record<string, number> = {};

  for (const donor of donors) {
    const newIndustry = classifyIndustry(donor.name, donor.type);
    industryCounts[newIndustry] = (industryCounts[newIndustry] || 0) + 1;

    if (newIndustry !== donor.industry) {
      if (donor.industry === "Other") fromOther++;
      await prisma.donor.update({
        where: { id: donor.id },
        data: { industry: newIndustry },
      });
      reclassified++;
    }
  }

  console.log(`\nReclassified: ${reclassified} donors`);
  console.log(`Moved from "Other": ${fromOther}\n`);
  console.log("Industry breakdown:");
  const sorted = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]);
  for (const [industry, count] of sorted) {
    console.log(`  ${industry}: ${count}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
