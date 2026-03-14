import { PrismaClient } from "@prisma/client";
import { matchBillsToPromise } from "../src/lib/promise-bill-matcher";

const prisma = new PrismaClient();

async function main() {
  // Get all promises with their politician info
  const promises = await prisma.promise.findMany({
    include: {
      politician: { select: { id: true, name: true, country: true } },
    },
  });

  // Get all bills
  const bills = await prisma.bill.findMany({
    select: { id: true, title: true, summary: true, billNumber: true, category: true, country: true },
  });

  console.log(`Found ${promises.length} promises and ${bills.length} bills\n`);

  let totalLinks = 0;
  let totalPromisesMatched = 0;

  for (const promise of promises) {
    // Only match bills from the same country
    const countryBills = bills.filter((b) => b.country === promise.politician.country);

    const matches = matchBillsToPromise(
      {
        id: promise.id,
        title: promise.title,
        description: promise.description,
        category: promise.category,
      },
      countryBills,
    );

    if (matches.length > 0) {
      totalPromisesMatched++;
      const matchedBills = matches.map((m) => {
        const bill = countryBills.find((b) => b.id === m.billId)!;
        return { ...m, bill };
      });

      console.log(
        `Promise: "${promise.title}" (${promise.politician.name}) → ${matches.length} bills:`,
      );
      for (const m of matchedBills) {
        console.log(
          `  - ${m.bill.billNumber}: ${m.bill.title} (score: ${m.score}, alignment: ${m.alignment})`,
        );
      }
      console.log();

      // Upsert links (skip existing manual links)
      for (const match of matches) {
        try {
          await prisma.promiseBillLink.upsert({
            where: {
              promiseId_billId: {
                promiseId: promise.id,
                billId: match.billId,
              },
            },
            create: {
              promiseId: promise.id,
              billId: match.billId,
              relevance: "auto",
              alignment: match.alignment,
            },
            // Don't overwrite manual links
            update: {},
          });
          totalLinks++;
        } catch (e) {
          // Skip duplicates or errors
        }
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Promises with matches: ${totalPromisesMatched}/${promises.length}`);
  console.log(`Total links created/verified: ${totalLinks}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
