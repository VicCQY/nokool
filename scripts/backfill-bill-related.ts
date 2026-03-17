/**
 * Backfill script: set billRelated = true for all promises
 * that already have PromiseBillLinks or PromiseActionLinks.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find promise IDs that have at least one bill link
  const billLinked = await prisma.promiseBillLink.findMany({
    select: { promiseId: true },
    distinct: ["promiseId"],
  });

  // Find promise IDs that have at least one action link
  const actionLinked = await prisma.promiseActionLink.findMany({
    select: { promiseId: true },
    distinct: ["promiseId"],
  });

  const ids = new Set([
    ...billLinked.map((l) => l.promiseId),
    ...actionLinked.map((l) => l.promiseId),
  ]);

  if (ids.size === 0) {
    console.log("No linked promises found. Nothing to update.");
    return;
  }

  const result = await prisma.promise.updateMany({
    where: { id: { in: Array.from(ids) } },
    data: { billRelated: true },
  });

  console.log(`Updated ${result.count} promises to billRelated = true`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
