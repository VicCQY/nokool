import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TRUMP_WEIGHTS: Record<string, number> = {
  // Cornerstone (5)
  "Largest deportation operation in history": 5,
  "End the Russia-Ukraine war in 24 hours": 5,
  "10-20% universal tariff on all imports": 5,
  // Major (4)
  "End birthright citizenship": 4,
  "Eliminate the Department of Education": 4,
  "Full pardons for January 6 defendants": 4,
  "Drill baby drill — expand oil and gas production": 4,
  "Extend 2017 tax cuts": 4,
  "Bring down prices and end inflation": 4,
  // Standard (3)
  "Reinstate Remain in Mexico policy": 3,
  "Militarize the US-Mexico border": 3,
  "Ban transgender athletes from women's sports": 3,
  "Create Department of Government Efficiency (DOGE)": 3,
  "Eliminate taxes on tips": 3,
  "Reevaluate NATO and America First foreign policy": 3,
  "Protect Medicare and Social Security": 3,
  // Minor (2)
  "End taxes on Social Security benefits": 2,
  "Cap credit card interest rates at 10%": 2,
  "Make IVF free for all Americans": 2,
  "Most aggressive housing reform in history": 2,
  "Save TikTok": 2,
  // Trivial (1)
  "Expand use of the death penalty": 1,
};

const ISSUE_WEIGHTS = [
  { category: "Economy", weight: 3.0, source: "Pew Research Center, Sept 2024" },
  { category: "Healthcare", weight: 2.5, source: "Pew Research Center, Sept 2024" },
  { category: "Immigration", weight: 2.3, source: "Pew Research Center, Sept 2024" },
  { category: "Justice", weight: 2.2, source: "Pew Research Center, Sept 2024" },
  { category: "Foreign Policy", weight: 2.0, source: "Pew Research Center, Sept 2024" },
  { category: "Education", weight: 1.8, source: "Pew Research Center, Sept 2024" },
  { category: "Housing", weight: 1.6, source: "Pew Research Center, Sept 2024" },
  { category: "Infrastructure", weight: 1.4, source: "Pew Research Center, Sept 2024" },
  { category: "Environment", weight: 1.3, source: "Pew Research Center, Sept 2024" },
  { category: "Technology", weight: 1.1, source: "Pew Research Center, Sept 2024" },
  { category: "Other", weight: 1.0, source: "Default baseline" },
];

async function main() {
  // 1. Update Trump's promise weights
  console.log("=== Updating Trump promise weights ===");
  const trump = await prisma.politician.findFirst({
    where: { name: { contains: "Trump" } },
    include: { promises: true },
  });

  if (!trump) {
    console.log("Trump not found in database");
  } else {
    let updated = 0;
    for (const promise of trump.promises) {
      const weight = TRUMP_WEIGHTS[promise.title];
      if (weight && weight !== promise.weight) {
        await prisma.promise.update({
          where: { id: promise.id },
          data: { weight },
        });
        console.log(`  ${promise.title}: ${promise.weight} -> ${weight}`);
        updated++;
      } else if (!weight) {
        console.log(`  [no mapping] "${promise.title}" — keeping weight=${promise.weight}`);
      }
    }
    console.log(`Updated ${updated} promise weights for ${trump.name}`);
  }

  // 2. Seed issue weights
  console.log("\n=== Seeding issue weights ===");
  for (const iw of ISSUE_WEIGHTS) {
    await prisma.issueWeight.upsert({
      where: { category: iw.category },
      update: { weight: iw.weight, source: iw.source },
      create: { category: iw.category, weight: iw.weight, source: iw.source },
    });
    console.log(`  ${iw.category}: ${iw.weight} (${iw.source})`);
  }
  console.log("Done seeding issue weights");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
